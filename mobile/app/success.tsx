import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '@/constants/api';

type OrderResult = {
  orderId: string;
  pickupCode: string;
  bakeryName: string | null;
  bakeryAddress?: string | null;
  extraFee: number;
};

export default function SuccessScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();

  const {
    orders: ordersParam,
    daily, scheduled, scheduledFor,
    // legacy single-order params (backward compat)
    orderId, pickupCode, bakeryName, extraFee,
  } = useLocalSearchParams();

  // Parse orders array (new format) or fall back to legacy single-order params
  let parsedOrders: OrderResult[] = [];
  if (ordersParam) {
    try {
      parsedOrders = JSON.parse(decodeURIComponent(String(ordersParam)));
    } catch { parsedOrders = []; }
  } else if (orderId) {
    parsedOrders = [{
      orderId:    String(orderId),
      pickupCode: String(pickupCode ?? ''),
      bakeryName: bakeryName ? decodeURIComponent(String(bakeryName)) : null,
      extraFee:   parseFloat(String(extraFee ?? '0')),
    }];
  }

  const scheduledLabel = (() => {
    if (!scheduledFor || String(scheduledFor) === '') return null;
    try {
      return new Date(decodeURIComponent(String(scheduledFor))).toLocaleString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      });
    } catch { return null; }
  })();

  const isMulti = parsedOrders.length > 1;

  return (
    <LinearGradient
      colors={['#FDF6EE', '#F5E6D0', '#EDD4B0']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={100} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            {isMulti ? `${parsedOrders.length} Commandes Réussies !` : 'Commande Réussie !'}
          </Text>
          <Text style={[styles.message, { color: theme.icon }]}>
            {isMulti
              ? `Votre paiement a été validé pour ${parsedOrders.length} boulangeries. 🥖`
              : 'Votre paiement depuis le Portefeuille a été validé. 🥖'}
          </Text>

          {/* ── One block per sub-order ── */}
          {parsedOrders.map((o, idx) => (
            <View key={o.orderId} style={[styles.orderBlock, isMulti && styles.orderBlockBordered]}>

              {isMulti && (
                <Text style={[styles.orderBlockLabel, { color: theme.icon }]}>
                  Commande {idx + 1} / {parsedOrders.length}
                </Text>
              )}

              {o.bakeryName && (
                <View style={[styles.bakeryBox, { borderColor: theme.primary }]}>
                  <Ionicons name="storefront-outline" size={20} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bakeryLabel, { color: theme.icon }]}>
                      {isMulti ? 'Boulangerie :' : 'Votre boulangerie :'}
                    </Text>
                    <Text style={[styles.bakeryName, { color: theme.text }]}>{o.bakeryName}</Text>
                    {o.extraFee > 0 && (
                      <Text style={styles.extraFeeNote}>
                        Surcharge distance : +{o.extraFee.toLocaleString('fr-FR')} FCFA
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.codeBox}>
                <Text style={[styles.codeLabel, { color: theme.icon }]}>🔑 Code de Retrait :</Text>
                <Text style={styles.codeValue}>{o.pickupCode}</Text>
              </View>

              <Pressable
                style={[styles.invoiceBtn, { backgroundColor: '#EFEEEC', borderColor: theme.primary, borderWidth: 1 }]}
                onPress={() => {
                  if (!o.orderId || o.orderId === 'DEMO_OFFLINE_1234') {
                    alert("En mode Démo Offline, il n'y a pas de PDF généré.");
                    return;
                  }
                  Linking.openURL(`${BASE_URL}/api/order/${o.orderId}/invoice`)
                    .catch(err => console.error('Could not open URL', err));
                }}
              >
                <Ionicons name="receipt-outline" size={20} color={theme.primary} />
                <Text style={[styles.invoiceText, { color: theme.primary }]}>
                  {isMulti ? `Ticket — ${o.bakeryName ?? `Commande ${idx + 1}`}` : 'Générer mon Ticket (PDF) & QR Code'}
                </Text>
              </Pressable>
            </View>
          ))}

          {daily === 'true' && (
            <View style={styles.badge}>
              <Ionicons name="repeat" size={16} color="#FFF" />
              <Text style={styles.badgeText}>Abonnement Quotidien Actif</Text>
            </View>
          )}

          {scheduled === 'true' && (
            <View style={[styles.badge, { backgroundColor: '#FFA500' }]}>
              <Ionicons name="time" size={16} color="#FFF" />
              <Text style={styles.badgeText}>Programmé : {scheduledLabel ?? 'Voir confirmation'}</Text>
            </View>
          )}

          <Pressable
            style={[styles.homeBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  successIcon: { marginBottom: 20 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 26, marginBottom: 10, textAlign: 'center' },
  message: { fontFamily: 'Outfit_400Regular', fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },

  // Per-order block
  orderBlock: { width: '100%', marginBottom: 16 },
  orderBlockBordered: {
    borderWidth: 1,
    borderColor: '#E8D8C4',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FDFAF6',
  },
  orderBlockLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  bakeryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    backgroundColor: '#f9f5ff',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bakeryLabel: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginBottom: 2 },
  bakeryName: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  extraFeeNote: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#e65100', marginTop: 2 },

  codeBox: {
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  codeLabel: { fontFamily: 'Outfit_400Regular', textAlign: 'center', fontSize: 13 },
  codeValue: { fontFamily: 'Outfit_700Bold', fontSize: 26, letterSpacing: 2, textAlign: 'center', marginTop: 4 },

  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  invoiceText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
    gap: 8,
  },
  badgeText: { fontFamily: 'Outfit_600SemiBold', color: '#FFF' },

  homeBtn: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  homeBtnText: { fontFamily: 'Outfit_700Bold', color: '#FFF', fontSize: 16 },
});
