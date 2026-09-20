import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ContentModule } from './content/content.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminModule,
    ContentModule,
    CatalogModule,
    PricingModule,
    PaymentsModule,
    CartModule,
    CheckoutModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
