"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartLine, CartProduct } from "@/lib/types";
import { CART_STORAGE_KEY, readFromStorage, writeToStorage } from "@/lib/storage";

type Snapshot = Pick<CartProduct, "id" | "slug" | "title" | "priceCents" | "image">;
type Stored = { lines: CartLine[]; snapshots: Record<string, Snapshot> };

type CartContextValue = {
  lines: CartLine[];
  /** Latest server view of each product (price, stock); falls back to the snapshot taken when added. */
  products: Record<string, CartProduct | Snapshot>;
  verified: Record<string, CartProduct>;
  count: number;
  subtotalCents: number;
  checkoutEnabled: boolean | null;
  loading: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (product: Snapshot, max?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const EMPTY: Stored = { lines: [], snapshots: {} };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [verified, setVerified] = useState<Record<string, CartProduct>>({});
  const [checkoutEnabled, setCheckoutEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const lastIds = useRef("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setState(readFromStorage<Stored>(CART_STORAGE_KEY, EMPTY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeToStorage(CART_STORAGE_KEY, state);
  }, [state, hydrated]);

  const refresh = useCallback(async () => {
    const ids = state.lines.map((l) => l.productId).join(",");
    setLoading(true);
    try {
      const res = await fetch(`/api/cart?ids=${encodeURIComponent(ids)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: CartProduct[]; checkoutEnabled: boolean };
      const byId = Object.fromEntries(data.items.map((p) => [p.id, p]));
      setVerified(byId);
      setCheckoutEnabled(data.checkoutEnabled);
      // Drop lines for products that no longer exist; clamp to stock.
      setState((cur) => ({
        snapshots: cur.snapshots,
        lines: cur.lines
          .filter((l) => byId[l.productId])
          .map((l) => ({ ...l, quantity: Math.min(l.quantity, Math.max(1, byId[l.productId].available)) })),
      }));
      lastIds.current = ids;
    } catch {
      // offline: keep showing the snapshot
    } finally {
      setLoading(false);
    }
  }, [state.lines]);

  useEffect(() => {
    if (!hydrated) return;
    const ids = state.lines.map((l) => l.productId).join(",");
    if (ids !== lastIds.current && (isOpen || checkoutEnabled === null)) void refresh();
  }, [hydrated, isOpen, state.lines, refresh, checkoutEnabled]);

  const add = useCallback((product: Snapshot, max = 1) => {
    setState((cur) => {
      const existing = cur.lines.find((l) => l.productId === product.id);
      const lines = existing
        ? cur.lines.map((l) => (l.productId === product.id ? { ...l, quantity: Math.min(max, l.quantity + 1) } : l))
        : [...cur.lines, { productId: product.id, quantity: 1 }];
      return { lines, snapshots: { ...cur.snapshots, [product.id]: product } };
    });
    setOpen(true);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setState((cur) => ({ ...cur, lines: cur.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0) }));
  }, []);

  const remove = useCallback((productId: string) => {
    setState((cur) => {
      const snapshots = { ...cur.snapshots };
      delete snapshots[productId];
      return { lines: cur.lines.filter((l) => l.productId !== productId), snapshots };
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const products: Record<string, CartProduct | Snapshot> = { ...state.snapshots, ...verified };
    return {
      lines: state.lines,
      products,
      verified,
      count: state.lines.reduce((s, l) => s + l.quantity, 0),
      subtotalCents: state.lines.reduce((s, l) => s + (products[l.productId]?.priceCents ?? 0) * l.quantity, 0),
      checkoutEnabled,
      loading,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add,
      setQuantity,
      remove,
      clear,
      refresh,
    };
  }, [state, verified, checkoutEnabled, loading, isOpen, add, setQuantity, remove, clear, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
