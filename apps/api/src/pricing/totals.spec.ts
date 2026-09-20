import { calculateTotals, gstIncludedIn } from './totals.js';
import type { BundleRule, PriceableItem, PricingConfig } from './totals.js';

const rupees = (amount: number) => amount * 100;

const config: PricingConfig = {
  shippingFee: rupees(79),
  freeShippingThreshold: rupees(999),
  codFee: rupees(49),
  prepaidDiscountPercent: 5,
};

const tank = (qty: number): PriceableItem => ({
  variantId: `tank-${qty}`,
  qty,
  unitPrice: rupees(449),
  mrp: rupees(999),
  collectionIds: ['tanks'],
});

// The offer seeded from the reference store: any 4 Summer Tanks for 999.
const bundle: BundleRule = {
  id: 'b1',
  name: 'Buy any 4 Summer Tanks at ₹999',
  collectionId: 'tanks',
  qty: 4,
  price: rupees(999),
};

const totalsFor = (
  items: PriceableItem[],
  extra: Partial<Parameters<typeof calculateTotals>[0]> = {},
) =>
  calculateTotals({
    items,
    bundles: [bundle],
    coupon: null,
    config,
    payment: 'PREPAID',
    ...extra,
  });

describe('calculateTotals', () => {
  it('leaves a bag below the bundle size alone', () => {
    const totals = totalsFor([tank(3)]);
    expect(totals.subtotal).toBe(rupees(1347));
    expect(totals.offer).toBeNull();
  });

  it('applies the bundle once four items qualify', () => {
    const totals = totalsFor([tank(4)]);
    expect(totals.offer).toMatchObject({ kind: 'BUNDLE', amount: rupees(797) });
    expect(totals.subtotal - totals.discount).toBe(rupees(999));
  });

  it('applies the bundle twice for eight items and leaves the remainder', () => {
    const totals = totalsFor([tank(9)]);
    // 8 units bundled into two groups of 999, the 9th at full price.
    expect(totals.subtotal - totals.discount).toBe(rupees(999 * 2 + 449));
  });

  it('ignores items outside the collection', () => {
    const jeans: PriceableItem = {
      variantId: 'jeans',
      qty: 4,
      unitPrice: rupees(999),
      mrp: rupees(1999),
      collectionIds: [],
    };
    expect(totalsFor([jeans]).offer).toBeNull();
  });

  it('keeps the better of a bundle and a coupon rather than stacking them', () => {
    const items = [tank(4)];
    const small = totalsFor(items, {
      coupon: {
        code: 'SAVE10',
        type: 'PERCENT',
        value: 10,
        minBag: 0,
        maxDiscount: null,
      },
    });
    // 10% of 1796 = 179.60, less than the bundle's 797, so the bundle wins.
    expect(small.offer).toMatchObject({ kind: 'BUNDLE' });
    expect(small.discount).toBe(rupees(797));

    const large = totalsFor(items, {
      coupon: {
        code: 'HALF',
        type: 'PERCENT',
        value: 50,
        minBag: 0,
        maxDiscount: null,
      },
    });
    expect(large.offer).toMatchObject({ kind: 'COUPON', label: 'HALF' });
    expect(large.discount).toBe(rupees(898));
  });

  it('respects a coupon minimum and its cap', () => {
    const below = totalsFor([tank(1)], {
      coupon: {
        code: 'BIG',
        type: 'FLAT',
        value: rupees(200),
        minBag: rupees(1000),
        maxDiscount: null,
      },
    });
    expect(below.discount).toBe(0);

    const capped = totalsFor([tank(1)], {
      coupon: {
        code: 'CAP',
        type: 'PERCENT',
        value: 50,
        minBag: 0,
        maxDiscount: rupees(100),
      },
    });
    expect(capped.discount).toBe(rupees(100));
  });

  it('charges shipping under the threshold and drops it above', () => {
    expect(totalsFor([tank(1)]).shipping).toBe(rupees(79));
    // Four tanks cost 999 after the bundle, which meets the threshold exactly.
    expect(totalsFor([tank(4)]).shipping).toBe(0);
  });

  it('adds the COD fee and withholds the prepaid discount for COD', () => {
    const cod = totalsFor([tank(1)], { payment: 'COD' });
    expect(cod.codFee).toBe(rupees(49));
    expect(cod.prepaidDiscount).toBe(0);
    expect(cod.total).toBe(rupees(449 + 79 + 49));

    const prepaid = totalsFor([tank(1)]);
    expect(prepaid.codFee).toBe(0);
    expect(prepaid.prepaidDiscount).toBe(rupees(22.45));
    expect(prepaid.total).toBe(rupees(449) - rupees(22.45) + rupees(79));
  });

  it('reports everything saved against MRP', () => {
    const totals = totalsFor([tank(4)]);
    // Four tanks list at 3996 and cost 999 after the bundle, less the 5%
    // prepaid discount, so the customer pays 949.05 for the goods.
    const paidForGoods =
      totals.subtotal - totals.discount - totals.prepaidDiscount;
    expect(totals.mrpTotal).toBe(rupees(3996));
    expect(paidForGoods).toBe(rupees(949.05));
    expect(totals.totalSaving).toBe(totals.mrpTotal - paidForGoods);
  });

  it('never returns a negative total', () => {
    const totals = totalsFor([tank(1)], {
      coupon: {
        code: 'ALL',
        type: 'FLAT',
        value: rupees(10000),
        minBag: 0,
        maxDiscount: null,
      },
    });
    expect(totals.discount).toBe(rupees(449));
    expect(totals.total).toBe(rupees(79));
  });
});

describe('gstIncludedIn', () => {
  it('extracts tax from a tax-inclusive price', () => {
    // 5% GST inside 449: 449 * 5 / 105
    expect(gstIncludedIn(rupees(449), 5)).toBe(2138);
    expect(gstIncludedIn(rupees(999), 12)).toBe(10704);
  });
});
