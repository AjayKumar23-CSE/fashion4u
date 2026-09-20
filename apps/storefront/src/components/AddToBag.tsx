"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CartError } from "@/lib/cart-client";
import { useAddItem } from "@/lib/cart-queries";

interface Variant {
  id: string;
  size: string;
  available: number;
}

export function AddToBag({ variants }: { variants: Variant[] }) {
  const router = useRouter();
  const inStock = variants.filter((variant) => variant.available > 0);
  const [selected, setSelected] = useState<string | null>(inStock.length === 1 ? inStock[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const addItem = useAddItem();

  function addToBag() {
    if (!selected) {
      setError("Choose a size");
      return;
    }
    setError(null);
    addItem.mutate(
      { variantId: selected },
      {
        // The bag page reads the updated cart straight from the cache, so it
        // renders with the new item already in it.
        onSuccess: () => router.push("/bag/"),
        onError: (err) =>
          setError(err instanceof CartError ? err.message : "Could not add to bag"),
      },
    );
  }

  return (
    <>
      <h2 className="mt-8 text-sm font-medium">Select a size</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {variants.map((variant) => {
          const soldOut = variant.available <= 0;
          return (
            <li key={variant.id}>
              <button
                type="button"
                disabled={soldOut}
                aria-pressed={selected === variant.id}
                onClick={() => {
                  setSelected(variant.id);
                  setError(null);
                }}
                className={`flex h-11 min-w-12 items-center justify-center rounded-lg border text-sm transition-colors ${
                  soldOut
                    ? "cursor-not-allowed border-hairline text-muted/50 line-through"
                    : selected === variant.id
                      ? "border-ink bg-ink text-white"
                      : "border-hairline hover:border-ink"
                }`}
              >
                {variant.size}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm text-sale">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={addToBag}
        disabled={addItem.isPending || inStock.length === 0}
        className="mt-6 h-12 w-full rounded-full bg-ink text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
      >
        {inStock.length === 0 ? "Sold out" : addItem.isPending ? "Adding…" : "Add to bag"}
      </button>
    </>
  );
}
