import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PricingService,
  cartItemInclude,
  unitPriceOf,
} from '../pricing/pricing.service.js';
import { gstIncludedIn } from '../pricing/totals.js';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/gateway.js';
import type { Prisma } from '../generated/prisma/client.js';
import { generateOrderNumber } from './order-number.js';
import type { CreateOrderDto } from './dto/checkout.dto.js';

/** Stock is held this long while the customer is on the payment page. */
export const RESERVATION_MINUTES = 15;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async createOrder(
    cartId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
  ) {
    // A retried request must never create a second order or charge twice.
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: { payments: true },
    });
    if (existing)
      return this.checkoutPayload(existing, existing.payments[0] ?? null);

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: cartItemInclude } },
    });
    if (cart.items.length === 0) {
      throw new BadRequestException({
        code: 'CART_EMPTY',
        message: 'Your bag is empty',
      });
    }

    const isCod = dto.paymentMethod === 'COD';
    const config = await this.pricing.loadConfig();
    // Recalculated from the database: the browser's idea of the price is ignored.
    const totals = await this.pricing.priceItems(cart.items, {
      couponCode: cart.couponCode,
      payment: isCod ? 'COD' : 'PREPAID',
    });

    if (isCod && totals.total > config.codMaxOrderValue) {
      throw new BadRequestException({
        code: 'COD_LIMIT_EXCEEDED',
        message: `Cash on delivery is available up to ₹${config.codMaxOrderValue / 100}. Please pay online for this order.`,
      });
    }

    const customer = await this.findOrCreateCustomer(dto);
    const orderNo = generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      // Hold stock atomically. The WHERE clause is the guard: if two customers
      // race for the last piece, only one UPDATE matches a row.
      for (const item of cart.items) {
        const held = await tx.$executeRaw`
          UPDATE variant SET reserved = reserved + ${item.qty}
          WHERE id = ${item.variantId} AND stock - reserved >= ${item.qty}`;
        if (held === 0) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `${item.variant.product.name} (size ${item.variant.size}) just sold out`,
          });
        }
      }

      const created = await tx.order.create({
        data: {
          orderNo,
          customerId: customer.id,
          // Written out field by field: the order keeps what was true at the
          // time, independent of the DTO class or any later edit.
          addressSnapshot: {
            name: dto.address.name,
            phone: dto.address.phone,
            email: dto.address.email ?? null,
            line1: dto.address.line1,
            line2: dto.address.line2 ?? null,
            city: dto.address.city,
            state: dto.address.state,
            pincode: dto.address.pincode,
          },
          subtotal: totals.subtotal,
          discount: totals.discount + totals.prepaidDiscount,
          shipping: totals.shipping,
          codFee: totals.codFee,
          total: totals.total,
          paymentMethod: isCod ? 'COD' : 'UPI',
          paymentStatus: 'PENDING',
          // A COD order is placed straight away; a prepaid one is not a real
          // order until the gateway confirms the money.
          status: isCod ? 'PLACED' : 'PAYMENT_PENDING',
          couponCode:
            totals.offer?.kind === 'COUPON' ? totals.offer.label : null,
          idempotencyKey,
          items: {
            create: cart.items.map((item) => {
              const price = unitPriceOf(item);
              return {
                variantId: item.variantId,
                nameSnapshot: `${item.variant.product.name} (${item.variant.size})`,
                priceSnapshot: price,
                qty: item.qty,
                gstAmount: gstIncludedIn(
                  price * item.qty,
                  item.variant.product.gstRate,
                ),
              };
            }),
          },
        },
        include: { items: true },
      });

      // A COD order is confirmed the moment it is placed, so its stock is
      // committed now; a prepaid order commits when the gateway confirms.
      if (isCod) {
        await this.commitStock(
          tx,
          created.items,
          created.orderNo,
          'COD order placed',
        );
      }

      // The bag is emptied now so a back-button reload cannot reuse it.
      await tx.cartItem.deleteMany({ where: { cartId } });
      await tx.cart.update({
        where: { id: cartId },
        data: { couponCode: null },
      });
      return created;
    });

    if (isCod) return this.checkoutPayload(order, null);

    try {
      const gatewayOrder = await this.gateway.createOrder({
        amount: order.total,
        receipt: order.orderNo,
        notes: { orderId: order.id, orderNo: order.orderNo },
      });
      const payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: this.gateway.name,
          gatewayOrderId: gatewayOrder.id,
          amount: order.total,
          status: 'PENDING',
        },
      });
      return this.checkoutPayload(order, payment);
    } catch (error) {
      // The gateway refused before the customer could pay, so the held stock
      // goes back immediately instead of waiting for the timeout sweep.
      await this.releaseOrder(order.id, null, {
        reason: 'gateway order failed',
      });
      throw error;
    }
  }

  /**
   * Turns held stock into sold stock. A confirmed order owns its units, so the
   * reservation is converted rather than left hanging. (When dispatch exists,
   * this moves to the packing step, which is when goods truly leave the shelf.)
   */
  private async commitStock(
    tx: Prisma.TransactionClient,
    items: { variantId: string; qty: number }[],
    orderNo: string,
    reason: string,
  ) {
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE variant SET stock = stock - ${item.qty}, reserved = GREATEST(reserved - ${item.qty}, 0)
        WHERE id = ${item.variantId}`;
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          change: -item.qty,
          reason,
          reference: orderNo,
        },
      });
    }
  }

  /** Called from the browser right after checkout closes: fast, optimistic. */
  async verifyPayment(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const valid = this.gateway.verifyCheckoutSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!valid) {
      throw new BadRequestException({
        code: 'SIGNATURE_INVALID',
        message: 'We could not verify that payment',
      });
    }

    await this.markPaid(input.razorpayOrderId, input.razorpayPaymentId, {
      source: 'checkout',
    });
    return this.getByGatewayOrder(input.razorpayOrderId);
  }

  /**
   * Marks an order paid. Called by both the browser callback and the webhook,
   * which race, so it must be safe to run twice.
   */
  async markPaid(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    raw: unknown,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      this.logger.warn(`Payment for gateway order ${gatewayOrderId} not found`);
      return;
    }
    if (payment.status === 'PAID') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          gatewayPaymentId,
          rawPayload: raw as Prisma.InputJsonValue,
        },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'PAID', status: 'PLACED' },
      });
      await this.commitStock(
        tx,
        payment.order.items,
        payment.order.orderNo,
        'Order paid',
      );
    });

    this.logger.log(
      `Order ${payment.order.orderNo} paid (${gatewayPaymentId})`,
    );
  }

  /** Payment failed or the reservation expired: release the stock. */
  async failOrder(gatewayOrderId: string, raw: unknown) {
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!payment || payment.status === 'PAID' || payment.status === 'FAILED')
      return;

    await this.releaseOrder(payment.orderId, payment.id, raw);
    this.logger.log(`Order ${payment.order.orderNo} failed, stock released`);
  }

  async releaseOrder(orderId: string, paymentId: string | null, raw: unknown) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    await this.prisma.$transaction(async (tx) => {
      if (paymentId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'FAILED', rawPayload: raw as Prisma.InputJsonValue },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'FAILED', status: 'PAYMENT_FAILED' },
      });
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE variant SET reserved = GREATEST(reserved - ${item.qty}, 0)
          WHERE id = ${item.variantId}`;
      }
    });
  }

  async getByGatewayOrder(gatewayOrderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }
    return this.orderView(payment.order);
  }

  async getOrder(orderNo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }
    return this.orderView(order);
  }

  private orderView(
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  ) {
    return {
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      placedAt: order.placedAt,
      address: order.addressSnapshot,
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        qty: item.qty,
        price: item.priceSnapshot,
        lineTotal: item.priceSnapshot * item.qty,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      codFee: order.codFee,
      total: order.total,
    };
  }

  // Guests still become a customer row: orders, tracking and support all hang
  // off it, and a later OTP login on the same number picks up the history.
  private async findOrCreateCustomer(dto: CreateOrderDto) {
    const { phone, name, email } = dto.address;
    return this.prisma.customer.upsert({
      where: { phone },
      create: { phone, name, email },
      update: { name, ...(email ? { email } : {}) },
    });
  }

  private checkoutPayload(
    order: {
      id: string;
      orderNo: string;
      total: number;
      paymentMethod: string;
      status: string;
    },
    payment: { gatewayOrderId: string } | null,
  ) {
    return {
      orderNo: order.orderNo,
      total: order.total,
      paymentMethod: order.paymentMethod,
      status: order.status,
      // Present for prepaid orders only: what the browser needs to open checkout.
      gateway: payment
        ? {
            name: this.gateway.name,
            keyId: this.gateway.publicKey(),
            orderId: payment.gatewayOrderId,
            amount: order.total,
          }
        : null,
    };
  }
}
