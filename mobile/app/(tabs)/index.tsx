import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, Alert, ActivityIndicator,
  RefreshControl, Pressable, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/ProductCard';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/constants/api';
import * as Location from 'expo-location';

import { getProductImage } from '@/constants/productImages';
const BRAND = '#D4A46C';

type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  category: string | null;
  bakeryId?: string | null;
};

const FALLBACK_PRODUCTS: Product[] = [
  { id: 'prod_croissant', name: 'Croissant au beurre',  price: 700,  description: "Croissant frais et croustillant fait maison.", image: 'croissant' },
  { id: 'prod_pain',      name: 'Pain de campagne',     price: 1500, description: 'Pain au levain naturel, croûte épaisse.',    image: 'bread'     },
  { id: 'prod_baguette',  name: 'Baguette Tradition',   price: 500,  description: 'Farine de blé sélectionnée, croûte craquante.', image: 'baguette' },
  { id: 'prod_eclair',    name: 'Éclair au Chocolat',   price: 900,  description: 'Pâte à choux, crème pâtissière au chocolat.', image: 'eclair'   },
];


// ── Seeded RNG ────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── Jittered-grid scatter: evenly distributed, no visible rows ────
// Divides screen into cells, places one item randomly inside each cell.
const BG_EMOJIS = ['🥐', '🥖', '🍞', '🍰', '🥨', '🥪', '🌾', '🧁', '🍪'];
const COLS = 4;
const ROWS = 11;
const CELL_W = 100;
const CELL_H = 85;

function buildScatter() {
  const rng = makeRng(42);
  // Shuffle emoji sequence per row so same emoji doesn't repeat in a column
  const result = [];
  for (let r = 0; r < ROWS; r++) {
    // Rotate emoji list by row so columns vary
    const rowEmojis = [...BG_EMOJIS.slice(r % BG_EMOJIS.length), ...BG_EMOJIS.slice(0, r % BG_EMOJIS.length)];
    for (let c = 0; c < COLS; c++) {
      const pad = 8;
      result.push({
        emoji: rowEmojis[c % rowEmojis.length],
        top:   r * CELL_H + pad + rng() * (CELL_H - pad * 2),
        left:  c * CELL_W + pad + rng() * (CELL_W - pad * 2),
        size:  22 + rng() * 24,       // range 22–46px
        rotate:`${(rng() - 0.5) * 52}deg`,
        opacity: 0.055 + rng() * 0.035, // slight opacity variation 5.5–9%
      });
    }
  }
  return result;
}

const SCATTER = buildScatter();

function BackgroundPattern() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SCATTER.map((item, i) => (
        <Text key={i} style={{
          position: 'absolute',
          top:     item.top,
          left:    item.left,
          fontSize: item.size,
          opacity:  item.opacity,
          transform: [{ rotate: item.rotate }],
        }}>
          {item.emoji}
        </Text>
      ))}
    </View>
  );
}

// ── Categories ────────────────────────────────────────────────────
type Category = { id: string; label: string; emoji: string; keys: string[] };

const CATEGORIES: Category[] = [
  { id: 'all',          label: 'Tout',        emoji: '',   keys: [] },
  { id: 'pain',         label: 'Pains',       emoji: '🥖', keys: ['baguette', 'bread'] },
  { id: 'viennoiserie', label: 'Viennoiseries',emoji: '🥐', keys: ['croissant', 'palmier'] },
  { id: 'patisserie',   label: 'Pâtisseries', emoji: '🍰', keys: ['eclair', 'tarte'] },
  { id: 'sale',         label: 'Sandwichs',   emoji: '🥪', keys: ['sandwich'] },
];

const TOUT_ICONS = ['🥖', '🥐', '🍰', '🥪'];

function filterProducts(products: Product[], catId: string): Product[] {
  if (catId === 'all') return products;
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return products;
  return products.filter(p =>
    (p.category && p.category === catId) || cat.keys.includes(p.image ?? '')
  );
}

function CategoryRow({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <View style={styles.catRow}>
      {CATEGORIES.map(cat => {
        const isActive = active === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.catCard,
              isActive
                ? { backgroundColor: BRAND, shadowColor: BRAND, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }
                : { backgroundColor: '#FFFFFF', borderColor: '#E8DDD0', borderWidth: 1 },
            ]}
          >
            {cat.id === 'all' ? (
              <View style={[styles.catIconWrap, { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : '#FAF0E6' }]}>
                <View style={styles.miniGrid}>
                  {TOUT_ICONS.map((e, i) => (
                    <Text key={i} style={styles.miniEmoji}>{e}</Text>
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.catIconWrap, { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : '#FAF0E6' }]}>
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
              </View>
            )}
            <Text
              style={[styles.catLabel, { color: isActive ? '#FFF' : '#4A3B32' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Compact horizontal specialty card ────────────────────────────
function SpecialtyCard({ product, qty, onAdd, theme }: {
  product: Product; qty: number; onAdd: () => void; theme: any;
}) {
  return (
    <Pressable onPress={onAdd} style={[
      specialtyStyles.card,
      { backgroundColor: theme.card, borderColor: qty > 0 ? BRAND : theme.border },
    ]}>
      <Image source={getProductImage(product.image)} style={specialtyStyles.img} resizeMode="cover" />
      {qty > 0 && (
        <View style={specialtyStyles.qtyBadge}>
          <Text style={specialtyStyles.qtyBadgeText}>{qty}</Text>
        </View>
      )}
      <View style={specialtyStyles.info}>
        <Text style={[specialtyStyles.name, { color: theme.text }]} numberOfLines={2}>{product.name}</Text>
        <Text style={[specialtyStyles.price, { color: BRAND }]}>{product.price.toLocaleString('fr-FR')} F</Text>
        <Pressable style={specialtyStyles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={14} color="#FFF" />
          <Text style={specialtyStyles.addBtnText}>Ajouter</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const specialtyStyles = StyleSheet.create({
  card: {
    width: 148, borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, marginRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  img: { width: '100%', height: 96 },
  qtyBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: BRAND, width: 22, height: 22,
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  qtyBadgeText: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 11 },
  info: { padding: 10 },
  name: { fontFamily: 'Outfit_700Bold', fontSize: 12, lineHeight: 16, marginBottom: 3 },
  price: { fontFamily: 'Outfit_700Bold', fontSize: 13, marginBottom: 8 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: BRAND, borderRadius: 8, paddingVertical: 6,
  },
  addBtnText: { color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
});

// ── Screen ────────────────────────────────────────────────────────
export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { addItem, items } = useCart();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [specialties, setSpecialties] = useState<Product[]>([]);
  const [nearestBakery, setNearestBakery] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Step 1 — global products (fast, no location needed)
      const res = await fetch(`${BASE_URL}/api/products`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // Step 2 — specialties from nearest bakery with specialties (non-blocking)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const bRes = await fetch(
        `${BASE_URL}/api/order/bakeries?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
      );
      if (!bRes.ok) return;
      const bData = await bRes.json();
      const bakeries: any[] = bData.bakeries ?? [];
      if (!bakeries.length) return;

      // Walk bakeries nearest-first; show the first one that actually has specialties
      for (const bakery of bakeries) {
        const pRes = await fetch(`${BASE_URL}/api/products?bakeryId=${bakery.id}`);
        if (!pRes.ok) continue;
        const pData = await pRes.json();
        const specs = (pData.products ?? []).filter((p: Product) => p.bakeryId === bakery.id);
        if (specs.length > 0) {
          setNearestBakery({ id: bakery.id, name: bakery.name });
          setSpecialties(specs);
          break;
        }
      }
    } catch { /* location failure is silent — global products already shown */ }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      title: product.name,
      priceValue: product.price,
      image: getProductImage(product.image),
      bakeryId: product.bakeryId ?? null,
    });
    Alert.alert('🛒 Ajouté !', `${product.name} est dans votre panier.`);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'vous';
  const filtered = filterProducts(products, activeCategory);
  const filteredSpecialties = filterProducts(specialties, activeCategory);
  const activeCat = CATEGORIES.find(c => c.id === activeCategory);

  // Cart quantity per product id
  const cartQty = (productId: string) =>
    items.find(i => i.id === productId)?.quantity ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>

      {/* ── Top Navbar — no pattern behind it ── */}
      <View style={[styles.topNav, { borderBottomColor: theme.border }]}>
        <Text style={styles.appEmoji}>🥖</Text>
        <Text style={[styles.appName, { color: theme.text }]}>
          Lim<Text style={{ color: BRAND }}>pa</Text>
        </Text>
      </View>

      {/* ── Content area: pattern only fills here, never behind navbar ── */}
      <View style={{ flex: 1 }}>

      {/* ── User greeting ── */}
      <View style={styles.header}>
        <View style={styles.headerMid}>
          <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>{firstName}</Text>
          <Text style={[styles.subtitle, { color: theme.icon }]}>Que voulez-vous commander ?</Text>
        </View>
        <View style={[styles.bellBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
        </View>
      </View>

      {/* ── Categories ── */}
      <CategoryRow active={activeCategory} onSelect={setActiveCategory} />

      {/* ── Products ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={[styles.loadingText, { color: theme.icon }]}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadProducts(true)} tintColor={BRAND} />
          }
          ListHeaderComponent={
            <View>
              {/* ── Specialties from nearest bakery ── */}
              {filteredSpecialties.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      ✨ Spécialités{nearestBakery ? ` — ${nearestBakery.name}` : ''}
                    </Text>
                    <Text style={[styles.count, { color: BRAND }]}>
                      {filteredSpecialties.length}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
                  >
                    {filteredSpecialties.map(p => (
                      <SpecialtyCard
                        key={p.id}
                        product={p}
                        qty={cartQty(p.id)}
                        onAdd={() => handleAddToCart(p)}
                        theme={theme}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
              {/* ── Global products section header ── */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {activeCat?.id === 'all' ? '🔥 Nos Produits' : `${activeCat?.emoji} ${activeCat?.label}`}
                </Text>
                <Text style={[styles.count, { color: BRAND }]}>
                  {filtered.length} article{filtered.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              title={item.name}
              price={`${item.price.toLocaleString('fr-FR')} FCFA`}
              description={item.description ?? ''}
              imageSource={getProductImage(item.image)}
              quantity={cartQty(item.id)}
              onAdd={() => handleAddToCart(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 44 }}>😔</Text>
              <Text style={[styles.loadingText, { color: theme.icon }]}>Aucun produit dans cette catégorie.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top navbar — sits above the content area (pattern never reaches here)
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appEmoji: { fontSize: 20 },
  appName: { fontFamily: 'Outfit_700Bold', fontSize: 20, letterSpacing: 0.3 },

  // User greeting
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 12,
  },
  headerMid: { flex: 1 },
  username: { fontFamily: 'Outfit_700Bold', fontSize: 22, letterSpacing: 0.2 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  bellBtn: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  // Categories
  catRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  catCard: {
    flex: 1, borderRadius: 16,
    paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  catIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  catEmoji: { fontSize: 22 },
  miniGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 30, height: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  miniEmoji: { fontSize: 12, lineHeight: 15 },
  catLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 10, textAlign: 'center', width: '100%' },

  // Products
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 18 },
  count: { fontFamily: 'Outfit_400Regular', fontSize: 13 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { fontFamily: 'Outfit_400Regular', fontSize: 14, marginTop: 10 },
});
