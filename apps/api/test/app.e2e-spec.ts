import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

// Needs the database from DATABASE_URL to be running and seeded.
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /products lists a category', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products?category=men/tank-tops')
      .expect(200);

    expect(res.body.category.name).toBe('Summer Tanks');
    expect(res.body.items[0].discountPercent).toBe(55);
  });

  it('GET /products rejects bad input in the shared error shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products?sort=bogus')
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields.sort).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
