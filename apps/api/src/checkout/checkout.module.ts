import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { PaymentTimeoutService } from './payment-timeout.service.js';

@Module({
  imports: [CartModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PaymentTimeoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
