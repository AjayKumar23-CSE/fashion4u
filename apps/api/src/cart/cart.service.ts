import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PricingService,
  cartItemInclude,
  unitPriceOf,
  type CartItemWithProduct,
} from '../pricing/pricing.service.js';
import type { PaymentChoice } from '../pricing/totals.js';
import { discountPercent } from '../catalog/pricing.js';
import { MAX_QTY_PER_ITEM } from './dto/cart.dto.js';

const availableOf = (variant: { stock: number; reserved: number }) =>
  Math.max(variant.stock - variant.reserved, 0);

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /** Finds the guest's cart, creating one (and its token) on first use. */
  async resolve(token: string | undefined) {
    if (token) {
      const existing = await this.prisma.cart.findUnique({
        where: { guestToken: token },
      });
      if (existing) return existing;
    }
    return this.prisma.cart.create({ data: { guestToken: randomUUID() } });
  }

  async view(cartId: string, payment: PaymentChoice = 'PREPAID') {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: cartItemInclude, orderBy: { id: 'asc' } } },
    });

    // A coupon can expire or be withdrawn while it sits in someone's bag.
    const coupon = await this.pricing.loadCoupon(cart.couponCode);
    const totals = await this.pricing.priceItems(cart.items, {
      couponCode: coupon?.code ?? null,
      payment,
    });

    return {
      token: cart.guestToken,
      items: cart.items.map((item) => this.toLine(item)),
      coupon: coupon
        ? { code: coupon.code, applied: totals.offer?.kind === 'COUPON' }
        : cart.couponCode
          ? { code: cart.couponCode, applied: false, expired: true }
          : null,
      totals,
    };
  }

  private toLine(item: CartItemWithProduct) {
    const { product } = item.variant;
    const unitPrice = unitPriceOf(item);
    const available = availableOf(item.variant);

    return {
      id: item.id,
      variantId: item.variantId,
      qty: item.qty,
      size: item.variant.size,
      colour: item.variant.colour,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      image: product.images[0] ?? null,
      unitPrice,
      mrp: product.mrp,
      discountPercent: discountPercent(product.mrp, unitPrice),
      lineTotal: unitPrice * item.qty,
      available,
      // Stock can fall while the bag sits idle; the bag shows it before checkout does.
      inStock: available >= item.qty,
    };
  }

  async addItem(cartId: string, variantId: string, qty: number) {
    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, product: { status: 'ACTIVE' } },
    });
    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'That size is no longer available',
      });
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
    });
    // The DTO caps a single request; this caps the running total, so repeated
    // "add to bag" taps cannot walk past the per-item limit.
    const wanted = (existing?.qty ?? 0) + qty;
    if (wanted > MAX_QTY_PER_ITEM) {
      throw new BadRequestException({
        code: 'QTY_LIMIT',
        message: `You can order up to ${MAX_QTY_PER_ITEM} of one size`,
        fields: { qty: [`Limit is ${MAX_QTY_PER_ITEM}`] },
      });
    }
    this.assertStock(variant, wanted);

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, qty },
      update: { qty: wanted },
    });
    return this.view(cartId);
  }

  async updateItem(cartId: string, itemId: string, qty: number) {
    const item = await this.findItem(cartId, itemId);
    this.assertStock(item.variant, qty);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { qty } });
    return this.view(cartId);
  }

  async removeItem(cartId: string, itemId: string) {
    await this.findItem(cartId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.view(cartId);
  }

  async applyCoupon(cartId: string, code: string) {
    const coupon = await this.pricing.loadCoupon(code);
    if (!coupon) {
      throw new BadRequestException({
        code: 'COUPON_INVALID',
        message: 'That code is not valid right now',
        fields: { code: ['Not valid'] },
      });
    }

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: cartItemInclude } },
    });
    const totals = await this.pricing.priceItems(cart.items, {
      couponCode: coupon.code,
    });
    if (totals.offer?.kind !== 'COUPON') {
      throw new BadRequestException({
        code: 'COUPON_NOT_APPLICABLE',
        message:
          totals.subtotal < coupon.minBag
            ? `Add items worth ₹${(coupon.minBag - totals.subtotal) / 100} more to use this code`
            : 'An automatic offer on your bag already saves you more',
        fields: { code: ['Not applicable'] },
      });
    }

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: coupon.code },
    });
    return this.view(cartId);
  }

  async removeCoupon(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: null },
    });
    return this.view(cartId);
  }

  private async findItem(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
      include: { variant: true },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'Item not in your bag',
      });
    }
    return item;
  }

  private assertStock(
    variant: { stock: number; reserved: number; size: string },
    qty: number,
  ) {
    const available = availableOf(variant);
    if (qty > available) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message:
          available === 0
            ? `Size ${variant.size} is sold out`
            : `Only ${available} left in size ${variant.size}`,
        fields: { qty: [`Only ${available} available`] },
      });
    }
  }
}
