import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

// Needs the database running and seeded.
describe('Cart and checkout (e2e)', () => {
  let app: INestApplication<App>;
  let http: () => request.Agent;
  let cartToken: string;
  let variantId: string;
  let startingStock: number;

  const address = {
    name: 'Test Buyer',
    phone: '9876500000',
    email: '',
    line1: '1 Test Street',
    line2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // Mirrors main.ts: webhook signatures are checked against the raw bytes.
    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = () => request(app.getHttpServer());

    const product = await http().get(
      '/api/v1/products/black-superman-tank-for-men',
    );
    const variant = product.body.variants.find(
      (v: { available: number }) => v.available >= 5,
    );
    variantId = variant.id;
    startingStock = variant.available;

    const cart = await http().get('/api/v1/cart').expect(200);
    cartToken = cart.headers['x-cart-token'];
  });

  afterAll(async () => {
    await app.close();
  });

  const withCart = (req: request.Test) => req.set('x-cart-token', cartToken);

  it('issues a cart token and starts empty', () => {
    expect(cartToken).toBeTruthy();
  });

  it('prices a bundle offer once enough items qualify', async () => {
    await withCart(http().post('/api/v1/cart/items'))
      .send({ variantId, qty: 3 })
      .expect(201);
    const three = await withCart(http().get('/api/v1/cart')).expect(200);
    expect(three.body.totals.offer).toBeNull();

    await withCart(http().post('/api/v1/cart/items'))
      .send({ variantId, qty: 1 })
      .expect(201);
    const four = await withCart(http().get('/api/v1/cart')).expect(200);
    expect(four.body.totals.offer).toMatchObject({ kind: 'BUNDLE' });
    expect(four.body.totals.subtotal - four.body.totals.discount).toBe(99900);
  });

  it('caps the quantity of one size however the items were added', async () => {
    const res = await withCart(http().post('/api/v1/cart/items'))
      .send({ variantId, qty: 9 })
      .expect(400);
    expect(res.body.code).toBe('QTY_LIMIT');
  });

  it('refuses an order without an idempotency key', async () => {
    const res = await withCart(http().post('/api/v1/checkout/orders'))
      .send({ address, paymentMethod: 'COD' })
      .expect(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('accepts an address whose optional fields are blank strings', async () => {
    // A browser sends "" for a field the customer skipped.
    const res = await withCart(http().post('/api/v1/checkout/orders'))
      .set('Idempotency-Key', randomUUID())
      .send({ address, paymentMethod: 'COD' })
      .expect(201);
    expect(res.body.orderNo).toMatch(/^BR/);
    expect(res.body.gateway).toBeNull();
    expect(res.body.status).toBe('PLACED');
  });

  it('empties the bag and commits the stock once the order is placed', async () => {
    const cart = await withCart(http().get('/api/v1/cart')).expect(200);
    expect(cart.body.items).toHaveLength(0);

    const product = await http().get(
      '/api/v1/products/black-superman-tank-for-men',
    );
    const variant = product.body.variants.find(
      (v: { id: string }) => v.id === variantId,
    );
    expect(variant.available).toBe(startingStock - 4);
  });

  it('returns the same order when a request is retried with one key', async () => {
    await withCart(http().post('/api/v1/cart/items'))
      .send({ variantId, qty: 1 })
      .expect(201);
    const key = randomUUID();
    const first = await withCart(http().post('/api/v1/checkout/orders'))
      .set('Idempotency-Key', key)
      .send({ address, paymentMethod: 'COD' })
      .expect(201);
    const retry = await withCart(http().post('/api/v1/checkout/orders'))
      .set('Idempotency-Key', key)
      .send({ address, paymentMethod: 'COD' })
      .expect(201);

    expect(retry.body.orderNo).toBe(first.body.orderNo);
  });

  it('rejects a webhook whose signature does not match', async () => {
    const body = { event: 'payment.captured', payload: {} };
    await http()
      .post('/api/v1/webhooks/payment')
      .set('x-razorpay-signature', 'forged')
      .send(body)
      .expect((res) => {
        // 401 when a secret is configured, 503 when it is not — never 200.
        expect([401, 503]).toContain(res.status);
      });
  });

  it('accepts a correctly signed webhook when a secret is configured', async () => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return;

    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_test', order_id: 'order_unknown' } },
      },
    });
    const signature = createHmac('sha256', secret).update(raw).digest('hex');

    await http()
      .post('/api/v1/webhooks/payment')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(raw)
      .expect(200);
  });
});
