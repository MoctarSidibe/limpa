import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { items } = useCart();

  const isCourier = user?.role === 'COURIER' || user?.role === 'LIVREUR';
  const isBaker   = user?.role === 'BAKER'   || user?.role === 'BOULANGER';
  const isClient  = !isCourier && !isBaker;

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>

      {/* ── CLIENT TABS ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="home" color={color} />,
          href: isClient ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Portefeuille',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="wallet" color={color} />,
          href: isClient ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Panier',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="cart" color={color} />,
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          href: isClient ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="receipt-outline" color={color} />,
          href: isClient ? undefined : null,
        }}
      />

      {/* ── COURIER TAB ── */}
      <Tabs.Screen
        name="courier"
        options={{
          title: 'Mes Livraisons',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="bicycle" color={color} />,
          href: isCourier ? undefined : null,
        }}
      />

      {/* ── BAKER TAB ── */}
      <Tabs.Screen
        name="baker"
        options={{
          title: 'Mon Fournil',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="storefront" color={color} />,
          href: isBaker ? undefined : null,
        }}
      />
    </Tabs>
  );
}
