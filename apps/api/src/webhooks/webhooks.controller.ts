import {
  Controller,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CheckoutService } from '../checkout/checkout.service.js';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/gateway.js';

interface RazorpayEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    refund?: { entity?: { id?: string; status?: string } };
  };
}

// The gateway webhook, not the browser redirect, decides whether an order is
// paid: the browser can be closed, throttled or tampered with.
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly checkout: CheckoutService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  @Post('payment')
  @HttpCode(200)
  async payment(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody;
    const signature = req.header('x-razorpay-signature') ?? '';
    if (!rawBody || !this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException({
        code: 'SIGNATURE_INVALID',
        message: 'Invalid webhook signature',
      });
    }

    const event = JSON.parse(rawBody.toString('utf8')) as RazorpayEvent;
    const entity = event.payload?.payment?.entity;

    switch (event.event) {
      case 'payment.captured':
        if (entity?.order_id && entity.id) {
          await this.checkout.markPaid(entity.order_id, entity.id, event);
        }
        break;
      case 'payment.failed':
        if (entity?.order_id)
          await this.checkout.failOrder(entity.order_id, event);
        break;
      default:
        this.logger.log(`Ignoring webhook event ${event.event}`);
    }

    // Always 200 once handled, or Razorpay retries the same event.
    return { received: true };
  }
}
