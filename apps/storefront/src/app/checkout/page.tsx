"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { CartTotals } from "@/components/CartTotals";
import { CartError, checkoutApi, type CheckoutAddress, type PaymentMethod } from "@/lib/cart-client";
import { cartKeys, useCart } from "@/lib/cart-queries";
import { BRAND_NAME } from "@/lib/config";
import { formatPrice } from "@/lib/format";

// Razorpay's hosted checkout, loaded from their CDN. No card data ever reaches
// this site, which keeps the store out of PCI scope.
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  prefill: { name: string; contact: string; email?: string };
  theme: { color: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const EMPTY: CheckoutAddress = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY);
  const [method, setMethod] = useState<PaymentMethod>("PREPAID");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  // Switching the payment method swaps the cache key, so the recalculated
  // totals arrive without this page tracking a fetch of its own.
  const { data: cart, isPending } = useCart(method);

  // One key per attempt, so a double submit or a retry cannot order twice.
  const idempotencyKey = useRef(crypto.randomUUID());

  const set = (field: keyof CheckoutAddress, value: string) =>
    setAddress((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await checkoutApi.createOrder(address, method, idempotencyKey.current);

      if (!result.gateway) {
        // The bag was consumed by the order; the badge and /bag must not keep
        // showing the old contents.
        queryClient.removeQueries({ queryKey: cartKeys.all });
        router.push(`/orders/${result.orderNo}/`);
        return;
      }
      if (!window.Razorpay) {
        throw new Error("Payment window could not load. Check your connection and try again.");
      }

      const checkout = new window.Razorpay({
        key: result.gateway.keyId,
        order_id: result.gateway.orderId,
        amount: result.gateway.amount,
        currency: "INR",
        name: BRAND_NAME,
        prefill: { name: address.name, contact: address.phone, email: address.email || undefined },
        theme: { color: "#171717" },
        handler: async (response) => {
          try {
            // Confirms the payment for this page. The webhook is what actually
            // decides the order is paid, so a closed tab changes nothing.
            await checkoutApi.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch {
            // Payment went through; only our confirmation call failed.
          }
          queryClient.removeQueries({ queryKey: cartKeys.all });
          router.push(`/orders/${result.orderNo}/`);
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError("Payment was cancelled. Your bag is saved — you can try again.");
            // A fresh key, since the previous order is now abandoned.
            idempotencyKey.current = crypto.randomUUID();
          },
        },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof CartError ? err.message : (err as Error).message);
      setBusy(false);
    }
  }

  if (isPending || !cart) {
    return <main className="px-4 py-16 text-center text-sm text-muted">Loading…</main>;
  }
  if (cart.items.length === 0) {
    return <main className="px-4 py-16 text-center text-sm text-muted">Your bag is empty.</main>;
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setScriptReady(true)}
      />
      <main className="mx-auto w-full max-w-3xl pb-8">
        <h1 className="px-4 py-5 text-headline font-semibold">Checkout</h1>

        <form onSubmit={submit}>
          <section className="px-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Delivery address</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name" value={address.name} onChange={(v) => set("name", v)} required className="col-span-2" />
              <Field label="Mobile number" value={address.phone} onChange={(v) => set("phone", v)} required inputMode="numeric" maxLength={10} />
              <Field label="Email (optional)" type="email" value={address.email ?? ""} onChange={(v) => set("email", v)} />
              <Field label="Address" value={address.line1} onChange={(v) => set("line1", v)} required className="col-span-2" />
              <Field label="Landmark (optional)" value={address.line2 ?? ""} onChange={(v) => set("line2", v)} className="col-span-2" />
              <Field label="Pincode" value={address.pincode} onChange={(v) => set("pincode", v)} required inputMode="numeric" maxLength={6} />
              <Field label="City" value={address.city} onChange={(v) => set("city", v)} required />
              <Field label="State" value={address.state} onChange={(v) => set("state", v)} required className="col-span-2" />
            </div>
          </section>

          <section className="mt-6 px-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Payment</h2>
            <div className="space-y-2">
              <Choice
                checked={method === "PREPAID"}
                onChange={() => setMethod("PREPAID")}
                title="Pay online"
                note="UPI, cards, net banking and wallets. Extra discount applied."
              />
              <Choice
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
                title="Cash on delivery"
                note={cart.totals.codFee > 0 ? `${formatPrice(cart.totals.codFee)} handling fee` : "Pay when it arrives"}
              />
            </div>
          </section>

          <div className="mt-6">
            <CartTotals totals={cart.totals} />
          </div>

          {error && (
            <p role="alert" className="mx-4 mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="p-4">
            <button
              type="submit"
              disabled={busy || (method === "PREPAID" && !scriptReady)}
              className="h-12 w-full rounded-full bg-ink text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {busy
                ? "Please wait…"
                : method === "COD"
                  ? `Place order · ${formatPrice(cart.totals.total)}`
                  : `Pay ${formatPrice(cart.totals.total)}`}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  // The native onChange/value are replaced by the two props above.
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-hairline px-3 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

function Choice({
  checked,
  onChange,
  title,
  note,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  note: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 border p-3 ${checked ? "border-ink" : "border-hairline"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-neutral-900" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
    </label>
  );
}
