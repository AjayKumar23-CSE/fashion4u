import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { orNotFound } from "@/lib/or-not-found";

export const metadata: Metadata = { title: "Order confirmed" };

type Props = PageProps<"/orders/[orderNo]">;

const STATUS_NOTE: Record<string, string> = {
  PAYMENT_PENDING: "We are waiting for your payment to be confirmed. This usually takes a few seconds.",
  PAYMENT_FAILED: "That payment did not go through and the order was cancelled. Nothing has been charged.",
  PLACED: "We have your order and will confirm it shortly.",
  CONFIRMED: "Your order is confirmed and being packed.",
};

export default async function OrderPage({ params }: Props) {
  const { orderNo } = await params;
  const order = await orNotFound(api.order(orderNo));
  const paid = order.paymentStatus === "PAID";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="text-center">
        <p className="text-3xl">{order.status === "PAYMENT_FAILED" ? "✕" : "✓"}</p>
        <h1 className="mt-2 text-headline font-semibold">
          {order.status === "PAYMENT_FAILED" ? "Payment failed" : "Thank you for your order"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Order <span className="font-mono font-semibold">{order.orderNo}</span>
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {STATUS_NOTE[order.status] ?? "We will keep you posted on WhatsApp and SMS."}
        </p>
      </div>

      <ul className="mt-8 divide-y divide-hairline border-y border-hairline">
        {order.items.map((item) => (
          <li key={item.name} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {item.name}
              <span className="text-muted"> × {item.qty}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 text-sm">
        <div className="flex justify-between py-1 text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between py-1 text-green-700">
            <dt>Discount</dt>
            <dd className="tabular-nums">− {formatPrice(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between py-1 text-muted">
          <dt>Shipping</dt>
          <dd className="tabular-nums">{order.shipping === 0 ? "FREE" : formatPrice(order.shipping)}</dd>
        </div>
        {order.codFee > 0 && (
          <div className="flex justify-between py-1 text-muted">
            <dt>Cash on delivery fee</dt>
            <dd className="tabular-nums">{formatPrice(order.codFee)}</dd>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-hairline pt-3 font-semibold">
          <dt>{paid ? "Paid" : order.paymentMethod === "COD" ? "Pay on delivery" : "Amount"}</dt>
          <dd className="tabular-nums">{formatPrice(order.total)}</dd>
        </div>
      </dl>

      <section className="mt-8 text-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Delivering to</h2>
        <address className="mt-1 not-italic text-ink">
          {order.address.name}
          <br />
          {order.address.line1}
          {order.address.line2 ? `, ${order.address.line2}` : ""}
          <br />
          {order.address.city}, {order.address.state} {order.address.pincode}
          <br />
          {order.address.phone}
        </address>
      </section>

      <Link href="/" className="mt-10 inline-flex h-12 items-center rounded-full bg-ink px-6 text-sm font-medium text-white">
        Continue shopping
      </Link>
    </main>
  );
}
