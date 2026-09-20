"use client";

import { create } from "zustand";

interface UiState {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

/**
 * Client-only UI state, kept out of the server-state cache. The drawer is
 * opened by the header and closed from links nested two levels inside it, so a
 * store saves threading `open`/`onClose` through every level.
 */
export const useUiStore = create<UiState>((set) => ({
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
}));
