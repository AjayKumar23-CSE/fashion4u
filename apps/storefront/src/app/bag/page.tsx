"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CartTotals } from "@/components/CartTotals";
import { CartError } from "@/lib/cart-client";
import {
  useApplyCoupon,
  useCart,
  useRemoveCoupon,
  useRemoveItem,
  useSetQty,
} from "@/lib/cart-queries";
import { formatPrice } from "@/lib/format";

const message = (error: Error | null) =>
  error instanceof CartError ? error.message : error ? "Something went wrong" : null;

export default function BagPage() {
  const { data: cart, isPending, error: loadError } = useCart();
  const setQty = useSetQty();
  const removeItem = useRemoveItem();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [code, setCode] = useState("");

  // Each action replaces the whole bag, so they are run one at a time.
  const actions = [setQty, removeItem, applyCoupon, removeCoupon];
  const busy = actions.some((action) => action.isPending);
  const error = message(actions.find((action) => action.error)?.error ?? null);

  if (isPending) {
    return <main className="px-4 py-16 text-center text-sm text-muted">Loading your bag…</main>;
  }
  if (!cart) {
    return <main className="px-4 py-16 text-center text-sm text-muted">{message(loadError)}</main>;
  }

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-headline font-semibold">Your bag is empty</h1>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 text-sm font-medium text-white">
          Start shopping
        </Link>
      </main>
    );
  }

  const outOfStock = cart.items.some((item) => !item.inStock);

  return (
    <main className="mx-auto w-full max-w-3xl pb-28">
      <h1 className="px-4 py-5 text-headline font-semibold">Bag ({cart.items.length})</h1>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {cart.items.map((item) => (
          <li key={item.id} className="flex gap-3 p-3">
            <Link href={`/product/${item.slug}/`} className="relative h-28 w-20 shrink-0 bg-surface">
              {item.image && <Image src={item.image.url} alt={item.image.alt} fill sizes="80px" className="object-cover" />}
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">{item.brand}</p>
              <Link href={`/product/${item.slug}/`} className="block truncate text-sm">
                {item.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted">
                Size {item.size} · {item.colour}
              </p>

              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-bold">{formatPrice(item.unitPrice)}</span>
                {item.discountPercent > 0 && <s className="text-xs text-muted">{formatPrice(item.mrp)}</s>}
              </div>

              {!item.inStock && (
                <p className="mt-1 text-xs font-semibold text-sale">
                  {item.available === 0 ? "Sold out" : `Only ${item.available} left`}
                </p>
              )}

              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center border border-hairline">
                  <button
                    type="button"
                    aria-label="Reduce quantity"
                    disabled={busy || item.qty <= 1}
                    onClick={() => setQty.mutate({ itemId: item.id, qty: item.qty - 1 })}
                    className="h-9 w-9 text-lg disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{item.qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={busy || item.qty >= item.available}
                    onClick={() => setQty.mutate({ itemId: item.id, qty: item.qty + 1 })}
                    className="h-9 w-9 text-lg disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeItem.mutate({ itemId: item.id })}
                  className="text-xs font-semibold text-muted underline"
                >
                  Remove
                </button>
              </div>
            </div>

            <p className="shrink-0 text-sm font-bold tabular-nums">{formatPrice(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <section className="p-4">
        {cart.coupon?.applied ? (
          <div className="flex items-center justify-between border border-green-300 bg-green-50 px-3 py-2 text-sm">
            <span className="font-semibold text-green-800">{cart.coupon.code} applied</span>
            <button type="button" disabled={busy} onClick={() => removeCoupon.mutate()} className="text-xs underline">
              Remove
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) applyCoupon.mutate({ code: code.trim() });
            }}
            className="flex gap-2"
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="h-11 flex-1 rounded-lg border border-hairline px-3 text-sm uppercase outline-none focus:border-ink"
            />
            <button type="submit" disabled={busy || !code.trim()} className="h-11 rounded-lg border border-ink px-4 text-sm font-medium disabled:opacity-40">
              Apply
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-sale">
            {error}
          </p>
        )}
      </section>

      <CartTotals totals={cart.totals} />

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-white p-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="text-sm">
            <p className="font-bold tabular-nums">{formatPrice(cart.totals.total)}</p>
            <p className="text-xs text-muted">incl. all taxes</p>
          </div>
          {outOfStock ? (
            <p className="flex-1 text-right text-xs font-semibold text-sale">Remove sold-out items to continue</p>
          ) : (
            <Link href="/checkout/" className="flex h-12 flex-1 items-center justify-center rounded-full bg-ink text-sm font-medium text-white transition-transform hover:scale-[1.01]">
              Place order
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
