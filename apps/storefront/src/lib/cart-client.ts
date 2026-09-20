"use client";

import { useCartToken } from "./cart-store";
import { PUBLIC_API_URL } from "./config";

export type PaymentMethod = "PREPAID" | "COD";

export interface CartLine {
  id: string;
  variantId: string;
  qty: number;
  size: string;
  colour: string;
  name: string;
  slug: string;
  brand: string;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  mrp: number;
  discountPercent: number;
  lineTotal: number;
  available: number;
  inStock: boolean;
}

export interface CartTotals {
  mrpTotal: number;
  subtotal: number;
  offer: { kind: "BUNDLE" | "COUPON"; label: string; amount: number } | null;
  discount: number;
  prepaidDiscount: number;
  shipping: number;
  codFee: number;
  total: number;
  totalSaving: number;
}

export interface Cart {
  token: string | null;
  items: CartLine[];
  coupon: { code: string; applied: boolean; expired?: boolean } | null;
  totals: CartTotals;
}

export class CartError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useCartToken.getState().token;
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-cart-token": token } : {}),
      ...init.headers,
    },
  });

  // The API issues the token on the first call and echoes it thereafter.
  const issued = res.headers.get("x-cart-token");
  if (issued && issued !== token) useCartToken.getState().setToken(issued);

  const data = await res.json();
  if (!res.ok) throw new CartError(data.code ?? "ERROR", data.message ?? "Something went wrong");
  return data as T;
}

export const cartApi = {
  get: (payment: PaymentMethod = "PREPAID") => request<Cart>(`/cart?payment=${payment}`),
  addItem: (variantId: string, qty = 1) =>
    request<Cart>("/cart/items", { method: "POST", body: JSON.stringify({ variantId, qty }) }),
  setQty: (itemId: string, qty: number) =>
    request<Cart>(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
  remove: (itemId: string) => request<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),
  applyCoupon: (code: string) =>
    request<Cart>("/cart/coupon", { method: "POST", body: JSON.stringify({ code }) }),
  removeCoupon: () => request<Cart>("/cart/coupon", { method: "DELETE" }),
};

export interface CheckoutAddress {
  name: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface CheckoutResult {
  orderNo: string;
  total: number;
  paymentMethod: string;
  status: string;
  gateway: { name: string; keyId: string; orderId: string; amount: number } | null;
}

export const checkoutApi = {
  createOrder: (address: CheckoutAddress, paymentMethod: PaymentMethod, idempotencyKey: string) =>
    request<CheckoutResult>("/checkout/orders", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify({ address, paymentMethod }),
    }),
  verify: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => request<{ orderNo: string }>("/checkout/verify", { method: "POST", body: JSON.stringify(payload) }),
};
