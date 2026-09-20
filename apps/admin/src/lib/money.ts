// The API stores money as integer paise; staff type and read rupees.
export const toPaise = (rupees: string) => Math.round(Number(rupees) * 100)
export const toRupees = (paise: number) => String(paise / 100)
export const formatPrice = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function discountPercent(mrp: number, salePrice: number): number {
  if (mrp <= 0 || salePrice >= mrp) return 0
  return Math.round(((mrp - salePrice) / mrp) * 100)
}
