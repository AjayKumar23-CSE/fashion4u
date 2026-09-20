import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from './razorpay.service.js';

const KEY_SECRET = 'test_secret';
const WEBHOOK_SECRET = 'webhook_secret';

const service = new RazorpayService({
  get: (key: string) =>
    ({
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    })[key],
} as unknown as ConfigService);

describe('RazorpayService signatures', () => {
  it('accepts a correctly signed checkout callback', () => {
    const orderId = 'order_ABC';
    const paymentId = 'pay_XYZ';
    const signature = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      service.verifyCheckoutSignature({ orderId, paymentId, signature }),
    ).toBe(true);
  });

  it('rejects a tampered payment id', () => {
    const signature = createHmac('sha256', KEY_SECRET)
      .update('order_ABC|pay_XYZ')
      .digest('hex');

    expect(
      service.verifyCheckoutSignature({
        orderId: 'order_ABC',
        paymentId: 'pay_EVIL',
        signature,
      }),
    ).toBe(false);
  });

  it('rejects a signature signed with the wrong secret', () => {
    const signature = createHmac('sha256', 'not_the_secret')
      .update('order_ABC|pay_XYZ')
      .digest('hex');

    expect(
      service.verifyCheckoutSignature({
        orderId: 'order_ABC',
        paymentId: 'pay_XYZ',
        signature,
      }),
    ).toBe(false);
  });

  it('accepts a webhook signed over the exact raw body', () => {
    const rawBody = Buffer.from('{"event":"payment.captured","x":1}');
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a webhook whose body was altered by one byte', () => {
    const rawBody = Buffer.from('{"event":"payment.captured","x":1}');
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(
      service.verifyWebhookSignature(
        Buffer.from('{"event":"payment.captured","x":2}'),
        signature,
      ),
    ).toBe(false);
  });

  it('rejects an empty or malformed signature without throwing', () => {
    const rawBody = Buffer.from('{}');
    expect(service.verifyWebhookSignature(rawBody, '')).toBe(false);
    expect(service.verifyWebhookSignature(rawBody, 'not-hex')).toBe(false);
  });
});
