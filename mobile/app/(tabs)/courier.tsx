import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type Delivery = {
  id: string;
  pickupCode: string;
  status: 'READY' | 'PICKED_UP';
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  bakeryName: string | null;
  bakeryAddress: string | null;
  total: number;
  scheduledFor: string | null;
  courierId: string | null;
};

// Default center = Libreville; replaced by real GPS when available
const DEFAULT_LAT = 0.4162;
const DEFAULT_LNG = 9.4673;

// Escape HTML to prevent XSS in Leaflet popups
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCourierMapHtml(deliveries: Delivery[], courierLat: number, courierLng: number) {
  const markersJs = deliveries.map(d => `
    L.marker([${d.latitude}, ${d.longitude}], { icon: redIcon })
      .addTo(map)
      .bindPopup('<b>${escHtml(d.customerName)}</b><br/>${escHtml(d.address)}<br/>Code : <b>${escHtml(d.pickupCode)}</b><br/>${d.total.toLocaleString('fr-FR')} FCFA');
  `).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    .courier-pin {
      width:38px; height:38px; border-radius:50%;
      background:#3B82F6; border:3px solid #FFF;
      display:flex; align-items:center; justify-content:center;
      font-size:20px; box-shadow:0 3px 8px rgba(0,0,0,0.3);
    }
    .client-pin {
      width:34px; height:34px; border-radius:50%;
      background:#EF4444; border:3px solid #FFF;
      display:flex; align-items:center; justify-content:center;
      font-size:17px; box-shadow:0 3px 8px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([${courierLat}, ${courierLng}], 13);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var courierIcon = L.divIcon({
    html: '<div class="courier-pin">&#x1F6B4;</div>',
    iconSize: [38, 38], iconAnchor: [19, 19], className: ''
  });
  var redIcon = L.divIcon({
    html: '<div class="client-pin">&#x1F4E6;</div>',
    iconSize: [34, 34], iconAnchor: [17, 17], className: ''
  });

  L.marker([${courierLat}, ${courierLng}], { icon: courierIcon }).addTo(map)
    .bindPopup('Ma position');

  ${markersJs}
</script>
</body>
</html>`;
}

const AUTO_REFRESH = 15;

export default function CourierScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { user, authHeader, logout } = useAuth();
  const courierId = user?.userId;

  const [available, setAvailable] = useState<Delivery[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH);
  const [courierCoords, setCourierCoords] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch real GPS position on mount + post location to server every 30s
  useEffect(() => {
    let locationInterval: ReturnType<typeof setInterval>;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCourierCoords(coords);

        const postLocation = async (lat: number, lng: number) => {
          if (!user?.userId) return;
          try {
            await fetch(`${BASE_URL}/api/courier/location`, {
              method: 'PUT', headers: authHeader(),
              body: JSON.stringify({ courierId: user.userId, lat, lng }),
            });
          } catch { /* silent */ }
        };

        postLocation(coords.lat, coords.lng);
        locationInterval = setInterval(async () => {
          try {
            const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setCourierCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
            postLocation(p.coords.latitude, p.coords.longitude);
          } catch { /* keep last known */ }
        }, 30000);
      } catch {
        // keep default Libreville center
      }
    })();

    return () => { if (locationInterval) clearInterval(locationInterval); };
  }, [user?.userId]);

  const loadDeliveries = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const headers = authHeader();
      const [availRes, mineRes] = await Promise.all([
        fetch(`${BASE_URL}/api/courier/deliveries`, { headers }),
        courierId
          ? fetch(`${BASE_URL}/api/courier/deliveries?courierId=${courierId}`, { headers })
          : Promise.resolve(null),
      ]);
      if (availRes.ok) {
        const d = await availRes.json();
        setAvailable(d.deliveries ?? []);
      }
      if (mineRes && mineRes.ok) {
        const d = await mineRes.json();
        setMyDeliveries(d.deliveries ?? []);
      }
    } catch {
      // keep current lists on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCountdown(AUTO_REFRESH);
    }
  }, [courierId]);

  // Auto-refresh countdown
  useEffect(() => {
    loadDeliveries();
    timerRef.current = setInterval(() => {
      setCountdown(s => {
        if (s <= 1) { loadDeliveries(); return AUTO_REFRESH; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadDeliveries]);

  // Accept delivery (Uber-style, first-come-first-served)
  const handleAccept = async (delivery: Delivery) => {
    Alert.alert(
      'Accepter la livraison',
      `Prendre en charge la commande ${delivery.pickupCode} pour ${delivery.customerName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setAcceptingId(delivery.id);
            try {
              const res = await fetch(`${BASE_URL}/api/courier/${delivery.id}/accept`, {
                method: 'POST',
                headers: authHeader(),
                body: JSON.stringify({ courierId }),
              });
              if (res.ok) {
                setAvailable(prev => prev.filter(d => d.id !== delivery.id));
                setMyDeliveries(prev => [{ ...delivery, courierId: courierId! }, ...prev]);
                setActiveTab('mine');
                Alert.alert('Livraison acceptée !', `Commande ${delivery.pickupCode} vous est assignée.`);
              } else if (res.status === 409) {
                Alert.alert('Trop tard', 'Cette livraison a déjà été prise par un autre livreur.');
                loadDeliveries();
              } else {
                Alert.alert('Erreur', "Impossible d'accepter cette livraison.");
              }
            } catch {
              Alert.alert('Erreur réseau', 'Vérifiez votre connexion.');
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  };

  // Complete delivery — only allowed once bakery confirmed handoff (PICKED_UP)
  const handleComplete = async (delivery: Delivery) => {
    if (delivery.status !== 'PICKED_UP') {
      Alert.alert(
        'En attente de la boulangerie',
        `La boulangerie doit confirmer la remise physique de la commande ${delivery.pickupCode} avant que vous puissiez la marquer comme livrée.`
      );
      return;
    }
    Alert.alert(
      'Confirmer livraison',
      `Marquer la commande ${delivery.pickupCode} pour ${delivery.customerName} comme livrée au client ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Livrée ✓',
          onPress: async () => {
            setCompletingId(delivery.id);
            try {
              const res = await fetch(`${BASE_URL}/api/courier/${delivery.id}/complete`, {
                method: 'POST',
                headers: authHeader(),
              });
              if (res.ok) {
                setMyDeliveries(prev => prev.filter(d => d.id !== delivery.id));
                Alert.alert('Bravo ! 🎉', `Livraison ${delivery.pickupCode} complétée avec succès !`);
              } else {
                const data = await res.json();
                Alert.alert('Erreur', data.error || 'Impossible de marquer la livraison.');
              }
            } catch {
              setMyDeliveries(prev => prev.filter(d => d.id !== delivery.id));
              Alert.alert('Mode Hors-Ligne', 'Livraison marquée localement.');
            } finally {
              setCompletingId(null);
            }
          },
        },
      ]
    );
  };

  const allMapDeliveries = [...myDeliveries, ...available];
  const mapHtml = buildCourierMapHtml(allMapDeliveries, courierCoords.lat, courierCoords.lng);
  const currentList = activeTab === 'available' ? available : myDeliveries;

  const renderDeliveryCard = (item: Delivery, isAccepted: boolean) => {
    const isPickedUp = item.status === 'PICKED_UP';
    const isAwaitingHandoff = isAccepted && item.status === 'READY';
    return (
      <View style={[styles.deliveryCard, {
        backgroundColor: theme.card,
        borderColor: isPickedUp ? '#8B5CF640' : isAccepted ? '#10B98140' : theme.border,
      }]}>
        <View style={styles.deliveryInfo}>
          <View style={styles.codeRow}>
            <Text style={[styles.deliveryCode, { color: theme.primary }]}>{item.pickupCode}</Text>
            {isPickedUp && (
              <View style={[styles.acceptedBadge, { backgroundColor: '#8B5CF620' }]}>
                <Text style={[styles.acceptedBadgeText, { color: '#7C3AED' }]}>EN LIVRAISON</Text>
              </View>
            )}
            {isAwaitingHandoff && (
              <View style={[styles.acceptedBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.acceptedBadgeText, { color: '#B45309' }]}>À RÉCUPÉRER</Text>
              </View>
            )}
            {!isAccepted && (
              <View style={styles.acceptedBadge}>
                <Text style={styles.acceptedBadgeText}>DISPONIBLE</Text>
              </View>
            )}
          </View>
          <Text style={[styles.deliveryName, { color: theme.text }]}>{item.customerName}</Text>
          {isAwaitingHandoff && item.bakeryName && (
            <Text style={[styles.deliveryBakery, { color: '#B45309', fontFamily: 'Outfit_600SemiBold' }]}>
              🏪 Aller récupérer chez {item.bakeryName}
            </Text>
          )}
          {(!isAwaitingHandoff || isPickedUp) && (
            <Text style={[styles.deliveryAddress, { color: theme.icon }]} numberOfLines={2}>
              📍 {item.address}
            </Text>
          )}
          {item.bakeryName && !isAwaitingHandoff && (
            <Text style={[styles.deliveryBakery, { color: theme.icon }]}>🏪 {item.bakeryName}</Text>
          )}
          <Text style={[styles.deliveryTotal, { color: theme.text }]}>{item.total.toLocaleString('fr-FR')} FCFA</Text>
        </View>

        <View style={styles.deliveryRight}>
          {isAccepted ? (
            isPickedUp ? (
              // Picked up — show complete button
              <Pressable
                onPress={() => handleComplete(item)}
                disabled={completingId === item.id}
                style={[styles.completeBtn, { backgroundColor: completingId === item.id ? '#ccc' : '#10B981' }]}
              >
                {completingId === item.id
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="checkmark" size={22} color="#FFF" />}
              </Pressable>
            ) : (
              // Claimed but awaiting bakery handoff — show waiting indicator
              <View style={[styles.completeBtn, { backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="time-outline" size={22} color="#B45309" />
              </View>
            )
          ) : (
            <Pressable
              onPress={() => handleAccept(item)}
              disabled={acceptingId === item.id}
              style={[styles.acceptBtn, { backgroundColor: acceptingId === item.id ? '#ccc' : '#3B82F6' }]}
            >
              {acceptingId === item.id
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="hand-left" size={20} color="#FFF" />}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Espace Livreur</Text>
          <Text style={[styles.subtitle, { color: theme.icon }]}>
            {loading ? 'Chargement...' : `${available.length} dispo · ${myDeliveries.filter(d => d.status === 'PICKED_UP').length} en route · ${myDeliveries.filter(d => d.status === 'READY').length} à récupérer`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.countdownText, { color: theme.icon }]}>{countdown}s</Text>
          <View style={styles.statusBadge}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>En ligne</Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Déconnexion', 'Quitter l\'espace livreur ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Se déconnecter', style: 'destructive', onPress: logout },
            ])}
            style={styles.logoutBtn}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color={theme.icon} />
          </Pressable>
        </View>
      </View>

      {/* Map with real courier position */}
      <View style={styles.mapContainer}>
        <WebView
          key={`${allMapDeliveries.length}-${courierCoords.lat.toFixed(4)}`}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
        />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Ionicons name="list-outline" size={16} color={activeTab === 'available' ? '#3B82F6' : theme.icon} />
          <Text style={[styles.tabText, { color: activeTab === 'available' ? '#3B82F6' : theme.icon }]}>
            Disponibles ({available.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Ionicons name="bicycle-outline" size={16} color={activeTab === 'mine' ? '#10B981' : theme.icon} />
          <Text style={[styles.tabText, { color: activeTab === 'mine' ? '#10B981' : theme.icon }]}>
            Mes livraisons ({myDeliveries.length})
          </Text>
        </Pressable>
      </View>

      {/* Deliveries list */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDeliveries(true)} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'available' ? 'time-outline' : 'checkmark-circle-outline'}
                size={50}
                color={activeTab === 'available' ? '#F59E0B' : '#10B981'}
              />
              <Text style={[styles.emptyText, { color: theme.icon }]}>
                {activeTab === 'available'
                  ? 'Aucune livraison disponible pour le moment.'
                  : 'Aucune livraison en cours. Acceptez-en une !'}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderDeliveryCard(item, activeTab === 'mine')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22 },
  subtitle: { fontFamily: 'Outfit_400Regular', marginTop: 2, fontSize: 13 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  logoutBtn: { marginTop: 2, padding: 4 },
  countdownText: { fontFamily: 'Outfit_400Regular', fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 },
  statusText: { fontFamily: 'Outfit_700Bold', color: '#10B981', fontSize: 12 },
  mapContainer: { height: 200 },
  map: { width: '100%', height: '100%' },

  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#3B82F6' },
  tabText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },

  list: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 15, marginTop: 12, textAlign: 'center' },

  deliveryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  deliveryInfo: { flex: 1, gap: 3 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliveryCode: { fontFamily: 'Outfit_700Bold', fontSize: 18, letterSpacing: 1 },
  acceptedBadge: { backgroundColor: '#10B98120', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  acceptedBadgeText: { fontFamily: 'Outfit_700Bold', fontSize: 9, color: '#10B981', letterSpacing: 0.5 },
  deliveryName: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  deliveryAddress: { fontFamily: 'Outfit_400Regular', fontSize: 12 },
  deliveryBakery: { fontFamily: 'Outfit_400Regular', fontSize: 11 },
  deliveryTotal: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginTop: 2 },
  deliveryRight: { alignItems: 'flex-end', gap: 10, marginLeft: 12 },
  completeBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  acceptBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
});
