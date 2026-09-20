"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CartTokenState {
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
}

/**
 * The guest's bag is identified by a token the API issues on first contact and
 * echoes back thereafter. Signing in will later merge it into the account.
 *
 * It lives in a store rather than a hook because the fetch wrapper needs it on
 * every request; `useCartToken.getState()` reads it from outside React, and
 * `persist` keeps the bag across visits without hand-written localStorage.
 */
export const useCartToken = create<CartTokenState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clear: () => set({ token: null }),
    }),
    {
      name: "fashion4u.cart",
      // Private browsing can block storage entirely; the bag then lasts for
      // this page only rather than throwing on every read.
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
