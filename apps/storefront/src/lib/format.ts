// Money travels as integer paise; the storefront shows whole rupees.
export function formatPrice(paise: number): string {
  return `₹ ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
