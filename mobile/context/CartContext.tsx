import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = '@limpa_cart';

export type CartItem = {
  id: string;
  title: string;
  priceValue: number;
  image: any;
  quantity: number;
  bakeryId?: string | null;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore cart from AsyncStorage on launch
  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then(raw => {
        if (raw) {
          const saved = JSON.parse(raw) as CartItem[];
          // Images can't be serialized — strip them, will use fallback in ProductCard
          setItems(saved.map(i => ({ ...i, image: null })));
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // Persist cart whenever it changes (after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    // Strip image refs before storing (not JSON-serializable)
    const serializable = items.map(({ image, ...rest }) => rest);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(serializable)).catch(() => {});
  }, [items, hydrated]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setItems(current => {
      const existing = current.find(i => i.id === newItem.id);
      if (existing) {
        return current.map(i => i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...current, { ...newItem, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems(current => {
      const existing = current.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return current.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return current.filter(i => i.id !== id);
    });
  };

  const clearCart = () => {
    setItems([]);
    AsyncStorage.removeItem(CART_KEY).catch(() => {});
  };

  const total = items.reduce((sum, item) => sum + (item.priceValue * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
}
