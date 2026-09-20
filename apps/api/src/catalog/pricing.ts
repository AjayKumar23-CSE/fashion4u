// Discount badge shown on product cards, computed from MRP and sale price (paise).
export function discountPercent(mrp: number, salePrice: number): number {
  if (mrp <= 0 || salePrice >= mrp) return 0;
  return Math.round(((mrp - salePrice) / mrp) * 100);
}
