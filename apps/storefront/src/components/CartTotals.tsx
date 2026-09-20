import type { CartTotals as Totals } from "@/lib/cart-client";
import { formatPrice } from "@/lib/format";

function Row({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${muted ? "text-muted" : ""} ${accent ? "text-green-700" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function CartTotals({ totals }: { totals: Totals }) {
  return (
    <dl className="px-4 text-sm">
      <Row label="Bag total (MRP)" value={formatPrice(totals.mrpTotal)} muted />
      <Row label="Product discount" value={`− ${formatPrice(totals.mrpTotal - totals.subtotal)}`} accent />
      {totals.offer && (
        <Row label={totals.offer.label} value={`− ${formatPrice(totals.offer.amount)}`} accent />
      )}
      {totals.prepaidDiscount > 0 && (
        <Row label="Prepaid discount" value={`− ${formatPrice(totals.prepaidDiscount)}`} accent />
      )}
      <Row label="Shipping" value={totals.shipping === 0 ? "FREE" : formatPrice(totals.shipping)} />
      {totals.codFee > 0 && <Row label="Cash on delivery fee" value={formatPrice(totals.codFee)} />}
      <div className="mt-3 flex justify-between border-t border-hairline pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatPrice(totals.total)}</dd>
      </div>
      {totals.totalSaving > 0 && (
        <p className="mt-2 bg-green-50 px-2 py-1 text-center text-xs font-semibold text-green-800">
          You save {formatPrice(totals.totalSaving)} on this order
        </p>
      )}
    </dl>
  );
}
