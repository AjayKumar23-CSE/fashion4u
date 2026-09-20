"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartApi, type Cart, type PaymentMethod } from "./cart-client";

// Totals differ by payment method (COD handling fee, prepaid discount), so the
// method is part of the key rather than something the cache has to guess at.
export const cartKeys = {
  all: ["cart"] as const,
  byPayment: (payment: PaymentMethod) => ["cart", payment] as const,
};

export function useCart(payment: PaymentMethod = "PREPAID") {
  return useQuery({
    queryKey: cartKeys.byPayment(payment),
    queryFn: () => cartApi.get(payment),
    // Switching between COD and prepaid keeps the bag on screen while the new
    // totals load, instead of dropping back to a blank page.
    placeholderData: keepPreviousData,
  });
}

/** Total units in the bag — what the header badge counts. */
export function useBagCount(): number {
  const { data } = useCart();
  return data?.items.reduce((count, item) => count + item.qty, 0) ?? 0;
}

/**
 * Every cart endpoint answers with the whole recalculated bag, so the response
 * is written straight into the cache: no refetch round trip, and the totals on
 * screen are always the ones the server will charge.
 */
function useCartMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<Cart>,
  payment: PaymentMethod,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKeys.byPayment(payment), cart);
      // Only the *other* method is stale — invalidating everything would mark
      // the entry just written as stale too and refetch it on the next screen.
      const other: PaymentMethod = payment === "PREPAID" ? "COD" : "PREPAID";
      queryClient.invalidateQueries({ queryKey: cartKeys.byPayment(other), refetchType: "none" });
    },
  });
}

export const useAddItem = (payment: PaymentMethod = "PREPAID") =>
  useCartMutation(
    ({ variantId, qty = 1 }: { variantId: string; qty?: number }) => cartApi.addItem(variantId, qty),
    payment,
  );

export const useSetQty = (payment: PaymentMethod = "PREPAID") =>
  useCartMutation(
    ({ itemId, qty }: { itemId: string; qty: number }) => cartApi.setQty(itemId, qty),
    payment,
  );

export const useRemoveItem = (payment: PaymentMethod = "PREPAID") =>
  useCartMutation(({ itemId }: { itemId: string }) => cartApi.remove(itemId), payment);

export const useApplyCoupon = (payment: PaymentMethod = "PREPAID") =>
  useCartMutation(({ code }: { code: string }) => cartApi.applyCoupon(code), payment);

export const useRemoveCoupon = (payment: PaymentMethod = "PREPAID") =>
  useCartMutation<void>(() => cartApi.removeCoupon(), payment);
