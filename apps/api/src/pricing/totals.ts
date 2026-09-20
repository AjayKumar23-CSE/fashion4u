// Every amount here is an integer in paise. This file is deliberately pure: it
// takes the cart and the rules and returns the breakdown, so the same numbers
// can be recomputed for the bag, for the order and in tests.

export interface PriceableItem {
  variantId: string;
  qty: number;
  /** Sale price of one unit, after any variant-level override. */
  unitPrice: number;
  /** MRP of one unit, used only to show the customer what they saved. */
  mrp: number;
  collectionIds: string[];
}

/** "Buy `qty` from this collection for `price`." */
export interface BundleRule {
  id: string;
  name: string;
  collectionId: string;
  qty: number;
  price: number;
}

export interface CouponRule {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minBag: number;
  maxDiscount: number | null;
}

export interface PricingConfig {
  shippingFee: number;
  freeShippingThreshold: number;
  codFee: number;
  prepaidDiscountPercent: number;
}

export type PaymentChoice = 'PREPAID' | 'COD';

export interface Totals {
  mrpTotal: number;
  subtotal: number;
  /** Which automatic or coupon offer was applied, and what it saved. */
  offer: { kind: 'BUNDLE' | 'COUPON'; label: string; amount: number } | null;
  discount: number;
  prepaidDiscount: number;
  shipping: number;
  codFee: number;
  total: number;
  /** Everything the customer saved against MRP. */
  totalSaving: number;
}

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

// Spread a bundle rule over the eligible units, most expensive first, so the
// customer gets the largest saving the rule can give.
function bundleDiscount(items: PriceableItem[], rule: BundleRule): number {
  const units: number[] = [];
  for (const item of items) {
    if (!item.collectionIds.includes(rule.collectionId)) continue;
    for (let i = 0; i < item.qty; i += 1) units.push(item.unitPrice);
  }
  if (units.length < rule.qty) return 0;

  units.sort((a, b) => b - a);
  let discount = 0;
  for (let start = 0; start + rule.qty <= units.length; start += rule.qty) {
    const group = sum(units.slice(start, start + rule.qty));
    if (group > rule.price) discount += group - rule.price;
  }
  return discount;
}

function couponDiscount(subtotal: number, coupon: CouponRule | null): number {
  if (!coupon || subtotal < coupon.minBag) return 0;
  const raw =
    coupon.type === 'PERCENT'
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.min(capped, subtotal);
}

export function calculateTotals(input: {
  items: PriceableItem[];
  bundles: BundleRule[];
  coupon: CouponRule | null;
  config: PricingConfig;
  payment: PaymentChoice;
}): Totals {
  const { items, bundles, coupon, config, payment } = input;

  const mrpTotal = sum(items.map((item) => item.mrp * item.qty));
  const subtotal = sum(items.map((item) => item.unitPrice * item.qty));

  // One bundle offer per order: the rule that saves the most.
  let best: Totals['offer'] = null;
  for (const rule of bundles) {
    const amount = bundleDiscount(items, rule);
    if (amount > (best?.amount ?? 0)) {
      best = { kind: 'BUNDLE', label: rule.name, amount };
    }
  }

  // Bundle and coupon do not stack — the better one wins (C-10).
  const couponAmount = couponDiscount(subtotal, coupon);
  if (coupon && couponAmount > (best?.amount ?? 0)) {
    best = { kind: 'COUPON', label: coupon.code, amount: couponAmount };
  }

  const discount = best?.amount ?? 0;
  const afterDiscount = subtotal - discount;

  // Prepaid discount rewards not choosing COD, so it is applied last and only
  // to what is actually payable for the goods.
  const prepaidDiscount =
    payment === 'PREPAID' && config.prepaidDiscountPercent > 0
      ? Math.round((afterDiscount * config.prepaidDiscountPercent) / 100)
      : 0;

  const shipping =
    afterDiscount >= config.freeShippingThreshold ? 0 : config.shippingFee;
  const codFee = payment === 'COD' ? config.codFee : 0;

  const total = afterDiscount - prepaidDiscount + shipping + codFee;

  return {
    mrpTotal,
    subtotal,
    offer: best,
    discount,
    prepaidDiscount,
    shipping,
    codFee,
    total,
    totalSaving: mrpTotal - subtotal + discount + prepaidDiscount,
  };
}

/** GST is included in the price shown, so it is extracted, not added. */
export function gstIncludedIn(amount: number, ratePercent: number): number {
  return Math.round((amount * ratePercent) / (100 + ratePercent));
}
