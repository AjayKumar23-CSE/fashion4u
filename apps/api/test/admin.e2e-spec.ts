import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

// Needs the database running and seeded (the seed creates the owner account).
describe('Admin API (e2e)', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };
  const created: { productId?: string; categoryId?: string } = {};

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    // ConfigModule has loaded .env into process.env by now.
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    auth = { Authorization: `Bearer ${res.body.token}` };
  });

  afterAll(async () => {
    const http = request(app.getHttpServer());
    if (created.productId) {
      await http
        .delete(`/api/v1/admin/products/${created.productId}`)
        .set(auth);
    }
    if (created.categoryId) {
      await http
        .delete(`/api/v1/admin/categories/${created.categoryId}`)
        .set(auth);
    }
    await app.close();
  });

  it('rejects admin routes without a staff token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set({ Authorization: 'Bearer not-a-token' })
      .expect(401);
  });

  it('does not say whether the email or the password was wrong', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('creates a category and a product that the storefront then lists', async () => {
    const http = request(app.getHttpServer());
    const categories = await http.get('/api/v1/admin/categories').set(auth);
    const men = categories.body.find((c: { slug: string }) => c.slug === 'men');

    const category = await http
      .post('/api/v1/admin/categories')
      .set(auth)
      .send({ name: 'E2E Jeans', parentId: men.id })
      .expect(201);
    created.categoryId = category.body.id;
    expect(category.body.slug).toBe('e2e-jeans');

    const product = await http
      .post('/api/v1/admin/products')
      .set(auth)
      .send({
        name: 'E2E Indigo Jeans',
        brand: 'Test',
        mrp: 199900,
        salePrice: 99900,
        categoryId: category.body.id,
        status: 'ACTIVE',
        images: [{ url: 'https://example.com/jeans.jpg' }],
        variants: [
          { size: '32', colour: 'Indigo', stock: 3 },
          { size: '30', colour: 'Indigo', stock: 0 },
        ],
      })
      .expect(201);
    created.productId = product.body.id;
    expect(product.body.variants.map((v: { size: string }) => v.size)).toEqual([
      '30',
      '32',
    ]);

    const listing = await http
      .get('/api/v1/products?category=men/e2e-jeans')
      .expect(200);
    expect(listing.body.items[0]).toMatchObject({
      name: 'E2E Indigo Jeans',
      discountPercent: 50,
      soldOut: false,
    });
  });

  it('rejects a sale price above MRP on the salePrice field', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${created.productId}`)
      .set(auth)
      .send({ salePrice: 299900 })
      .expect(400);
    expect(res.body.fields.salePrice).toBeDefined();
  });

  it('hides a draft product from the storefront', async () => {
    const http = request(app.getHttpServer());
    await http
      .patch(`/api/v1/admin/products/${created.productId}`)
      .set(auth)
      .send({ status: 'DRAFT' })
      .expect(200);

    const listing = await http.get('/api/v1/products?category=men/e2e-jeans');
    expect(listing.body.total).toBe(0);
  });

  it('refuses to delete a category that still has products', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${created.categoryId}`)
      .set(auth)
      .expect(409);
    expect(res.body.code).toBe('CATEGORY_IN_USE');
  });
});
