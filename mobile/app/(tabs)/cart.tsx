import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, Image, ScrollView,
  Alert, Platform, ActivityIndicator, Modal, FlatList, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useCart, CartItem } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '@/constants/api';
import { getProductImage } from '@/constants/productImages';

const BRAND = '#D4A46C';
const FALLBACK_LAT = 0.4162;
const FALLBACK_LNG = 9.4673;

type Coords = { latitude: number; longitude: number };

type BakeryOption = {
  id: string; name: string; address: string | null;
  latitude: number; longitude: number;
  distance: number | null; extraFee: number; isNearest: boolean;
};

// ── OpenStreetMap via Leaflet (no API key, Expo Go compatible) ────
type BakeryPin = { lat: number; lng: number; name: string; isNearest: boolean };

function buildMapHtml(
  lat: number, lng: number,
  deliveryType: 'PICKUP' | 'DELIVERY',
  mapType: 'PLAN' | 'SATELLITE',
  bakeryPins: BakeryPin[] = [],
) {
  const icon = deliveryType === 'DELIVERY' ? '🏠' : '📍';
  const tileUrl = mapType === 'SATELLITE'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const pinsJson = JSON.stringify(bakeryPins);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    .custom-pin {
      width:38px; height:38px; border-radius:50%;
      background:#D4A46C; border:3px solid #FFF;
      display:flex; align-items:center; justify-content:center;
      font-size:18px; box-shadow:0 3px 8px rgba(0,0,0,0.35);
    }
    .bakery-pin {
      width:36px; height:36px; border-radius:50%;
      border:3px solid #FFF;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 3px 8px rgba(0,0,0,0.35);
    }
    .leaflet-popup-content { font-family: sans-serif; font-size: 13px; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('${tileUrl}', { maxZoom: 19 }).addTo(map);

  var pinIcon = L.divIcon({
    html: '<div class="custom-pin">${icon}</div>',
    iconSize: [38, 38], iconAnchor: [19, 19], className: ''
  });
  var marker = L.marker([${lat}, ${lng}], { icon: pinIcon }).addTo(map);

  // Sync user marker on map pan/tap
  map.on('moveend', function() {
    var c = map.getCenter();
    marker.setLatLng(c);
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ lat: c.lat, lng: c.lng })
    );
  });
  map.on('click', function(e) { map.panTo(e.latlng); });

  // Bakery markers
  var bakeryPins = ${pinsJson};
  var bounds = [[${lat}, ${lng}]];
  bakeryPins.forEach(function(pin, idx) {
    var bg = pin.isNearest ? '#10B981' : '#F97316';
    var label = bakeryPins.length > 1 ? (idx + 1) : '🏪';
    var icon = L.divIcon({
      html: '<div class="bakery-pin" style="background:' + bg + ';color:#FFF;font-weight:700;font-size:' + (bakeryPins.length > 1 ? '14px' : '16px') + '">' + label + '</div>',
      iconSize: [36, 36], iconAnchor: [18, 18], className: ''
    });
    L.marker([pin.lat, pin.lng], { icon: icon })
      .addTo(map)
      .bindPopup('<b>' + pin.name + '</b>' + (pin.isNearest ? '<br><small style="color:#10B981">✓ La plus proche</small>' : ''));
    bounds.push([pin.lat, pin.lng]);
  });

  if (bakeryPins.length > 0) {
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  } else {
    map.setView([${lat}, ${lng}], 15);
  }
</script>
</body>
</html>`;
}

// ── Pill selector ─────────────────────────────────────────────────
function Pill({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Ionicons name={icon as any} size={16} color={active ? '#FFF' : '#8C7A6B'} />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ── Section card wrapper ──────────────────────────────────────────
function Section({ icon, title, children, cardBg }: { icon: string; title: string; children: React.ReactNode; cardBg: string }) {
  return (
    <View style={[styles.section, { backgroundColor: cardBg }]}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon as any} size={16} color={BRAND} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Multi-bakery transparency panel ─────────────────────────────
function MultiBakeryBreakdown({
  specialtyBakeryIds, bakeries, items, hasPlatformItems, selectedBakery, deliveryType,
}: {
  specialtyBakeryIds: string[];
  bakeries: BakeryOption[];
  items: CartItem[];
  hasPlatformItems: boolean;
  selectedBakery: BakeryOption | null;
  deliveryType: 'PICKUP' | 'DELIVERY';
}) {
  const nearestBakery = bakeries.find(b => b.isNearest);
  type Row = { bakery: BakeryOption; rowItems: CartItem[]; rowKey: string; isSpecialty: boolean };
  const rows: Row[] = [];
  for (const bid of specialtyBakeryIds) {
    const bakery = bakeries.find(b => b.id === bid);
    if (bakery) rows.push({ bakery, rowItems: items.filter(i => i.bakeryId === bid), rowKey: `specialty-${bid}`, isSpecialty: true });
  }
  if (hasPlatformItems && selectedBakery) {
    rows.push({ bakery: selectedBakery, rowItems: items.filter(i => !i.bakeryId), rowKey: `platform-${selectedBakery.id}`, isSpecialty: false });
  }
  const total = rows.length;

  return (
    <View style={[styles.section, { backgroundColor: '#FFF8F0', borderWidth: 1.5, borderColor: '#FED7AA' }]}>
      {/* Header */}
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIcon, { backgroundColor: '#EA580C18' }]}>
          <Ionicons name="git-branch-outline" size={16} color="#EA580C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: '#9A3412' }]}>{total} points de retrait</Text>
          <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#C2410C', marginTop: 2, lineHeight: 17 }}>
            Votre commande sera préparée par {total} boulangeries distinctes.
          </Text>
        </View>
      </View>

      {/* Per-bakery rows */}
      {rows.map((row, i) => {
        const extraKm = row.bakery.distance != null && nearestBakery?.distance != null
          ? Math.max(0, row.bakery.distance - nearestBakery.distance)
          : null;
        const accentColor = row.isSpecialty ? '#7C3AED' : '#2563EB';
        const accentBg    = row.isSpecialty ? '#F3E8FF' : '#EFF6FF';
        return (
          <View
            key={row.rowKey}
            style={[
              { paddingTop: 12, marginTop: 12, borderRadius: 10, paddingHorizontal: 10, paddingBottom: 10,
                backgroundColor: row.isSpecialty ? '#FDF4FF' : '#F0F9FF',
                borderWidth: 1, borderColor: row.isSpecialty ? '#E9D5FF' : '#BFDBFE' },
              i > 0 && { marginTop: 14 },
            ]}
          >
            {/* Row type badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: accentBg, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={row.isSpecialty ? 'sparkles' : 'storefront'} size={12} color={accentColor} />
              </View>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: accentColor, flex: 1 }}>{row.bakery.name}</Text>
              <View style={{ backgroundColor: accentBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 9, color: accentColor }}>
                  {row.isSpecialty ? '✦ SPÉCIALISÉ' : '● PARTENAIRE'}
                </Text>
              </View>
            </View>

            {/* Items list */}
            <View style={{ gap: 3, marginLeft: 28, marginBottom: 8 }}>
              {row.rowItems.map((it, j) => (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, opacity: 0.6 }} />
                  <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#374151', flex: 1 }}>
                    {it.title}
                    <Text style={{ color: '#9CA3AF' }}> ×{it.quantity}</Text>
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: accentColor }}>
                    {(it.priceValue * it.quantity).toLocaleString('fr-FR')} F
                  </Text>
                </View>
              ))}
            </View>

            {/* Distance + fee pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 28, flexWrap: 'wrap' }}>
              {row.bakery.distance != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="navigate-circle-outline" size={13} color="#9CA3AF" />
                  <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: '#6B7280' }}>
                    {row.bakery.distance.toFixed(1)} km de vous
                  </Text>
                </View>
              )}
              {row.bakery.extraFee === 0 ? (
                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#166534' }}>Aucune surcharge</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#B91C1C' }}>
                    +{row.bakery.extraFee.toLocaleString('fr-FR')} FCFA surcharge
                  </Text>
                </View>
              )}
            </View>

            {/* Fee explanation */}
            {row.bakery.extraFee > 0 && extraKm !== null && extraKm > 0 && (
              <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 5, marginLeft: 28, lineHeight: 16 }}>
                +{extraKm.toFixed(1)} km par rapport à la boulangerie la plus proche · 300 FCFA/km supplémentaire
              </Text>
            )}
          </View>
        );
      })}

      {/* Info tip — changes with delivery mode */}
      <View style={{ marginTop: 14, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
        <Ionicons name={deliveryType === 'DELIVERY' ? 'bicycle-outline' : 'ticket-outline'} size={15} color="#D97706" />
        <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 }}>
          {deliveryType === 'DELIVERY'
            ? `Un livreur passera récupérer chaque commande à sa boulangerie. Vous serez notifié séparément pour chaque livraison (${total} au total).`
            : `Vous recevrez ${total} codes de retrait distincts à la confirmation. Présentez chaque code à la boulangerie correspondante.`}
        </Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { items, total, addItem, removeItem, clearCart } = useCart();
  const { user, authHeader } = useAuth();

  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [isScheduled, setIsScheduled] = useState(false);
  const [recurrence, setRecurrence] = useState<'NONE' | 'DAILY'>('NONE');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [coords, setCoords] = useState<Coords>({ latitude: FALLBACK_LAT, longitude: FALLBACK_LNG });
  const [mapKey, setMapKey] = useState(0); // force WebView re-render on GPS fix
  const [mapType, setMapType] = useState<'PLAN' | 'SATELLITE'>('PLAN');

  const [bakeries, setBakeries] = useState<BakeryOption[]>([]);
  const [selectedBakery, setSelectedBakery] = useState<BakeryOption | null>(null);
  const [loadingBakeries, setLoadingBakeries] = useState(false);
  const [showBakeryModal, setShowBakeryModal] = useState(false);

  // ── Auto-detect GPS ──────────────────────────────────
  const handleAutoLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMapKey(k => k + 1); // force WebView to re-center
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de vous géolocaliser.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    handleAutoLocation();
  }, []);

  // ── Fetch bakeries when coords change ────────────────────────
  const fetchBakeries = useCallback(async (lat: number, lng: number) => {
    setLoadingBakeries(true);
    try {
      const res = await fetch(`${BASE_URL}/api/order/bakeries?lat=${lat}&lng=${lng}`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: BakeryOption[] = data.bakeries ?? [];
      setBakeries(list);
      setSelectedBakery(prev => {
        if (!prev) return list.find(b => b.isNearest) ?? list[0] ?? null;
        return list.find(b => b.id === prev.id) ?? list.find(b => b.isNearest) ?? list[0] ?? null;
      });
    } catch {
      setBakeries([]);
    } finally {
      setLoadingBakeries(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchBakeries(coords.latitude, coords.longitude), 600);
    return () => clearTimeout(t);
  }, [coords.latitude, coords.longitude]);

  useEffect(() => {
    (async () => {
      try {
        const [places] = await Location.reverseGeocodeAsync(coords);
        if (places) {
          const name = [places.name, places.street, places.city].filter(Boolean).join(', ');
          setLocationName(name || 'Position personnalisée');
        }
      } catch {
        // ignore
      }
    })();
  }, [coords.latitude, coords.longitude]);

  const specialtyBakeryIds = [...new Set(items.filter(i => i.bakeryId).map(i => i.bakeryId as string))];
  const allItemsAreSpecialty = items.length > 0 && items.every(i => i.bakeryId);
  const specialtyExtraFee = specialtyBakeryIds.reduce((sum, bid) => {
    const b = bakeries.find(x => x.id === bid);
    return sum + (b?.extraFee ?? 0);
  }, 0);
  const hasPlatformItems = items.some(i => !i.bakeryId);
  const totalExtraFee = parseFloat((specialtyExtraFee + (hasPlatformItems ? (selectedBakery?.extraFee ?? 0) : 0)).toFixed(2));
  const grandTotal = parseFloat((total + totalExtraFee - couponDiscount).toFixed(2));
  const totalPickups = specialtyBakeryIds.length + (hasPlatformItems ? 1 : 0);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch(`${BASE_URL}/api/order/validate-coupon`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ code: couponCode.trim(), subtotal: total }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setCouponDiscount(data.discount);
        setCouponApplied(true);
        setCouponError('');
      } else {
        setCouponError(data.error || 'Code invalide.');
        setCouponDiscount(0);
        setCouponApplied(false);
      }
    } catch {
      setCouponError('Impossible de vérifier le code. Vérifiez votre connexion.');
    } finally {
      setCouponLoading(false);
    }
  };
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  // Handle map drag — update coords, debounced bakery fetch via useEffect
  const handleMapMessage = useCallback((event: any) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      setCoords({ latitude: lat, longitude: lng });
    } catch { /* ignore */ }
  }, []);

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        setCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
        setMapKey(prev => prev + 1); // Force map update
      } else {
        Alert.alert('Introuvable', 'Adresse introuvable. Veuillez préciser la ville (ex: Libreville).');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de chercher cette adresse.');
    } finally {
      setSearching(false);
    }
  };

  // ── Checkout ─────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!user) { Alert.alert('Non connecté', 'Veuillez vous connecter.'); return; }

    if (isGift && (!recipientName.trim() || !recipientPhone.trim())) {
      Alert.alert('Champs requis', 'Veuillez remplir le nom et le numéro de téléphone de la personne à qui vous offrez cette commande.');
      return;
    }

    // Backend groups specialty items by their own bakeryId automatically.
    // preferredBakeryId is only used for platform items (no bakeryId).
    const preferredBakeryId = selectedBakery?.id ?? null;

    setLoading(true);
    try {
      const payload = {
        userId: user.userId, items, total,
        deliveryType: deliveryType === 'PICKUP'
          ? (isScheduled ? 'PICKUP_SCHEDULED' : 'PICKUP')
          : (isScheduled ? 'DELIVERY_SCHEDULED' : 'DELIVERY'),
        recurrence,
        scheduledFor: isScheduled ? date.toISOString() : null,
        address: deliveryType === 'DELIVERY'
          ? (locationName || `GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`)
          : null,
        latitude: coords.latitude, longitude: coords.longitude,
        preferredBakeryId,
        recipientName: isGift && recipientName.trim() ? recipientName.trim() : null,
        recipientPhone: isGift && recipientPhone.trim() ? recipientPhone.trim() : null,
        couponCode: couponApplied ? couponCode.trim().toUpperCase() : null,
      };
      const response = await fetch(`${BASE_URL}/api/order/checkout`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        clearCart();
        const ordersParam = encodeURIComponent(JSON.stringify(data.orders ?? []));
        router.push(`/success?orders=${ordersParam}&daily=${recurrence === 'DAILY'}&scheduled=${isScheduled}&scheduledFor=${isScheduled ? encodeURIComponent(date.toISOString()) : ''}`);
      } else {
        Alert.alert('Oups', data.error || 'Erreur lors du paiement.');
      }
    } catch {
      clearCart();
      const offlineOrders = encodeURIComponent(JSON.stringify([{ orderId: 'DEMO_OFFLINE_1234', pickupCode: 'B-9999', bakeryName: 'Démo Boulangerie', extraFee: 0 }]));
      router.push(`/success?orders=${offlineOrders}&daily=${recurrence === 'DAILY'}&scheduled=${isScheduled}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Empty state ───────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mon Panier</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 72 }}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Panier vide</Text>
          <Text style={[styles.emptySubtitle, { color: theme.icon }]}>
            Ajoutez des produits depuis l'accueil pour commencer.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.emptyBtnText}>Voir les produits</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bakeryPinsForMap: BakeryPin[] = totalPickups > 1 && deliveryType === 'PICKUP'
    ? [
        ...specialtyBakeryIds.map(bid => {
          const b = bakeries.find(bk => bk.id === bid);
          return b ? { lat: b.latitude, lng: b.longitude, name: b.name, isNearest: b.isNearest } : null;
        }).filter(Boolean) as BakeryPin[],
        ...(hasPlatformItems && selectedBakery
          ? [{ lat: selectedBakery.latitude, lng: selectedBakery.longitude, name: selectedBakery.name, isNearest: selectedBakery.isNearest }]
          : []),
      ]
    : [];

  const mapHtml = buildMapHtml(coords.latitude, coords.longitude, deliveryType, mapType, bakeryPinsForMap);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mon Panier</Text>
          <Text style={[styles.headerSub, { color: theme.icon }]}>{itemCount} article{itemCount > 1 ? 's' : ''}</Text>
        </View>
        <Pressable onPress={() => {
          Alert.alert('Vider le panier', 'Êtes-vous sûr ?', [
            { text: 'Annuler' },
            { text: 'Vider', style: 'destructive', onPress: clearCart },
          ]);
        }}>
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

        {/* ── Cart items ── */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {items.map((item, idx) => (
            <View key={item.id}>
              <View style={styles.cartRow}>
                <View style={styles.thumbWrap}>
                  <Image source={item.image ?? getProductImage(null)} style={styles.thumb} resizeMode="cover" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.itemUnit, { color: theme.icon }]}>{item.priceValue.toLocaleString('fr-FR')} FCFA / u.</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.lineTotal, { color: BRAND }]}>
                    {(item.priceValue * item.quantity).toLocaleString('fr-FR')} F
                  </Text>
                  <View style={styles.qtyRow}>
                    <Pressable onPress={() => removeItem(item.id)} style={styles.qtyBtn}>
                      <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={item.quantity === 1 ? '#EF4444' : theme.text} />
                    </Pressable>
                    <Text style={[styles.qtyNum, { color: theme.text }]}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => addItem({ id: item.id, title: item.title, priceValue: item.priceValue, image: item.image })}
                      style={[styles.qtyBtn, styles.qtyBtnAdd]}
                    >
                      <Ionicons name="add" size={16} color="#FFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
              {idx < items.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            </View>
          ))}
        </View>

        {/* ── Mode de réception ── */}
        <Section icon="storefront-outline" title="Mode de réception" cardBg={theme.card}>
          <View style={styles.pillRow}>
            <Pill label="En boutique" icon="storefront-outline" active={deliveryType === 'PICKUP'} onPress={() => setDeliveryType('PICKUP')} />
            <Pill label="Livraison" icon="bicycle-outline" active={deliveryType === 'DELIVERY'} onPress={() => setDeliveryType('DELIVERY')} />
          </View>
        </Section>

        {/* ── Régalez un proche ── */}
        <Section icon="heart-outline" title="Régalez un proche" cardBg={isGift ? '#FFF5F7' : theme.card}>
          <Pressable
            onPress={() => setIsGift(!isGift)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: isGift ? '#BE185D' : theme.text }}>
                {isGift
                  ? recipientName.trim() ? `Pour ${recipientName.trim()} ❤️` : "Pour quelqu'un de spécial ❤️"
                  : "C'est un cadeau ?"}
              </Text>
              {!isGift && (
                <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: theme.icon }}>
                  Envoyez cette commande directement à un proche.
                </Text>
              )}
            </View>
            <View style={[
              { width: 46, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
              { backgroundColor: isGift ? '#EC4899' : theme.border },
            ]}>
              <View style={[
                { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
                isGift ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
              ]} />
            </View>
          </Pressable>
          {isGift && (
            <View style={{ marginTop: 14, gap: 12 }}>
              <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#9F1239', lineHeight: 18 }}>
                {deliveryType === 'DELIVERY'
                  ? 'La commande sera livrée à l\'adresse indiquée sur la carte ci-dessous.'
                  : 'Votre proche récupèrera la commande à la boulangerie avec son code.'}
              </Text>
              <TextInput
                style={[styles.giftInput, { backgroundColor: theme.background, color: theme.text, borderColor: '#FBCFE8' }]}
                placeholder="Prénom & nom du proche"
                placeholderTextColor={theme.icon}
                value={recipientName}
                onChangeText={setRecipientName}
              />
              <TextInput
                style={[styles.giftInput, { backgroundColor: theme.background, color: theme.text, borderColor: '#FBCFE8' }]}
                placeholder="Son numéro de téléphone"
                placeholderTextColor={theme.icon}
                keyboardType="phone-pad"
                value={recipientPhone}
                onChangeText={setRecipientPhone}
              />
            </View>
          )}
        </Section>

        {/* ── Map (OpenStreetMap via Leaflet) ── */}
        <Section
          icon="map-outline"
          title={deliveryType === 'DELIVERY' ? 'Adresse de livraison' : 'Votre position'}
          cardBg={theme.card}
        >
          {/* ── Address Search Bar ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.border }}>
            <Ionicons name="search" size={20} color={theme.icon} />
            <TextInput
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontFamily: 'Outfit_400Regular', color: theme.text }}
              placeholder="Rechercher une avenue, un quartier..."
              placeholderTextColor={theme.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchAddress}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={BRAND} />}
          </View>

          {/* Dynamic map hint — changes with delivery mode + gift toggle */}
          <View style={{ marginBottom: 10, gap: 3 }}>
            <Text style={[styles.mapHint, { color: BRAND, fontFamily: 'Outfit_600SemiBold', marginBottom: 0 }]}>
              {locating
                ? '📡 Détection en cours...'
                : deliveryType === 'DELIVERY'
                  ? isGift
                    ? `🎁 Adresse du proche · ${locationName || 'Glissez la carte'}`
                    : `🏠 Adresse de livraison · ${locationName || 'Glissez la carte'}`
                  : `📍 Votre position · ${locationName || 'Glissez pour affiner'}`}
            </Text>
            <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 11, color: theme.icon }}>
              {deliveryType === 'DELIVERY'
                ? isGift
                  ? 'Un livreur déposera cette commande ici pour votre proche.'
                  : 'Un livreur viendra déposer votre commande à cette adresse.'
                : 'Utilisé pour sélectionner la boulangerie la plus proche de vous.'}
            </Text>
          </View>

          <View style={[styles.mapWrap, bakeryPinsForMap.length > 0 && { height: 300 }]}>
            {locating && (
              <View style={styles.mapLoader}>
                <ActivityIndicator color={BRAND} size="large" />
                <Text style={styles.mapLoaderText}>Localisation...</Text>
              </View>
            )}
            <WebView
              key={`${mapKey}-${bakeries.length}`}
              source={{ html: mapHtml, baseUrl: 'https://unpkg.com' }}
              style={styles.map}
              onMessage={handleMapMessage}
              javaScriptEnabled
              originWhitelist={['*']}
            />
            {/* Auto Locate Button overlaid on Map */}
            <Pressable
              style={styles.autoLocateBtn}
              onPress={handleAutoLocation}
              disabled={locating}
            >
              <Ionicons name="navigate" size={22} color={locating ? theme.icon : BRAND} />
            </Pressable>

            {/* Map Type Toggle Button */}
            <Pressable
              style={styles.mapTypeBtn}
              onPress={() => setMapType(mapType === 'PLAN' ? 'SATELLITE' : 'PLAN')}
            >
              <Ionicons name={mapType === 'PLAN' ? 'earth' : 'map'} size={22} color={BRAND} />
            </Pressable>
          </View>

          {/* Bakery inline card */}
          <View style={[styles.bakeryCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.bakeryCardLeft}>
              <View style={[styles.bakeryIconCircle, { backgroundColor: BRAND + '20' }]}>
                <Ionicons name="storefront-outline" size={20} color={BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                {allItemsAreSpecialty ? (
                  <>
                    <Text style={[styles.bakeryName, { color: theme.text }]} numberOfLines={1}>
                      {specialtyBakeryIds.length > 1
                        ? `${specialtyBakeryIds.length} boulangeries`
                        : (bakeries.find(b => b.id === specialtyBakeryIds[0])?.name ?? 'Boulangerie spécialisée')}
                    </Text>
                    <View style={styles.bakeryMeta}>
                      <Text style={styles.nearestTag}>✓ Affectation automatique</Text>
                    </View>
                  </>
                ) : selectedBakery ? (
                  <>
                    <Text style={[styles.bakeryName, { color: theme.text }]} numberOfLines={1}>{selectedBakery.name}</Text>
                    <View style={styles.bakeryMeta}>
                      {selectedBakery.isNearest
                        ? <Text style={styles.nearestTag}>✓ La plus proche</Text>
                        : <Text style={styles.chosenTag}>Votre choix</Text>}
                      {selectedBakery.distance !== null && (
                        <Text style={[styles.distTag, { color: theme.icon }]}>{selectedBakery.distance.toFixed(1)} km</Text>
                      )}
                      {selectedBakery.extraFee > 0 && (
                        <Text style={styles.feeTag}>+{selectedBakery.extraFee.toLocaleString('fr-FR')} F</Text>
                      )}
                    </View>
                  </>
                ) : (
                  <Text style={[styles.bakeryName, { color: theme.icon }]}>
                    {loadingBakeries ? 'Recherche...' : 'Aucune boulangerie trouvée'}
                  </Text>
                )}
              </View>
            </View>
            {allItemsAreSpecialty ? (
              <View style={[styles.changeBtn, { borderColor: '#10B981', backgroundColor: '#E8F5E9' }]}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#2E7D32' }}>✨ Auto</Text>
              </View>
            ) : (
              <Pressable onPress={() => setShowBakeryModal(true)} style={[styles.changeBtn, { borderColor: BRAND }]}>
                {loadingBakeries
                  ? <ActivityIndicator size="small" color={BRAND} />
                  : <Text style={[styles.changeBtnText, { color: BRAND }]}>Changer</Text>}
              </Pressable>
            )}
          </View>
        </Section>

        {/* ── Multi-bakery transparency breakdown ── */}
        {totalPickups > 1 && bakeries.length > 0 && (
          <MultiBakeryBreakdown
            specialtyBakeryIds={specialtyBakeryIds}
            bakeries={bakeries}
            items={items}
            hasPlatformItems={hasPlatformItems}
            selectedBakery={selectedBakery}
            deliveryType={deliveryType}
          />
        )}

        <Section icon="time-outline" title="Quand ?" cardBg={theme.card}>
          <View style={styles.pillRow}>
            <Pill label="Maintenant" icon="flash-outline" active={!isScheduled} onPress={() => setIsScheduled(false)} />
            <Pill label="Programmer" icon="calendar-outline" active={isScheduled} onPress={() => setIsScheduled(true)} />
          </View>
          {isScheduled && (
            <Pressable style={[styles.datePill, { borderColor: theme.border }]} onPress={() => {
              if (Platform.OS === 'android') {
                const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
                DateTimePickerAndroid.open({
                  value: date,
                  mode: 'date',
                  onChange: (event: any, selectedDate?: Date) => {
                    if (event.type === 'set' && selectedDate) {
                      DateTimePickerAndroid.open({
                        value: selectedDate,
                        mode: 'time',
                        is24Hour: true,
                        onChange: (e: any, time?: Date) => {
                          if (e.type === 'set' && time) setDate(time);
                        }
                      });
                    }
                  }
                });
              } else {
                setShowDatePicker(true);
              }
            }}>
              <Ionicons name="calendar" size={18} color={BRAND} />
              <Text style={[styles.dateText, { color: theme.text }]}>
                {date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.icon} />
            </Pressable>
          )}
          {showDatePicker && Platform.OS !== 'android' && (
            <DateTimePicker
              value={date}
              mode="datetime"
              is24Hour
              display="default"
              onChange={(event: any, selectedDate?: Date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </Section>

        {/* ── Fréquence ── */}
        <Section icon="repeat-outline" title="Fréquence" cardBg={theme.card}>
          <View style={styles.pillRow}>
            <Pill label="Une fois" icon="radio-button-off-outline" active={recurrence === 'NONE'} onPress={() => setRecurrence('NONE')} />
            <Pill label="Tous les jours" icon="repeat" active={recurrence === 'DAILY'} onPress={() => setRecurrence('DAILY')} />
          </View>
          {recurrence === 'DAILY' && (
            <View style={{ marginTop: 12, backgroundColor: '#FFF8EE', borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: BRAND + '40' }}>
              <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#92400E' }}>
                🔁 Renouvellement automatique
              </Text>
              <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                Votre commande sera renouvelée chaque jour à la même heure. Le montant total sera débité automatiquement de votre portefeuille.
              </Text>
              <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                Gérez ou annulez votre abonnement depuis <Text style={{ fontFamily: 'Outfit_600SemiBold' }}>Portefeuille → Commandes</Text>.
              </Text>
            </View>
          )}
        </Section>

        {/* ── Code promo ── */}
        <Section icon="pricetag-outline" title="Code promo" cardBg={theme.card}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[styles.giftInput, { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: couponApplied ? '#10B981' : couponError ? '#EF4444' : theme.border }]}
              placeholder="LIMPA10, BIENVENUE..."
              placeholderTextColor={theme.icon}
              value={couponCode}
              onChangeText={v => { setCouponCode(v.toUpperCase()); setCouponApplied(false); setCouponDiscount(0); setCouponError(''); }}
              autoCapitalize="characters"
              editable={!couponApplied}
            />
            <Pressable
              onPress={couponApplied ? () => { setCouponApplied(false); setCouponDiscount(0); setCouponCode(''); } : handleApplyCoupon}
              style={{ backgroundColor: couponApplied ? '#10B981' : BRAND, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}
              disabled={couponLoading}
            >
              {couponLoading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name={couponApplied ? 'close' : 'checkmark'} size={20} color="#FFF" />}
            </Pressable>
          </View>
          {couponApplied && <Text style={{ fontFamily: 'Outfit_600SemiBold', color: '#10B981', marginTop: 8, fontSize: 13 }}>✓ Remise de {couponDiscount.toLocaleString('fr-FR')} FCFA appliquée !</Text>}
          {couponError ? <Text style={{ fontFamily: 'Outfit_400Regular', color: '#EF4444', marginTop: 8, fontSize: 13 }}>{couponError}</Text> : null}
        </Section>

        {/* ── Order summary ── */}
        <View style={[styles.summary, { backgroundColor: theme.card }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.icon }]}>Sous-total articles</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{total.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {totalPickups > 1 ? (
            // Multi-bakery: one fee line per bakery that has a surcharge
            <>
              {[
                ...specialtyBakeryIds.map(bid => bakeries.find(x => x.id === bid)).filter(Boolean) as BakeryOption[],
                ...(hasPlatformItems && selectedBakery ? [selectedBakery] : []),
              ].filter(b => b.extraFee > 0).map(b => (
                <View key={b.id} style={styles.summaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryLabel, { color: theme.icon }]} numberOfLines={1}>
                      Surcharge · {b.name}
                    </Text>
                    {b.distance != null && (
                      <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                        {b.distance.toFixed(1)} km · +300 FCFA/km au-delà du plus proche
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.summaryValue, { color: '#E65100' }]}>+{b.extraFee.toLocaleString('fr-FR')} F</Text>
                </View>
              ))}
              {totalExtraFee > 0 && (
                <View style={[styles.summaryRow, { paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#FED7AA' }]}>
                  <Text style={[styles.summaryLabel, { color: '#E65100', fontFamily: 'Outfit_600SemiBold' }]}>Total surcharges</Text>
                  <Text style={[styles.summaryValue, { color: '#E65100' }]}>+{totalExtraFee.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}
            </>
          ) : totalExtraFee > 0 ? (
            // Single bakery: show fee with distance explanation
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryLabel, { color: theme.icon }]}>Surcharge boulangerie</Text>
                {selectedBakery?.distance != null && (
                  <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {selectedBakery.distance.toFixed(1)} km · +300 FCFA/km au-delà du plus proche
                  </Text>
                )}
              </View>
              <Text style={[styles.summaryValue, { color: '#E65100' }]}>+{totalExtraFee.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          ) : null}
          {couponDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.icon }]}>Code promo ({couponCode})</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>−{couponDiscount.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>
              {recurrence === 'DAILY' ? 'Total / jour' : 'Total à payer'}
            </Text>
            <Text style={[styles.totalValue, { color: BRAND }]}>{grandTotal.toLocaleString('fr-FR')} FCFA</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky checkout footer ── */}
      <View style={[styles.footer, { paddingBottom: 16, backgroundColor: theme.background }]}>
        <Pressable onPress={handleCheckout} disabled={loading} style={styles.checkoutBtn}>
          <LinearGradient
            colors={['#EAB676', '#D4A46C', '#BB8745']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutGradient}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="wallet-outline" size={22} color="#FFF" />
                  <Text style={styles.checkoutText}>Débiter mon Portefeuille</Text>
                  <Text style={styles.checkoutAmount}>{grandTotal.toLocaleString('fr-FR')} F</Text>
                </>}
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Bakery picker modal ── */}
      <Modal visible={showBakeryModal} animationType="slide" transparent onRequestClose={() => setShowBakeryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choisir une boulangerie</Text>
              <Pressable onPress={() => setShowBakeryModal(false)}>
                <Ionicons name="close-circle" size={26} color={theme.icon} />
              </Pressable>
            </View>
            <Text style={[styles.modalHint, { color: theme.icon }]}>
              Une surcharge s'applique si vous choisissez une boulangerie plus éloignée.
            </Text>
            <FlatList
              data={bakeries}
              keyExtractor={b => b.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const sel = selectedBakery?.id === item.id;
                return (
                  <Pressable
                    onPress={() => { setSelectedBakery(item); setShowBakeryModal(false); }}
                    style={[
                      styles.bakeryOption,
                      { borderColor: sel ? BRAND : theme.border, backgroundColor: theme.card },
                      sel && { borderWidth: 2 },
                    ]}
                  >
                    <View style={[styles.bakeryOptIcon, { backgroundColor: sel ? BRAND + '22' : theme.background }]}>
                      <Ionicons name="storefront-outline" size={20} color={sel ? BRAND : theme.icon} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.bakeryOptName, { color: theme.text }]}>{item.name}</Text>
                        {item.isNearest && (
                          <View style={styles.nearestPill}><Text style={styles.nearestPillText}>La + proche</Text></View>
                        )}
                      </View>
                      {item.address && <Text style={[styles.bakeryOptAddr, { color: theme.icon }]}>{item.address}</Text>}
                      {item.distance !== null && <Text style={[styles.bakeryOptDist, { color: theme.icon }]}>{item.distance.toFixed(1)} km</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {item.extraFee > 0
                        ? <View style={styles.feePill}><Text style={styles.feePillText}>+{item.extraFee.toLocaleString('fr-FR')} F</Text></View>
                        : <View style={styles.freePill}><Text style={styles.freePillText}>Gratuit</Text></View>}
                      {sel && <Ionicons name="checkmark-circle" size={20} color={BRAND} />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ fontSize: 40 }}>🏪</Text>
                  <Text style={[styles.modalHint, { color: theme.icon, marginTop: 12 }]}>Aucune boulangerie disponible.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 28 },
  headerSub: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 2 },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 24, marginTop: 16 },
  emptySubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyBtn: { marginTop: 28, backgroundColor: BRAND, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 15 },

  // Cart items
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
  cartRow: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  thumbWrap: { width: 80, height: 80, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F5EDE0' },
  thumb: { width: '100%', height: '100%' },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: 'Outfit_700Bold', fontSize: 16, lineHeight: 22 },
  itemUnit: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 4 },
  itemRight: { alignItems: 'flex-end', gap: 8 },
  lineTotal: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#F0E8DC', justifyContent: 'center', alignItems: 'center' },
  qtyBtnAdd: { backgroundColor: BRAND },
  qtyNum: { fontFamily: 'Outfit_700Bold', fontSize: 15, minWidth: 20, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  // Section
  section: { marginHorizontal: 16, marginBottom: 12, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: BRAND + '15', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#4A3B32' },

  // Pills
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, backgroundColor: '#F5EDE0', borderWidth: 1.5, borderColor: 'transparent' },
  pillActive: { backgroundColor: BRAND, borderColor: BRAND },
  pillText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#8C7A6B' },
  pillTextActive: { color: '#FFF' },

  // Date
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  dateText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, flex: 1 },

  // Gift API
  giftInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontFamily: 'Outfit_400Regular', fontSize: 15 },

  // Location / Map
  mapHint: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginBottom: 10 },
  mapWrap: { borderRadius: 16, overflow: 'hidden', height: 220, marginBottom: 12, position: 'relative' },
  map: { width: '100%', height: '100%' },
  mapLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  mapLoaderText: { fontFamily: 'Outfit_600SemiBold', color: '#8C7A6B', marginTop: 8 },
  autoLocateBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },
  mapTypeBtn: { position: 'absolute', top: 16, right: 16, backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },

  // Bakery inline card
  bakeryCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  bakeryCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bakeryIconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bakeryName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  bakeryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  nearestTag: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: '#2E7D32' },
  chosenTag: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: '#E65100' },
  distTag: { fontFamily: 'Outfit_400Regular', fontSize: 11 },
  feeTag: { fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#C62828' },
  changeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  changeBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },

  // Summary
  summary: { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  summaryValue: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  totalLabel: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  totalValue: { fontFamily: 'Outfit_700Bold', fontSize: 22 },

  // Footer
  footer: { borderTopWidth: 0, paddingHorizontal: 16, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.03, shadowRadius: 15, elevation: 10 },
  checkoutBtn: { borderRadius: 22, overflow: 'hidden' },
  checkoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 24 },
  checkoutText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#FFF', flex: 1, textAlign: 'center' },
  checkoutAmount: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: 'rgba(255,255,255,0.95)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '82%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  modalHint: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginBottom: 16 },
  bakeryOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  bakeryOptIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bakeryOptName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  bakeryOptAddr: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  bakeryOptDist: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  nearestPill: { backgroundColor: '#E8F5E9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  nearestPillText: { fontFamily: 'Outfit_600SemiBold', fontSize: 10, color: '#2E7D32' },
  feePill: { backgroundColor: '#FCE4EC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  feePillText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#C62828' },
  freePill: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  freePillText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#2E7D32' },
});
