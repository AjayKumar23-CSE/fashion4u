import type { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { apiValidationPipe } from './common/validation.pipe.js';

// Shared by main.ts and the e2e tests so both run the same pipeline.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    // The cart token is set by the API and read by the storefront.
    exposedHeaders: ['x-cart-token'],
    origin: process.env.CORS_ORIGINS?.split(','),
    credentials: true,
  });
  app.useGlobalPipes(apiValidationPipe);
  app.useGlobalFilters(new ApiExceptionFilter());
}
