import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [CheckoutModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
