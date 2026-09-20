import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GatewayOrder, GatewayRefund, PaymentGateway } from './gateway.js';

const API = 'https://api.razorpay.com/v1';

@Injectable()
export class RazorpayService implements PaymentGateway {
  readonly name = 'razorpay';

  constructor(private readonly config: ConfigService) {}

  publicKey(): string {
    return this.keys().keyId;
  }

  async createOrder(input: {
    amount: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder> {
    // Razorpay works in paise, which is how amounts are stored here too, so
    // the number is passed straight through with no conversion.
    const order = await this.request<{ id: string; amount: number }>(
      '/orders',
      {
        amount: input.amount,
        currency: 'INR',
        receipt: input.receipt,
        notes: input.notes,
      },
    );
    return { id: order.id, amount: order.amount };
  }

  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const expected = createHmac('sha256', this.keys().keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return safeEqual(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_NOT_CONFIGURED',
        message: 'RAZORPAY_WEBHOOK_SECRET is not set',
      });
    }
    // Computed over the exact bytes received: re-serialising the JSON would
    // change the whitespace and every signature would fail.
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  async refund(paymentId: string, amount: number): Promise<GatewayRefund> {
    const refund = await this.request<{ id: string; status: string }>(
      `/payments/${paymentId}/refund`,
      { amount },
    );
    return { id: refund.id, status: refund.status };
  }

  private keys() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message:
          'Online payment is not set up. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the API .env',
      });
    }
    return { keyId, keySecret };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const { keyId, keySecret } = this.keys();
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await res.json()) as { error?: { description?: string } };
    if (!res.ok) {
      throw new InternalServerErrorException({
        code: 'GATEWAY_ERROR',
        message:
          payload.error?.description ?? `Razorpay returned ${res.status}`,
      });
    }
    return payload as T;
  }
}

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received ?? '', 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
