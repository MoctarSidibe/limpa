import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable, Alert, Modal, ScrollView, Image, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/constants/api';

type OrderItem = { name?: string; quantity: number; price?: number; product?: { name: string; price: number } };
type Order = {
  id: string;
  pickupCode: string;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED';
  deliveryType: string;
  recurrence: string;
  scheduledFor: string | null;
  extraFee: number;
  discount: number;
  couponCode: string | null;
  createdAt: string;
  nextRecurrenceAt?: string | null;
  bakery: { name: string; address: string | null } | null;
  items: OrderItem[];
  recipientName?: string | null;
  recipientPhone?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'En attente',      color: '#6B7280', icon: 'hourglass-outline' },
  CONFIRMED: { label: 'En préparation',  color: '#F59E0B', icon: 'construct-outline' },
  READY:     { label: 'Prête',           color: '#0EA5E9', icon: 'bag-check-outline' },
  PICKED_UP: { label: 'En livraison',    color: '#8B5CF6', icon: 'bicycle-outline'  },
  DELIVERED: { label: 'Livrée',          color: '#10B981', icon: 'checkmark-circle-outline' },
};

const DELIVERY_ICONS: Record<string, any> = {
  PICKUP: 'storefront-outline',
  PICKUP_SCHEDULED: 'calendar-outline',
  DELIVERY: 'bicycle-outline',
  DELIVERY_SCHEDULED: 'bicycle-outline',
};

export default function OrdersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { user, authHeader, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/user/${user.userId}/orders`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch {
      // Keep current state on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const handleCancelRecurrence = (orderId: string) => {
    Alert.alert(
      'Annuler l\'abonnement',
      'Votre commande quotidienne ne sera plus renouvelée automatiquement. Confirmer ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Annuler', style: 'destructive',
          onPress: async () => {
            setCancellingId(orderId);
            try {
              const res = await fetch(`${BASE_URL}/api/order/${orderId}/recurrence`, {
                method: 'DELETE', headers: authHeader(),
              });
              if (res.ok) {
                Alert.alert('Abonnement annulé', 'Votre commande ne sera plus renouvelée.');
                loadOrders(true);
                setSelectedOrder(null);
              } else {
                Alert.alert('Erreur', 'Impossible d\'annuler. Réessayez.');
              }
            } catch { Alert.alert('Erreur', 'Connexion impossible.'); }
            finally { setCancellingId(null); }
          },
        },
      ]
    );
  };

  const handleShareReceipt = async (order: Order) => {
    const itemLines = order.items.map(oi => {
      const name = (oi as any).product?.name ?? oi.name ?? 'Produit';
      const price = (oi as any).product?.price ?? oi.price ?? 0;
      return `  ${oi.quantity}x ${name}  –  ${(price * oi.quantity).toLocaleString('fr-FR')} F`;
    }).join('\n');
    const msg =
`━━━━━━━━━━━━━━━━━━━━━
🥐 REÇU LIMPA
━━━━━━━━━━━━━━━━━━━━━
Code commande : #${order.pickupCode}
Boulangerie   : ${order.bakery?.name ?? '-'}
Date          : ${formatDate(order.createdAt)}
━━━━━━━━━━━━━━━━━━━━━
${itemLines}
━━━━━━━━━━━━━━━━━━━━━
${order.extraFee > 0 ? `Frais livraison : +${order.extraFee.toLocaleString('fr-FR')} F\n` : ''}${order.discount > 0 ? `Remise         : -${order.discount.toLocaleString('fr-FR')} F\n` : ''}TOTAL          : ${order.total.toLocaleString('fr-FR')} FCFA
━━━━━━━━━━━━━━━━━━━━━`;
    try { await Share.share({ message: msg, title: `Reçu #${order.pickupCode}` }); } catch { /* dismissed */ }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mes Commandes</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mes Commandes</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={() => loadOrders(true)} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={22} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnecter', style: 'destructive', onPress: logout },
              ]);
            }}
            style={styles.refreshBtn}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor={theme.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={70} color={theme.border} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune commande</Text>
            <Text style={[styles.emptySubtitle, { color: theme.icon }]}>Vos commandes apparaîtront ici.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusDef = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
          return (
            <Pressable onPress={() => setSelectedOrder(item)} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardTop}>
                <View style={styles.codeBlock}>
                  <Text style={[styles.code, { color: theme.text }]}>#{item.pickupCode}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusDef.color + '20' }]}>
                    <Ionicons name={statusDef.icon} size={14} color={statusDef.color} />
                    <Text style={[styles.statusLabel, { color: statusDef.color }]}>{statusDef.label}</Text>
                  </View>
                </View>

                <View style={styles.totalBlock}>
                  <Text style={[styles.total, { color: Colors.light.primary }]}>{item.total.toLocaleString('fr-FR')} F</Text>
                  {item.extraFee > 0 && (
                    <Text style={styles.extraFeeNote}>+{item.extraFee} F service</Text>
                  )}
                </View>
              </View>

              {/* Bakery */}
              {item.bakery && (
                <View style={styles.row}>
                  <Ionicons name="storefront-outline" size={14} color={theme.icon} />
                  <Text style={[styles.meta, { color: theme.icon }]}>{item.bakery.name}</Text>
                </View>
              )}

              {/* Delivery type & date */}
              <View style={styles.row}>
                <Ionicons name={DELIVERY_ICONS[item.deliveryType] ?? 'bag-outline'} size={14} color={theme.icon} />
                <Text style={[styles.meta, { color: theme.icon }]}>{item.deliveryType.replace('_', ' ')}</Text>
                <Text style={[styles.dot, { color: theme.border }]}>·</Text>
                <Text style={[styles.meta, { color: theme.icon }]}>{formatDate(item.createdAt)}</Text>
              </View>

              {/* We no longer render items inline. The user clicks to see them in the Modal! */}

              {/* Recurrence badge */}
              {item.recurrence === 'DAILY' && (
                <View style={styles.recurrenceBadge}>
                  <Ionicons name="repeat" size={12} color="#3B82F6" />
                  <Text style={styles.recurrenceText}>Abonnement quotidien</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* ── Order Details Modal ── */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Commande #{selectedOrder?.pickupCode}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => setShowReceipt(r => !r)} style={[styles.modalClose, { backgroundColor: showReceipt ? Colors.light.primary + '20' : undefined }]}>
                  <Ionicons name={showReceipt ? 'document-text' : 'document-text-outline'} size={22} color={Colors.light.primary} />
                </Pressable>
                <Pressable onPress={() => selectedOrder && handleShareReceipt(selectedOrder)} style={styles.modalClose}>
                  <Ionicons name="share-outline" size={22} color={theme.icon} />
                </Pressable>
                <Pressable onPress={() => { setSelectedOrder(null); setShowReceipt(false); }} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color={theme.icon} />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── Receipt / QR view ── */}
              {showReceipt ? (
                <View style={styles.receiptWrap}>
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptBrand}>🥐 LIMPA</Text>
                    <Text style={styles.receiptSub}>Reçu de commande</Text>
                  </View>

                  {/* QR code */}
                  <View style={styles.qrWrap}>
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${selectedOrder?.pickupCode}&size=200x200&format=png&margin=10` }}
                      style={styles.qrImage}
                    />
                    <Text style={styles.pickupCodeLarge}>#{selectedOrder?.pickupCode}</Text>
                    <Text style={styles.receiptHint}>Présentez ce code à la boulangerie</Text>
                  </View>

                  <View style={styles.receiptDivider} />

                  <View style={styles.receiptMeta}>
                    <View style={styles.receiptMetaRow}><Text style={styles.receiptMetaKey}>Boulangerie</Text><Text style={styles.receiptMetaVal}>{selectedOrder?.bakery?.name ?? '-'}</Text></View>
                    <View style={styles.receiptMetaRow}><Text style={styles.receiptMetaKey}>Date</Text><Text style={styles.receiptMetaVal}>{selectedOrder ? formatDate(selectedOrder.createdAt) : ''}</Text></View>
                    <View style={styles.receiptMetaRow}><Text style={styles.receiptMetaKey}>Mode</Text><Text style={styles.receiptMetaVal}>{selectedOrder?.deliveryType.replace('_', ' ')}</Text></View>
                    {selectedOrder?.recipientName && (
                      <View style={styles.receiptMetaRow}><Text style={styles.receiptMetaKey}>Destinataire</Text><Text style={styles.receiptMetaVal}>{selectedOrder.recipientName}</Text></View>
                    )}
                  </View>

                  <View style={styles.receiptDivider} />

                  {selectedOrder?.items.map((oi, i) => {
                    const name = (oi as any).product?.name ?? oi.name ?? 'Produit';
                    const price = (oi as any).product?.price ?? oi.price ?? 0;
                    return (
                      <View key={i} style={styles.receiptItemRow}>
                        <Text style={styles.receiptItemName}>{oi.quantity}× {name}</Text>
                        <Text style={styles.receiptItemPrice}>{(price * oi.quantity).toLocaleString('fr-FR')} F</Text>
                      </View>
                    );
                  })}

                  <View style={styles.receiptDivider} />

                  {(selectedOrder?.extraFee ?? 0) > 0 && (
                    <View style={styles.receiptItemRow}>
                      <Text style={[styles.receiptItemName, { color: '#e65100' }]}>Frais de livraison</Text>
                      <Text style={[styles.receiptItemPrice, { color: '#e65100' }]}>+{(selectedOrder?.extraFee ?? 0).toLocaleString('fr-FR')} F</Text>
                    </View>
                  )}
                  {(selectedOrder?.discount ?? 0) > 0 && (
                    <View style={styles.receiptItemRow}>
                      <Text style={[styles.receiptItemName, { color: '#10B981' }]}>Remise {selectedOrder?.couponCode ? `(${selectedOrder.couponCode})` : ''}</Text>
                      <Text style={[styles.receiptItemPrice, { color: '#10B981' }]}>−{(selectedOrder?.discount ?? 0).toLocaleString('fr-FR')} F</Text>
                    </View>
                  )}

                  <View style={styles.receiptTotal}>
                    <Text style={styles.receiptTotalLabel}>TOTAL PAYÉ</Text>
                    <Text style={styles.receiptTotalVal}>{(selectedOrder?.total ?? 0).toLocaleString('fr-FR')} FCFA</Text>
                  </View>

                  <Pressable onPress={() => selectedOrder && handleShareReceipt(selectedOrder)} style={styles.shareBtn}>
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.shareBtnText}>Partager le reçu</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {selectedOrder?.recipientName && (
                    <View style={[styles.giftBanner, { backgroundColor: '#FDF2E9', borderColor: '#F5C6A5' }]}>
                      <Ionicons name="gift" size={20} color="#E67E22" />
                      <View>
                        <Text style={{ fontFamily: 'Outfit_700Bold', color: '#E67E22', fontSize: 13 }}>Commande Cadeau pour :</Text>
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', color: '#B95D11', fontSize: 14 }}>{selectedOrder.recipientName} ({selectedOrder.recipientPhone})</Text>
                      </View>
                    </View>
                  )}

                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Articles</Text>
                  <View style={[styles.itemsListWrapper, { borderColor: theme.border }]}>
                    {selectedOrder?.items.map((oi, i) => {
                      const name = oi.product?.name ?? oi.name ?? 'Produit inconnu';
                      const price = oi.product?.price ?? oi.price ?? 0;
                      return (
                        <View key={i} style={[styles.modalItemRow, i !== selectedOrder.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                          <Text style={[styles.modalItemName, { color: theme.text }]}>{oi.quantity}x {name}</Text>
                          <Text style={[styles.modalItemPrice, { color: theme.icon }]}>{(price * oi.quantity).toLocaleString('fr-FR')} F</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={[styles.modalSummary, { backgroundColor: theme.card }]}>
                    <View style={styles.modalSummaryRow}>
                      <Text style={[styles.modalSummaryLabel, { color: theme.icon }]}>Sous-total articles</Text>
                      <Text style={[styles.modalSummaryValue, { color: theme.text }]}>
                        {((selectedOrder?.total ?? 0) - (selectedOrder?.extraFee ?? 0) + (selectedOrder?.discount ?? 0)).toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                    {(selectedOrder?.extraFee ?? 0) > 0 && (
                      <View style={styles.modalSummaryRow}>
                        <Text style={[styles.modalSummaryLabel, { color: theme.icon }]}>Frais de service</Text>
                        <Text style={[styles.modalSummaryValue, { color: '#e65100' }]}>+{(selectedOrder?.extraFee ?? 0).toLocaleString('fr-FR')} F</Text>
                      </View>
                    )}
                    {(selectedOrder?.discount ?? 0) > 0 && (
                      <View style={styles.modalSummaryRow}>
                        <Text style={[styles.modalSummaryLabel, { color: theme.icon }]}>
                          Code promo{selectedOrder?.couponCode ? ` (${selectedOrder.couponCode})` : ''}
                        </Text>
                        <Text style={[styles.modalSummaryValue, { color: '#10B981' }]}>
                          −{(selectedOrder?.discount ?? 0).toLocaleString('fr-FR')} F
                        </Text>
                      </View>
                    )}
                    <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.modalSummaryRow}>
                      <Text style={[styles.modalTotalLabel, { color: theme.text }]}>Total Payé</Text>
                      <Text style={[styles.modalTotalValue, { color: Colors.light.primary }]}>
                        {(selectedOrder?.total ?? 0).toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                  </View>

                  {/* Cancel recurrence for daily orders */}
                  {selectedOrder?.recurrence === 'DAILY' && (
                    <View style={styles.recurrenceBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name="repeat" size={16} color={Colors.light.primary} />
                        <Text style={[styles.recurrenceBoxTitle, { color: theme.text }]}>Abonnement quotidien actif</Text>
                      </View>
                      {selectedOrder.nextRecurrenceAt && (
                        <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, color: theme.icon, marginBottom: 10 }}>
                          Prochain renouvellement : {formatDate(selectedOrder.nextRecurrenceAt)}
                        </Text>
                      )}
                      <Pressable
                        onPress={() => handleCancelRecurrence(selectedOrder.id)}
                        disabled={cancellingId === selectedOrder.id}
                        style={styles.cancelRecurrenceBtn}
                      >
                        {cancellingId === selectedOrder.id
                          ? <ActivityIndicator size="small" color="#DC2626" />
                          : <Text style={styles.cancelRecurrenceText}>Annuler l'abonnement</Text>}
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 28 },
  refreshBtn: { padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, marginTop: 16 },
  emptySubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, marginTop: 6 },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  codeBlock: { gap: 6 },
  code: { fontFamily: 'Outfit_700Bold', fontSize: 22, letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  statusLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
  totalBlock: { alignItems: 'flex-end' },
  total: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  extraFeeNote: { fontFamily: 'Outfit_400Regular', fontSize: 10, color: '#e65100', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  meta: { fontFamily: 'Outfit_400Regular', fontSize: 12 },
  dot: { fontSize: 16, lineHeight: 14 },
  recurrenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  recurrenceText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: '#3B82F6' },
  
  // Modal specific
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Outfit_700Bold', fontSize: 24 },
  modalClose: { padding: 6, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 20 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, marginBottom: 12, marginTop: 6 },
  itemsListWrapper: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  modalItemName: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  modalItemPrice: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  modalSummary: { borderRadius: 16, padding: 16, borderWidth: 0, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  modalSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalSummaryLabel: { fontFamily: 'Outfit_400Regular', fontSize: 15 },
  modalSummaryValue: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  modalDivider: { height: 1, marginVertical: 10 },
  modalTotalLabel: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  modalTotalValue: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  giftBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 },

  // Receipt styles
  receiptWrap: { paddingHorizontal: 4, paddingBottom: 20 },
  receiptHeader: { alignItems: 'center', marginBottom: 20 },
  receiptBrand: { fontFamily: 'Outfit_700Bold', fontSize: 26, letterSpacing: 2 },
  receiptSub: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  qrWrap: { alignItems: 'center', marginBottom: 16 },
  qrImage: { width: 180, height: 180, borderRadius: 12 },
  pickupCodeLarge: { fontFamily: 'Outfit_700Bold', fontSize: 28, letterSpacing: 4, marginTop: 12 },
  receiptHint: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  receiptDivider: { borderStyle: 'dashed', borderTopWidth: 1, borderColor: '#E5E7EB', marginVertical: 14 },
  receiptMeta: { gap: 8, marginBottom: 4 },
  receiptMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptMetaKey: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: '#9CA3AF' },
  receiptMetaVal: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#111827', flex: 1, textAlign: 'right' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptItemName: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: '#374151', flex: 1 },
  receiptItemPrice: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: '#374151' },
  receiptTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  receiptTotalLabel: { fontFamily: 'Outfit_700Bold', fontSize: 16, letterSpacing: 1, color: '#111827' },
  receiptTotalVal: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: Colors.light.primary },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, borderRadius: 16, paddingVertical: 14, marginTop: 20 },
  shareBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#fff' },

  // Recurrence cancel box
  recurrenceBox: { marginTop: 20, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16 },
  recurrenceBoxTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  cancelRecurrenceBtn: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  cancelRecurrenceText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#DC2626' },
});
