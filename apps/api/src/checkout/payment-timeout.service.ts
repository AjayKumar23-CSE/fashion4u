import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckoutService, RESERVATION_MINUTES } from './checkout.service.js';

// If payment never completes, the order is failed and its stock goes back on
// sale. Without this, an abandoned checkout would hold stock forever.
@Injectable()
export class PaymentTimeoutService {
  private readonly logger = new Logger(PaymentTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredReservations() {
    const cutoff = new Date(Date.now() - RESERVATION_MINUTES * 60_000);
    const expired = await this.prisma.order.findMany({
      where: { status: 'PAYMENT_PENDING', placedAt: { lt: cutoff } },
      include: { payments: true },
    });
    if (expired.length === 0) return;

    for (const order of expired) {
      try {
        await this.checkout.releaseOrder(
          order.id,
          order.payments[0]?.id ?? null,
          {
            reason: 'reservation expired',
          },
        );
      } catch (error) {
        this.logger.error(`Could not release ${order.orderNo}`, error);
      }
    }
    this.logger.log(`Released ${expired.length} expired reservation(s)`);
  }
}
