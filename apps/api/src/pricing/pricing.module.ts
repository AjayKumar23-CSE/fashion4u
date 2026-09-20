import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service.js';

// Global: the bag, checkout and orders must all price through the same service.
@Global()
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
