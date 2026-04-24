import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, TextInput,
  Alert, ActivityIndicator, RefreshControl, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/constants/api';

// ── Constants ────────────────────────────────────────────────────
const BRAND      = '#A0723A';
const BRAND_LT   = '#D4A46C';
const CACHE_KEY  = '@baker_orders_cache';
const OUTBOX_KEY = '@baker_validation_outbox';
const AUTO_REFRESH_SEC = 30;

// ── Types ────────────────────────────────────────────────────────
type OrderItem = { name: string; quantity: number; price: number };
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'READY' | 'PICKED_UP' | 'DELIVERED';

type Order = {
  id: string;
  pickupCode: string;
  total: number;
  status: OrderStatus;
  items: OrderItem[];
  deliveryType: string;
  recurrence: string;
  scheduledFor: string | null;
  address?: string;
  extraFee?: number;
  customerName?: string;
  bakeryName?: string | null;
  courierId?: string | null;
  courierName?: string | null;
  createdAt?: string;
  nudgedAt?: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────
function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}
function urgencyLevel(iso: string | null): 'urgent' | 'soon' | 'normal' {
  const m = minutesUntil(iso);
  if (m === null) return 'normal';
  if (m <= 10)   return 'urgent';
  if (m <= 25)   return 'soon';
  return 'normal';
}
function fmtScheduled(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isToday)    return `Aujourd'hui à ${timeStr}`;
  if (isTomorrow) return `Demain à ${timeStr}`;
  const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${dateStr} à ${timeStr}`;
}
function fmtCountdown(mins: number | null): string {
  if (mins === null) return '';
  if (mins <= 0) return '  •  maintenant';
  if (mins < 60) return `  •  dans ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `  •  dans ${h}h${String(m).padStart(2, '0')}` : `  •  dans ${h}h`;
}

// ── Status badge config ──────────────────────────────────────────
function statusBadge(order: Order) {
  const isDelivery = order.deliveryType.includes('DELIVERY');
  switch (order.status) {
    case 'PENDING':
      return { label: 'NOUVELLE', bg: '#FEF3C7', color: '#B45309', icon: 'hourglass-outline' as const };
    case 'CONFIRMED':
      return { label: 'EN PRÉPARATION', bg: '#EFF6FF', color: '#1D4ED8', icon: 'construct-outline' as const };
    case 'READY':
      if (!isDelivery)
        return { label: '✅ PRÊTE', bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' as const };
      if (!order.courierId)
        return { label: '✅ PRÊTE · Attend livreur', bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' as const };
      return { label: '🛵 Livreur en route', bg: '#DBEAFE', color: '#1E40AF', icon: 'bicycle-outline' as const };
    case 'PICKED_UP':
      return { label: '🚀 EN LIVRAISON', bg: '#EDE9FE', color: '#5B21B6', icon: 'rocket-outline' as const };
    default:
      return { label: order.status, bg: '#F3F4F6', color: '#6B7280', icon: 'ellipse-outline' as const };
  }
}

// ── Unified Order Card ───────────────────────────────────────────
function OrderCard({
  order,
  onAccept,
  onMarkReady,
  onHandoff,
  onValidate,
  accepting,
  marking,
  handingOff,
  validating,
}: {
  order: Order;
  onAccept:    (id: string) => void;
  onMarkReady: (id: string) => void;
  onHandoff:   (id: string) => void;
  onValidate:  (code: string) => void;
  accepting:   boolean;
  marking:     boolean;
  handingOff:  boolean;
  validating:  boolean;
}) {
  const isDelivery = order.deliveryType.includes('DELIVERY');
  const urg  = order.status === 'PENDING' ? 'normal' : urgencyLevel(order.scheduledFor);
  const mins = minutesUntil(order.scheduledFor);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sb   = statusBadge(order);

  const borderColors: Record<string, string> = {
    PENDING:   '#FBBF24',
    CONFIRMED: '#93C5FD',
    READY:     order.courierId && isDelivery ? '#93C5FD' : '#6EE7B7',
    PICKED_UP: '#C4B5FD',
  };
  const bgColors: Record<string, string> = {
    PENDING:   '#FFF8F0',
    CONFIRMED: '#F0F7FF',
    READY:     order.courierId && isDelivery ? '#F0F7FF' : '#F0FFF8',
    PICKED_UP: '#FAF5FF',
  };

  const handleScanPress = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start(() => onValidate(order.pickupCode));
  };

  return (
    <Animated.View style={[
      styles.orderCard,
      { backgroundColor: bgColors[order.status] ?? '#FFF', borderColor: borderColors[order.status] ?? '#E8DDD0' },
      { transform: [{ translateX: slideAnim }] },
    ]}>
      {/* ── Badge row ── */}
      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: sb.bg }]}>
          <Ionicons name={sb.icon} size={10} color={sb.color} />
          <Text style={[styles.badgeText, { color: sb.color }]}>{sb.label}</Text>
        </View>
        <View style={[styles.typeBadge, isDelivery ? styles.deliveryBadge : styles.pickupBadge]}>
          <Ionicons
            name={isDelivery ? 'bicycle-outline' : 'storefront-outline'}
            size={10}
            color={isDelivery ? '#1D4ED8' : '#166534'}
          />
          <Text style={[styles.badgeText, { color: isDelivery ? '#1D4ED8' : '#166534' }]}>
            {order.deliveryType.replace('_', ' ')}
          </Text>
        </View>
        {order.recurrence === 'DAILY' && (
          <View style={styles.dailyBadge}>
            <Ionicons name="repeat" size={9} color="#3B82F6" />
            <Text style={[styles.badgeText, { color: '#3B82F6' }]}> Quotidien</Text>
          </View>
        )}
        {urg === 'urgent' && order.status !== 'PICKED_UP' && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>🔥 URGENT</Text>
          </View>
        )}
      </View>

      {/* ── PIN Code ── */}
      <Text style={styles.pinCode}>{order.pickupCode}</Text>
      <Text style={styles.orderTotal}>{order.total.toLocaleString('fr-FR')} FCFA</Text>
      {order.extraFee != null && order.extraFee > 0 && (
        <Text style={styles.extraFee}>+{order.extraFee.toLocaleString('fr-FR')} FCFA surcharge</Text>
      )}

      {/* ── Meta ── */}
      <View style={styles.metaBlock}>
        {order.customerName && (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color="#9CA3AF" />
            <Text style={styles.metaText}>{order.customerName}</Text>
          </View>
        )}
        {order.scheduledFor && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={urg !== 'normal' ? '#C2410C' : '#9CA3AF'} />
            <Text style={[styles.metaText, urg !== 'normal' && { color: '#C2410C', fontFamily: 'Outfit_600SemiBold' }]}>
              {fmtScheduled(order.scheduledFor)}{fmtCountdown(mins)}
            </Text>
          </View>
        )}
        {isDelivery && order.address && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color="#9CA3AF" />
            <Text style={[styles.metaText, { flex: 1 }]} numberOfLines={1}>{order.address}</Text>
          </View>
        )}
        {order.courierName && (order.status === 'READY' || order.status === 'PICKED_UP') && (
          <View style={styles.metaRow}>
            <Ionicons name="bicycle-outline" size={12} color="#1D4ED8" />
            <Text style={[styles.metaText, { color: '#1D4ED8', fontFamily: 'Outfit_600SemiBold' }]}>
              {order.courierName}
            </Text>
          </View>
        )}
      </View>

      {/* ── Items ── */}
      {order.items?.length > 0 && (
        <View style={styles.itemsBlock}>
          {order.items.map((it, i) => (
            <Text key={i} style={styles.itemLine}>• {it.name} ×{it.quantity}</Text>
          ))}
        </View>
      )}

      {/* ── Action button — keyed on status + type ── */}
      {order.status === 'PENDING' && (
        <Pressable
          onPress={() => onAccept(order.id)}
          disabled={accepting}
          style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
        >
          {accepting
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Ionicons name="checkmark-done-outline" size={16} color="#FFF" />
               <Text style={styles.actionBtnText}>Accepter la commande</Text></>}
        </Pressable>
      )}

      {order.status === 'CONFIRMED' && (
        <Pressable
          onPress={() => onMarkReady(order.id)}
          disabled={marking}
          style={[styles.actionBtn, { backgroundColor: '#059669' }]}
        >
          {marking
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
               <Text style={styles.actionBtnText}>
                 {isDelivery ? 'Prête — Libérer pour livreur' : 'Commande prête'}
               </Text></>}
        </Pressable>
      )}

      {order.status === 'READY' && !isDelivery && (
        <Pressable onPress={handleScanPress} disabled={validating} style={styles.validateBtn}>
          <LinearGradient
            colors={['#C08A50', BRAND, '#7C4A1A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.validateGradient}
          >
            {validating
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                 <Text style={styles.validateText}>Remettre au client</Text></>}
          </LinearGradient>
        </Pressable>
      )}

      {order.status === 'READY' && isDelivery && !order.courierId && (
        <View style={[styles.infoBtn, { backgroundColor: '#F3F4F6' }]}>
          <Ionicons name="hourglass-outline" size={14} color="#9CA3AF" />
          <Text style={[styles.infoBtnText, { color: '#6B7280' }]}>En attente d'un livreur…</Text>
        </View>
      )}

      {order.status === 'READY' && isDelivery && order.courierId && (
        <Pressable
          onPress={() => onHandoff(order.id)}
          disabled={handingOff}
          style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
        >
          {handingOff
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Ionicons name="swap-horizontal-outline" size={16} color="#FFF" />
               <Text style={styles.actionBtnText}>Confirmer remise au livreur</Text></>}
        </Pressable>
      )}

      {order.status === 'PICKED_UP' && (
        <View style={[styles.infoBtn, { backgroundColor: '#EDE9FE' }]}>
          <Ionicons name="rocket-outline" size={14} color="#7C3AED" />
          <Text style={[styles.infoBtnText, { color: '#5B21B6' }]}>
            En livraison{order.courierName ? ` · ${order.courierName}` : ''}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function BakerScreen() {
  const insets = useSafeAreaInsets();
  const { user, authHeader, logout } = useAuth();

  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [markingId, setMarkingId]     = useState<string | null>(null);
  const [handingOffId, setHandingOff] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [isOffline, setIsOffline]     = useState(false);
  const [lastSync, setLastSync]       = useState<string | null>(null);
  const [countdown, setCountdown]     = useState(AUTO_REFRESH_SEC);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput]       = useState('');
  const [nudgeBanner, setNudgeBanner] = useState<{ pickupCode: string; orderId: string } | null>(null);
  const seenNudges = useRef<Set<string>>(new Set());

  // ── Load orders ──────────────────────────────────────────────
  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const bakeryParam = user?.bakeryId ? `?bakeryId=${user.bakeryId}` : '';
      const res = await fetch(`${BASE_URL}/api/admin/orders/pending${bakeryParam}`, {
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const fetched: Order[] = data.orders ?? [];
      setOrders(fetched);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fetched));
      setLastSync(new Date().toLocaleTimeString('fr-FR'));
      setIsOffline(false);

      // Check for admin nudge (nudgedAt within last 3 minutes)
      const nudgeCutoff = Date.now() - 3 * 60 * 1000;
      for (const o of fetched) {
        if (o.nudgedAt && !seenNudges.current.has(o.id) && new Date(o.nudgedAt).getTime() > nudgeCutoff) {
          seenNudges.current.add(o.id);
          setNudgeBanner({ pickupCode: o.pickupCode, orderId: o.id });
          break; // show one at a time; next poll will catch others
        }
      }
    } catch {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) setOrders(JSON.parse(raw));
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCountdown(AUTO_REFRESH_SEC);
      const outbox = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]') as string[];
      setOutboxCount(outbox.length);
    }
  }, [user?.bakeryId]);

  // ── Auto-refresh ──────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    loadOrders();
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { loadOrders(true); return AUTO_REFRESH_SEC; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadOrders]);

  // ── Outbox sync on mount ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      const outbox: string[] = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]');
      if (outbox.length === 0) return;
      const failed: string[] = [];
      for (const id of outbox) {
        try {
          const r = await fetch(`${BASE_URL}/api/order/${id}/deliver`, { method: 'POST', headers: authHeader() });
          if (!r.ok) failed.push(id);
        } catch { failed.push(id); }
      }
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(failed));
      setOutboxCount(failed.length);
    })();
  }, []);

  // ── Accept (PENDING → CONFIRMED) ─────────────────────────────
  const handleAccept = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/confirm`, {
        method: 'PUT', headers: authHeader(),
      });
      if (r.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CONFIRMED' } : o));
      } else {
        Alert.alert('Erreur', 'Impossible d\'accepter cette commande.');
      }
    } catch { Alert.alert('Hors ligne', 'Vérifiez votre connexion.'); }
    finally { setAcceptingId(null); }
  };

  // ── Mark ready (CONFIRMED → READY) ───────────────────────────
  const handleMarkReady = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/ready`, {
        method: 'PUT', headers: authHeader(),
      });
      if (r.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'READY' } : o));
      } else {
        Alert.alert('Erreur', 'Impossible de marquer la commande comme prête.');
      }
    } catch { Alert.alert('Hors ligne', 'Vérifiez votre connexion.'); }
    finally { setMarkingId(null); }
  };

  // ── Confirm handoff to courier (READY → PICKED_UP) ───────────
  const handleHandoff = async (orderId: string) => {
    Alert.alert(
      'Confirmer la remise',
      'Confirmez que vous avez remis physiquement cette commande au livreur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer ✓',
          onPress: async () => {
            setHandingOff(orderId);
            try {
              const r = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/handoff`, {
                method: 'PUT', headers: authHeader(),
              });
              if (r.ok) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PICKED_UP' } : o));
              } else {
                const d = await r.json();
                Alert.alert('Erreur', d.error || 'Impossible de confirmer la remise.');
              }
            } catch { Alert.alert('Hors ligne', 'Vérifiez votre connexion.'); }
            finally { setHandingOff(null); }
          },
        },
      ]
    );
  };

  // ── Validate pickup (READY → DELIVERED via customer code) ────
  const handleValidate = async (code: string) => {
    // Only match READY, non-delivery orders
    const match = orders.find(o =>
      (o.pickupCode.toUpperCase() === code.toUpperCase() || o.id === code) &&
      o.status === 'READY' &&
      !o.deliveryType.includes('DELIVERY')
    );
    if (!match) {
      Alert.alert(
        'Code introuvable',
        'Aucune commande prête avec ce code. Assurez-vous que la commande est marquée "Commande prête" avant de remettre.'
      );
      return;
    }

    setValidatingId(match.id);
    // Optimistic remove
    setOrders(prev => prev.filter(o => o.id !== match.id));
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(orders.filter(o => o.id !== match.id)));

    try {
      const r = await fetch(`${BASE_URL}/api/order/${match.id}/deliver`, {
        method: 'POST', headers: authHeader(),
      });
      if (!r.ok) throw new Error();
    } catch {
      const outbox: string[] = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]');
      outbox.push(match.id);
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
      setOutboxCount(o => o + 1);
      Alert.alert('Mode Hors-Ligne', 'Validation enregistrée localement. Sera synchronisée au retour réseau.');
    } finally {
      setValidatingId(null);
    }
  };

  const handlePinSubmit = () => {
    if (!pinInput.trim()) return;
    handleValidate(pinInput.trim().toUpperCase());
    setPinInput('');
    setShowPinModal(false);
  };

  // ── KPIs ──────────────────────────────────────────────────────
  const pendingCount   = orders.filter(o => o.status === 'PENDING').length;
  const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length;
  const readyCount     = orders.filter(o => o.status === 'READY').length;
  const pickedUpCount  = orders.filter(o => o.status === 'PICKED_UP').length;
  const today = new Date().toDateString();
  const todayRevenue = orders
    .filter(o => o.createdAt && new Date(o.createdAt).toDateString() === today)
    .reduce((s, o) => s + o.total, 0);

  // Sort: PENDING first, then CONFIRMED, then READY (pickup > delivery-with-courier > waiting), then PICKED_UP
  const sortedOrders = [...orders].sort((a, b) => {
    const priority = (o: Order) => {
      if (o.status === 'PENDING')   return 0;
      if (o.status === 'CONFIRMED') return 1;
      if (o.status === 'READY' && !o.deliveryType.includes('DELIVERY')) return 2;
      if (o.status === 'READY' && o.courierId)  return 3;
      if (o.status === 'READY')     return 4;
      return 5; // PICKED_UP
    };
    return priority(a) - priority(b);
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <LinearGradient colors={['#1C0E06', '#3D1F0A']} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Terminal Limpa</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {user?.name ?? 'Boulanger'} · {user?.bakeryId ? 'Votre fournil' : 'Tous les fournils'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.netBadge, isOffline ? styles.netOffline : styles.netOnline]}>
            <View style={[styles.netDot, { backgroundColor: isOffline ? '#FCA5A5' : '#6EE7B7' }]} />
            <Text style={[styles.netText, { color: isOffline ? '#FCA5A5' : '#6EE7B7' }]}>
              {isOffline ? 'Hors ligne' : 'En ligne'}
            </Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Déconnexion', 'Quitter le terminal boulanger ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Se déconnecter', style: 'destructive', onPress: logout },
            ])}
            style={styles.logoutBtn}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* ── KPI Strip ── */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, pendingCount > 0 ? { color: '#D97706' } : {}]}>{pendingCount}</Text>
          <Text style={styles.kpiLabel}>Nouvelles</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{confirmedCount}</Text>
          <Text style={styles.kpiLabel}>En prépa</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{readyCount}</Text>
          <Text style={styles.kpiLabel}>Prêtes</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>{pickedUpCount}</Text>
          <Text style={styles.kpiLabel}>En route</Text>
        </View>
      </View>

      {/* ── Revenue bar ── */}
      <View style={styles.revenueBar}>
        <Ionicons name="trending-up-outline" size={14} color="#059669" />
        <Text style={styles.revenueText}>
          CA aujourd'hui : <Text style={{ fontFamily: 'Outfit_700Bold', color: '#059669' }}>{todayRevenue.toLocaleString('fr-FR')} FCFA</Text>
        </Text>
        <Text style={styles.syncText}>· Sync dans {countdown}s</Text>
      </View>

      {/* ── Admin nudge banner ── */}
      {nudgeBanner && (
        <View style={styles.nudgeBanner}>
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={styles.nudgeText}>
            ⚠️ L'admin vous relance sur la commande{' '}
            <Text style={{ fontFamily: 'Outfit_700Bold' }}>#{nudgeBanner.pickupCode}</Text>
          </Text>
          <Pressable onPress={() => setNudgeBanner(null)} style={styles.nudgeDismiss}>
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* ── Outbox warning ── */}
      {outboxCount > 0 && (
        <View style={styles.outboxBanner}>
          <Ionicons name="cloud-upload-outline" size={14} color="#92400E" />
          <Text style={styles.outboxText}>
            {outboxCount} validation{outboxCount > 1 ? 's' : ''} hors-ligne en attente de sync
          </Text>
        </View>
      )}

      {/* ── Sync info ── */}
      {lastSync && !isOffline && (
        <Text style={styles.syncInfo}>Dernière synchro : {lastSync}</Text>
      )}

      {/* ── New orders banner ── */}
      {pendingCount > 0 && (
        <View style={styles.newOrdersBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.newOrdersText}>
            {pendingCount} nouvelle{pendingCount > 1 ? 's' : ''} commande{pendingCount > 1 ? 's' : ''} à accepter
          </Text>
        </View>
      )}

      {/* ── Orders list ── */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={BRAND_LT} />
          <Text style={styles.stateText}>Chargement des commandes...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedOrders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor={BRAND_LT} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="checkmark-circle-outline" size={72} color="#BBF7D0" />
              <Text style={styles.stateText}>Toutes les commandes sont traitées !</Text>
              <Pressable onPress={() => loadOrders(true)} style={styles.refreshLink}>
                <Text style={styles.refreshLinkText}>Vérifier de nouvelles commandes</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onAccept={handleAccept}
              onMarkReady={handleMarkReady}
              onHandoff={handleHandoff}
              onValidate={handleValidate}
              accepting={acceptingId === item.id}
              marking={markingId === item.id}
              handingOff={handingOffId === item.id}
              validating={validatingId === item.id}
            />
          )}
        />
      )}

      {/* ── Floating PIN button (for READY pickup remise) ── */}
      <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => setShowPinModal(true)}
          style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient
            colors={['#E0B07A', BRAND_LT, '#C08A50']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.fabGradient}
          >
            <Ionicons name="keypad-outline" size={20} color="#FFF" />
            <Text style={styles.fabText}>Saisir le Code Client</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── PIN Modal ── */}
      <Modal visible={showPinModal} transparent animationType="slide" onRequestClose={() => setShowPinModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Code Retrait Client</Text>
            <Text style={styles.modalSubtitle}>
              Entrez le code du client (affiché sur son ticket ou dicté).{'\n'}
              La commande doit être marquée <Text style={{ fontFamily: 'Outfit_700Bold', color: '#059669' }}>Prête</Text> avant remise.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={t => setPinInput(t.toUpperCase())}
              placeholder="Ex: A3F-192"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handlePinSubmit}
            />
            <Pressable onPress={handlePinSubmit} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Remettre au client ✓</Text>
            </Pressable>
            <Pressable onPress={() => setShowPinModal(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFAF6' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flex: 1 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: '#FFFDF9', letterSpacing: 0.5 },
  headerSub: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  logoutBtn: { padding: 4 },
  netBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  netOnline:  { backgroundColor: 'rgba(16,185,129,0.15)' },
  netOffline: { backgroundColor: 'rgba(239,68,68,0.15)' },
  netDot:  { width: 7, height: 7, borderRadius: 4 },
  netText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },

  // KPI strip
  kpiStrip:  { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8DDD0' },
  kpiItem:   { flex: 1, alignItems: 'center', paddingVertical: 10 },
  kpiValue:  { fontFamily: 'Outfit_700Bold', fontSize: 22, color: '#1A0800' },
  kpiLabel:  { fontFamily: 'Outfit_400Regular', fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  kpiDivider:{ width: 1, backgroundColor: '#E8DDD0', marginVertical: 8 },

  // Revenue bar
  revenueBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#F0FFF4', borderBottomWidth: 1, borderBottomColor: '#BBF7D0' },
  revenueText: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#374151', flex: 1 },
  syncText:    { fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#9CA3AF' },

  // Banners
  newOrdersBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  newOrdersText:   { fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#B45309', flex: 1 },
  nudgeBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#B91C1C' },
  nudgeText:    { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#fff', flex: 1 },
  nudgeDismiss: { padding: 4 },
  outboxBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  outboxText:   { fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: '#92400E', flex: 1 },
  syncInfo:     { fontFamily: 'Outfit_400Regular', fontSize: 10, color: '#9CA3AF', textAlign: 'center', paddingVertical: 3 },

  // Order card
  orderCard:  { borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  badgeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statusBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  typeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  pickupBadge:  { backgroundColor: '#F0FDF4' },
  deliveryBadge:{ backgroundColor: '#EFF6FF' },
  dailyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  urgentBadge:{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  urgentBadgeText: { fontFamily: 'Outfit_700Bold', fontSize: 9, color: '#B91C1C' },
  badgeText:  { fontFamily: 'Outfit_700Bold', fontSize: 9 },

  pinCode:    { fontFamily: 'Outfit_700Bold', fontSize: 38, letterSpacing: 4, color: '#1A0800', marginBottom: 4 },
  orderTotal: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#059669' },
  extraFee:   { fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#C2410C', marginTop: 1 },

  metaBlock: { marginTop: 10, gap: 4 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:  { fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#6B7280', flex: 1 },

  itemsBlock: { borderTopWidth: 1, borderTopColor: '#E8DDD0', marginTop: 10, paddingTop: 8, gap: 3 },
  itemLine:   { fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#9CA3AF' },

  // Action buttons
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 14, padding: 14 },
  actionBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFF' },

  validateBtn:      { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  validateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  validateText:     { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFF' },

  infoBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 14, padding: 12 },
  infoBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },

  // States
  centerState:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  stateText:       { fontFamily: 'Outfit_400Regular', fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  refreshLink:     { marginTop: 8 },
  refreshLinkText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: BRAND_LT },

  // FAB
  fab:         { position: 'absolute', left: 16, right: 16, shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  fabBtn:      { borderRadius: 18, overflow: 'hidden' },
  fabGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  fabText:     { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, gap: 12 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 8 },
  modalTitle:   { fontFamily: 'Outfit_700Bold', fontSize: 22, color: '#1A0800' },
  modalSubtitle:{ fontFamily: 'Outfit_400Regular', fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  pinInput: {
    fontFamily: 'Outfit_700Bold', fontSize: 28, letterSpacing: 6,
    textAlign: 'center', color: '#1A0800',
    borderWidth: 2, borderColor: BRAND_LT, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 12, backgroundColor: '#FDFAF6',
  },
  modalBtn:       { backgroundColor: BRAND, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  modalBtnText:   { fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#FFF' },
  modalCancel:    { alignItems: 'center', paddingVertical: 8 },
  modalCancelText:{ fontFamily: 'Outfit_400Regular', fontSize: 14, color: '#9CA3AF' },
});
