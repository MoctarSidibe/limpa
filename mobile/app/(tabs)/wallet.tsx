import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Image, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/constants/api';

const RECHARGE_AMOUNTS = [1000, 2000, 5000, 10000, 20000];
const BRAND = '#D4A46C';

export default function WalletScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { user, authHeader } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  
  const [activeSegment, setActiveSegment] = useState<'RECHARGE' | 'POINTS' | 'HISTORY'>('RECHARGE');
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  // Load real wallet balance
  const loadWallet = useCallback(async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const res = await fetch(`${BASE_URL}/api/user/${user.userId}/wallet`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance ?? 0);
        setPoints(data.points ?? 0);
      }
    } catch {
      // Keep zeros on network failure
    } finally {
      setLoadingWallet(false);
    }
  }, [user]);

  const loadActivity = useCallback(async () => {
    if (!user) return;
    setLoadingActivity(true);
    try {
      const res = await fetch(`${BASE_URL}/api/user/${user.userId}/activity`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setActivityData(data.activity ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivity(false);
    }
  }, [user]);

  useEffect(() => {
    loadWallet();
    loadActivity();
  }, [loadWallet, loadActivity]);

  const handleRecharge = async (provider: 'AIRTEL_MONEY' | 'MOOV_MONEY') => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/payment/recharge-wallet`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          userId: user.userId,
          amount: selectedAmount,
          provider,
          phone: user.phone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
        setPoints(data.total_points);
        Alert.alert(
          'Rechargement Réussi !',
          `${selectedAmount.toLocaleString('fr-FR')} FCFA ajoutés.\n🌟 +${data.points_gagnes} Points Fidélité !`
        );
        loadActivity(); // <--- Instantly refresh history feed!
      } else {
        Alert.alert('Erreur', data.error || 'Une erreur est survenue');
      }
    } catch {
      // Demo fallback
      setBalance(b => b + selectedAmount);
      setPoints(p => p + Math.floor(selectedAmount / 100));
      Alert.alert('Mode Démo', 'Connexion API indisponible. Solde mis à jour localement.');
      // Optionally fake a transaction in local state
      setActivityData(prev => [{
        id: Math.random().toString(),
        type: 'RECHARGE',
        title: `Rechargement via ${provider.replace('_', ' ')} (Démo)`,
        amount: selectedAmount,
        isPositive: true,
        createdAt: new Date().toISOString()
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemPoints = async () => {
    const pts = parseInt(pointsToRedeem, 10);
    if (!pts || pts < 100) { Alert.alert('Minimum', 'Il faut au moins 100 points pour échanger.'); return; }
    if (!user) return;
    setRedeemLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/user/${user.userId}/redeem-points`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ points: pts }),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setPoints(data.points);
        setPointsToRedeem('');
        Alert.alert('Points échangés !', `+${data.gained.toLocaleString('fr-FR')} FCFA ajoutés à votre solde.`);
        loadActivity();
      } else {
        Alert.alert('Erreur', data.error || 'Conversion impossible.');
      }
    } catch {
      Alert.alert('Erreur', 'Connexion impossible.');
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mon Portefeuille</Text>
        <Pressable onPress={loadWallet} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={22} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Virtual Card */}
        <LinearGradient
          colors={['#EAB676', '#D4A46C', '#BB8745']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { shadowColor: BRAND }]}
        >
          <View style={styles.cardGlassOverlay} />
          <Text style={styles.cardInfo}>SOLDE ACTUEL (FLOAT)</Text>
          {loadingWallet ? (
            <ActivityIndicator color="#FFF" size="large" style={{ marginVertical: 10 }} />
          ) : (
            <Text style={styles.balance}>{balance.toLocaleString('fr-FR')} FCFA</Text>
          )}
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={16} color={BRAND} />
            <Text style={[styles.pointsText, { color: BRAND }]}>{points} Points</Text>
          </View>
          {user?.name && (
            <Text style={styles.cardName}>{user.name.toUpperCase()}</Text>
          )}
          <Ionicons name="finger-print" size={100} color="rgba(255,255,255,0.07)" style={styles.bgIcon} />
        </LinearGradient>

        <View style={styles.segmentContainer}>
          <Pressable
            style={[styles.segmentBtn, activeSegment === 'RECHARGE' && styles.segmentActive]}
            onPress={() => setActiveSegment('RECHARGE')}
          >
            <Text style={[styles.segmentText, activeSegment === 'RECHARGE' ? { color: BRAND } : { color: theme.icon }]}>Recharger</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, activeSegment === 'POINTS' && styles.segmentActive]}
            onPress={() => setActiveSegment('POINTS')}
          >
            <Text style={[styles.segmentText, activeSegment === 'POINTS' ? { color: BRAND } : { color: theme.icon }]}>Points</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, activeSegment === 'HISTORY' && styles.segmentActive]}
            onPress={() => setActiveSegment('HISTORY')}
          >
            <Text style={[styles.segmentText, activeSegment === 'HISTORY' ? { color: BRAND } : { color: theme.icon }]}>Historique</Text>
          </Pressable>
        </View>

        <View style={styles.contentContainer}>
          {activeSegment === 'POINTS' ? (
            <View>
              <View style={[styles.pointsInfo, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 24 }]}>
                <Ionicons name="star" size={18} color={BRAND} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pointsInfoText, { color: theme.text, fontFamily: 'Outfit_700Bold', fontSize: 15 }]}>
                    {points} points disponibles
                  </Text>
                  <Text style={[styles.pointsInfoText, { color: theme.icon }]}>
                    = {(points * 10).toLocaleString('fr-FR')} FCFA (1 point = 10 FCFA)
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text }]}>Convertir en solde</Text>
              <Text style={[styles.subtitle, { color: theme.icon }]}>Minimum 100 points (1 000 FCFA)</Text>

              <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.card, marginBottom: 16 }]}>
                <Ionicons name="star-outline" size={20} color={BRAND} />
                <TextInput
                  style={[styles.amountInput, { color: theme.text }]}
                  keyboardType="numeric"
                  value={pointsToRedeem}
                  onChangeText={setPointsToRedeem}
                  placeholder="Ex: 500"
                  placeholderTextColor={theme.border}
                  maxLength={6}
                />
                <Text style={[styles.currencyLabel, { color: BRAND }]}>pts</Text>
              </View>

              {pointsToRedeem ? (
                <Text style={{ fontFamily: 'Outfit_600SemiBold', color: theme.icon, marginBottom: 16, textAlign: 'center' }}>
                  = {(parseInt(pointsToRedeem || '0', 10) * 10).toLocaleString('fr-FR')} FCFA
                </Text>
              ) : null}

              <Pressable
                style={[styles.rechargeButton, { backgroundColor: BRAND, justifyContent: 'center' }]}
                onPress={handleRedeemPoints}
                disabled={redeemLoading || points < 100}
              >
                {redeemLoading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={[styles.buttonText, { color: '#FFF', textAlign: 'center' }]}>Convertir en solde FCFA</Text>}
              </Pressable>
            </View>
          ) : activeSegment === 'RECHARGE' ? (
            <View>
              {/* Massive Amount Input - CashApp Style */}
              <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 24 }}>
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: theme.icon, marginBottom: 8 }}>
                  Montant à recharger
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <TextInput
                    style={{ fontFamily: 'Outfit_700Bold', fontSize: 56, color: theme.text, minWidth: 100, textAlign: 'center', paddingVertical: 0 }}
                    keyboardType="numeric"
                    value={selectedAmount ? String(selectedAmount) : ''}
                    onChangeText={(txt) => {
                      const numeric = txt.replace(/[^0-9]/g, '');
                      setSelectedAmount(numeric ? parseInt(numeric, 10) : 0);
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.border}
                    maxLength={7}
                  />
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: BRAND, marginLeft: 8, marginTop: 14 }}>
                    FCFA
                  </Text>
                </View>

                {/* Quick Chips Centered */}
                <View style={[styles.quickChipsBox, { justifyContent: 'center', marginTop: 16 }]}>
                  {[2000, 5000, 10000, 20000].map(amt => (
                    <Pressable
                      key={amt}
                      onPress={() => setSelectedAmount(amt)}
                      style={[
                        styles.quickChip,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        selectedAmount === amt && { backgroundColor: BRAND, borderColor: BRAND, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
                      ]}
                    >
                      <Text style={[
                        styles.quickChipText,
                        { color: theme.text },
                        selectedAmount === amt && { color: '#FFF' },
                      ]}>+{amt.toLocaleString('fr-FR')}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 10 }]}>Mode de paiement</Text>
          <Text style={[styles.subtitle, { color: theme.icon }]}>
            Rechargez et gagnez des points pour obtenir des pâtisseries gratuites !
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.rechargeButton,
              { backgroundColor: theme.card, shadowColor: '#000' },
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
            ]}
            onPress={() => handleRecharge('AIRTEL_MONEY')}
            disabled={loading}
          >
            <Image source={require('@/assets/images/airtel.png')} style={styles.logo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.buttonText, { color: theme.text }]}>Airtel Money</Text>
              <Text style={[styles.buttonSub, { color: theme.icon }]}>{user?.phone ?? '+241...'}</Text>
            </View>
            <Text style={[styles.amountPreview, { color: theme.primary }]}>{selectedAmount.toLocaleString('fr-FR')} FCFA</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.rechargeButton,
              { backgroundColor: theme.card, shadowColor: '#000' },
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
            ]}
            onPress={() => handleRecharge('MOOV_MONEY')}
            disabled={loading}
          >
            <Image source={require('@/assets/images/moov.png')} style={styles.logo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.buttonText, { color: theme.text }]}>Moov Money</Text>
              <Text style={[styles.buttonSub, { color: theme.icon }]}>{user?.phone ?? '+241...'}</Text>
            </View>
            <Text style={[styles.amountPreview, { color: theme.primary }]}>{selectedAmount.toLocaleString('fr-FR')} FCFA</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
          </Pressable>

          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loaderText, { color: theme.icon }]}>Simulation du prompt USSD Mobile Money...</Text>
              <Text style={[styles.loaderSub, { color: theme.icon }]}>Patientez 3 secondes...</Text>
            </View>
          )}

              {/* Points info */}
              <View style={[styles.pointsInfo, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                <Text style={[styles.pointsInfoText, { color: theme.icon }]}>
                  1 point gagné pour chaque 100 FCFA rechargés. Échangeables contre des produits gratuits !
                </Text>
              </View>
            </View>
          ) : activeSegment === 'HISTORY' ? (
            <View style={styles.historyContainer}>
              {loadingActivity ? (
                <ActivityIndicator color={BRAND} size="large" style={{ marginTop: 40 }} />
              ) : activityData.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ fontSize: 40 }}>📝</Text>
                  <Text style={[styles.pointsInfoText, { color: theme.icon, marginTop: 10 }]}>Aucune activité pour le moment.</Text>
                </View>
              ) : (
                activityData.map((item) => {
                  const isAirtel = item.provider === 'AIRTEL_MONEY';
                  const isMoov   = item.provider === 'MOOV_MONEY';
                  const isPoints = item.provider === 'POINTS';
                  return (
                    <View key={item.id} style={[styles.activityItem, { borderBottomColor: theme.border }]}>
                      {isAirtel ? (
                        <Image source={require('@/assets/images/airtel.png')} style={styles.activityLogo} resizeMode="contain" />
                      ) : isMoov ? (
                        <Image source={require('@/assets/images/moov.png')} style={styles.activityLogo} resizeMode="contain" />
                      ) : (
                        <View style={[styles.activityIconBox, { backgroundColor: isPoints ? '#F3E8FF' : item.isPositive ? '#E8F5E9' : '#FFF3E8' }]}>
                          <Ionicons
                            name={isPoints ? 'star' : item.isPositive ? 'arrow-down-outline' : 'bag-handle-outline'}
                            size={20}
                            color={isPoints ? '#7C3AED' : item.isPositive ? '#2E7D32' : '#C62828'}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.activityTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.activityDate, { color: theme.icon }]}>
                          {new Date(item.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </Text>
                      </View>
                      <Text style={[styles.activityAmount, { color: item.isPositive ? '#2E7D32' : theme.text }]}>
                        {item.isPositive ? '+' : '-'}{item.amount.toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 16, marginBottom: 20 },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 28 },
  refreshBtn: { padding: 8 },
  card: { marginHorizontal: 20, padding: 22, borderRadius: 24, position: 'relative', overflow: 'hidden', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 28, elevation: 12 },
  cardGlassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.4)', borderRadius: 24 },
  bgIcon: { position: 'absolute', right: -15, bottom: -15, transform: [{ rotate: '-10deg' }] },
  cardInfo: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Outfit_600SemiBold', fontSize: 13, marginBottom: 4, letterSpacing: 1 },
  balance: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 36, marginBottom: 2, letterSpacing: -0.5 },
  cardName: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Outfit_700Bold', fontSize: 14, marginTop: 12, letterSpacing: 1 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  pointsText: { fontFamily: 'Outfit_700Bold', fontSize: 15, marginLeft: 6 },
  
  segmentContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 30, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segmentActive: { borderBottomColor: BRAND },
  segmentText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  
  contentContainer: { padding: 20 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, marginBottom: 12 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  
  // Custom Input
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  amountInput: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 24, paddingVertical: 0 },
  currencyLabel: { fontFamily: 'Outfit_700Bold', fontSize: 16, paddingLeft: 10 },
  quickChipsBox: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  quickChipText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  
  // Fintech styled buttons
  rechargeButton: { 
    flexDirection: 'row', alignItems: 'center', padding: 20, 
    borderRadius: 20, marginBottom: 16, gap: 14,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 
  },
  logo: { width: 44, height: 44 },
  buttonText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  buttonSub: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 2 },
  amountPreview: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  
  loader: { marginTop: 20, alignItems: 'center' },
  loaderText: { marginTop: 10, fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  loaderSub: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12 },
  pointsInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 20 },
  pointsInfoText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18 },
  
  // History
  historyContainer: { marginTop: 10 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  activityIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  activityLogo: { width: 44, height: 44, borderRadius: 22 },
  activityTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  activityDate: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 4 },
  activityAmount: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
});
