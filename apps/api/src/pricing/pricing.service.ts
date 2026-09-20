import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  calculateTotals,
  type BundleRule,
  type CouponRule,
  type PaymentChoice,
  type PriceableItem,
  type PricingConfig,
  type Totals,
} from './totals.js';

// Store-wide money settings, editable from admin later (A-13). The defaults
// apply until a row exists in `setting`.
const DEFAULTS: PricingConfig & { codMaxOrderValue: number } = {
  shippingFee: 7900,
  freeShippingThreshold: 99900,
  codFee: 4900,
  prepaidDiscountPercent: 5,
  codMaxOrderValue: 500000,
};

const SETTING_KEYS = {
  shippingFee: 'shipping_fee',
  freeShippingThreshold: 'free_shipping_threshold',
  codFee: 'cod_fee',
  prepaidDiscountPercent: 'prepaid_discount_percent',
  codMaxOrderValue: 'cod_max_order_value',
} as const;

export const cartItemInclude = {
  variant: {
    include: {
      product: {
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true, alt: true },
          },
          collections: { select: { collectionId: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

export const unitPriceOf = (item: CartItemWithProduct) =>
  item.variant.priceOverride ?? item.variant.product.salePrice;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async loadConfig(): Promise<PricingConfig & { codMaxOrderValue: number }> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const read = (key: string, fallback: number) => {
      const value = byKey.get(key);
      return typeof value === 'number' ? value : fallback;
    };

    return {
      shippingFee: read(SETTING_KEYS.shippingFee, DEFAULTS.shippingFee),
      freeShippingThreshold: read(
        SETTING_KEYS.freeShippingThreshold,
        DEFAULTS.freeShippingThreshold,
      ),
      codFee: read(SETTING_KEYS.codFee, DEFAULTS.codFee),
      prepaidDiscountPercent: read(
        SETTING_KEYS.prepaidDiscountPercent,
        DEFAULTS.prepaidDiscountPercent,
      ),
      codMaxOrderValue: read(
        SETTING_KEYS.codMaxOrderValue,
        DEFAULTS.codMaxOrderValue,
      ),
    };
  }

  private async loadBundles(): Promise<BundleRule[]> {
    const now = new Date();
    const rules = await this.prisma.offerRule.findMany({
      where: {
        type: 'BUNDLE',
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { priority: 'desc' },
    });

    return rules.flatMap((rule) => {
      const config = rule.config as {
        collectionId?: string;
        qty?: number;
        price?: number;
      };
      if (!config.collectionId || !config.qty || config.price === undefined)
        return [];
      return [
        {
          id: rule.id,
          name: rule.name,
          collectionId: config.collectionId,
          qty: config.qty,
          price: config.price,
        },
      ];
    });
  }

  /** Returns the coupon only if it is currently usable, otherwise null. */
  async loadCoupon(code: string | null): Promise<CouponRule | null> {
    if (!code) return null;
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });
    if (!coupon) return null;

    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minBag: coupon.minBag,
      maxDiscount: coupon.maxDiscount,
    };
  }

  toPriceableItems(items: CartItemWithProduct[]): PriceableItem[] {
    return items.map((item) => ({
      variantId: item.variantId,
      qty: item.qty,
      unitPrice: unitPriceOf(item),
      mrp: item.variant.product.mrp,
      collectionIds: item.variant.product.collections.map(
        (c) => c.collectionId,
      ),
    }));
  }

  // The single place totals are produced, for the bag and for order creation,
  // so the browser can never influence the amount that is charged.
  async priceItems(
    items: CartItemWithProduct[],
    options: { couponCode?: string | null; payment?: PaymentChoice } = {},
  ): Promise<Totals> {
    const [config, bundles, coupon] = await Promise.all([
      this.loadConfig(),
      this.loadBundles(),
      this.loadCoupon(options.couponCode ?? null),
    ]);

    return calculateTotals({
      items: this.toPriceableItems(items),
      bundles,
      coupon,
      config,
      payment: options.payment ?? 'PREPAID',
    });
  }
}
