"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** What we keep in the browser. Prices here are only a snapshot – the server always re-prices the cart. */
export type CartItem = { id: number; qty: number; name: string; image: string; slug: string; price: number; max: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  freeShippingThreshold: number;
};

const STORAGE_KEY = "mj_cart_v1";
const CartContext = createContext<CartContextValue | null>(null);

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && Number.isInteger(i.id) && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children, freeShippingThreshold }: { children: React.ReactNode; freeShippingThreshold: number }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setItems(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / storage full – the cart still works for this page view.
    }
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const clamp = (qty: number, max: number) => Math.max(1, Math.min(qty, max > 0 ? max : 99, 99));
    return {
      items,
      ready,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      add: (item, qty = 1) => {
        const existing = items.find((i) => i.id === item.id);
        const next = existing
          ? items.map((i) => (i.id === item.id ? { ...i, ...item, qty: clamp(i.qty + qty, item.max) } : i))
          : [...items, { ...item, qty: clamp(qty, item.max) }];
        persist(next);
        setDrawerOpen(true);
      },
      setQty: (id, qty) => persist(items.map((i) => (i.id === id ? { ...i, qty: clamp(qty, i.max) } : i))),
      remove: (id) => persist(items.filter((i) => i.id !== id)),
      clear: () => persist([]),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      freeShippingThreshold,
    };
  }, [items, ready, drawerOpen, persist, freeShippingThreshold]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
