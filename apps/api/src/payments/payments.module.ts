import { Global, Module } from '@nestjs/common';
import { PAYMENT_GATEWAY } from './gateway.js';
import { RazorpayService } from './razorpay.service.js';

@Global()
@Module({
  providers: [
    RazorpayService,
    { provide: PAYMENT_GATEWAY, useExisting: RazorpayService },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
