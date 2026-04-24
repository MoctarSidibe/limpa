import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Animated, Easing, Image, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const { width: SW, height: SH } = Dimensions.get('screen');

// ── Smoke puff ────────────────────────────────────────────────────
function SmokePuff({ delay, x }: { delay: number; x: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -34] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.55, 0.25, 0] });
  const scale      = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.3] });
  return (
    <Animated.View style={[styles.smokePuff, { left: x, opacity, transform: [{ translateY }, { scale }] }]} />
  );
}

// ── Animated logo ─────────────────────────────────────────────────
function AnimatedLogo() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.logoWrapper}>
      <View style={styles.smokeZone} pointerEvents="none">
        <SmokePuff delay={0}    x={80} />
        <SmokePuff delay={600}  x={95} />
        <SmokePuff delay={1200} x={110} />
      </View>
      <Animated.View style={[styles.logoPill, { transform: [{ scale: pulse }] }]}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>🥖</Text>
          <Text style={styles.logoLabel}>Limpa</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Register Screen ───────────────────────────────────────────────
export default function RegisterScreen() {
  const { register, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [pin, setPin]                 = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused]         = useState<string | null>(null);
  const phoneRef   = useRef<any>(null);
  const pinRef     = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  const handleRegister = async () => {
    if (!name || !phone || !pin || !confirmPin) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('PIN invalide', 'Le PIN doit avoir exactement 4 chiffres.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN incorrect', 'Les deux codes PIN ne correspondent pas.');
      return;
    }
    try {
      await register(name, phone, pin);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Inscription impossible. Numéro déjà utilisé ?');
    }
  };

  return (
    <LinearGradient colors={['#6B3A1F', '#A0622A', '#C8904A', '#E8C090']} style={styles.gradient}>
      <Image
        source={require('@/assets/images/baker-pattern.jpg')}
        style={styles.bgPattern}
        resizeMode="cover"
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Logo zone */}
        <View style={styles.logoZone}>
          <AnimatedLogo />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créer un compte</Text>
          <Text style={styles.cardSubtitle}>Commandez, offrez à vos proches ou programmez vos livraisons.</Text>

          <View style={[styles.inputWrapper, focused === 'name' && styles.inputFocused]}>
            <Ionicons name="person-outline" size={20} color={focused === 'name' ? '#D4A46C' : '#999'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Votre nom complet"
              placeholderTextColor="#BBB"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          <View style={[styles.inputWrapper, focused === 'phone' && styles.inputFocused]}>
            <Ionicons name="call-outline" size={20} color={focused === 'phone' ? '#D4A46C' : '#999'} style={styles.inputIcon} />
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder="Ex: +24106123456"
              placeholderTextColor="#BBB"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              returnKeyType="next"
              autoCorrect={false}
              autoComplete="tel"
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={() => pinRef.current?.focus()}
            />
          </View>

          <View style={[styles.inputWrapper, focused === 'pin' && styles.inputFocused]}>
            <Ionicons name="lock-closed-outline" size={20} color={focused === 'pin' ? '#D4A46C' : '#999'} style={styles.inputIcon} />
            <TextInput
              ref={pinRef}
              style={styles.input}
              placeholder="Code PIN (4 chiffres)"
              placeholderTextColor="#BBB"
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              returnKeyType="next"
              autoCorrect={false}
              onFocus={() => setFocused('pin')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <Pressable onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
              <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={focused === 'pin' ? '#D4A46C' : '#999'} />
            </Pressable>
          </View>

          <View style={[styles.inputWrapper, focused === 'confirm' && styles.inputFocused]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={focused === 'confirm' ? '#D4A46C' : '#999'} style={styles.inputIcon} />
            <TextInput
              ref={confirmRef}
              style={styles.input}
              placeholder="Confirmer le PIN"
              placeholderTextColor="#BBB"
              keyboardType="numeric"
              secureTextEntry={!showConfirm}
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
              returnKeyType="done"
              autoCorrect={false}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={handleRegister}
            />
            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={focused === 'confirm' ? '#D4A46C' : '#999'} />
            </Pressable>
          </View>

          <View style={styles.walletNotice}>
            <Ionicons name="wallet-outline" size={13} color="#D4A46C" />
            <Text style={styles.walletText}>Un Portefeuille sera créé automatiquement.</Text>
          </View>

          {/* Benefits strip */}
          <View style={styles.benefits}>
            <View style={styles.benefitChip}>
              <Text style={styles.benefitIcon}>🛵</Text>
              <Text style={styles.benefitText}>Livraison{'\n'}rapide</Text>
            </View>
            <View style={styles.benefitChip}>
              <Text style={styles.benefitIcon}>🎁</Text>
              <Text style={styles.benefitText}>Régalez{'\n'}vos proches</Text>
            </View>
            <View style={styles.benefitChip}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitText}>Wallet{'\n'}Limpa</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={handleRegister}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {isLoading
              ? <ActivityIndicator color="#FFF" />
              : <View style={styles.btnRow}>
                  <Text style={styles.btnText}>Créer mon compte</Text>
                  <Text style={styles.btnEmoji}>🥐</Text>
                </View>
            }
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Déjà un compte ?{' '}
              <Text style={styles.loginBold}>Se connecter</Text>
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const PILL_W = 190;
const PILL_H = 74;

const styles = StyleSheet.create({
  gradient:  { flex: 1 },
  bgPattern: { position: 'absolute', width: SW, height: SH, opacity: 0.10 },

  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },

  // Logo
  logoZone:    { alignItems: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: 8 },
  smokeZone: {
    position: 'absolute', top: -30, width: PILL_W, height: 36, alignSelf: 'center',
  },
  smokePuff: {
    position: 'absolute', bottom: 0,
    width: 9, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  logoPill: {
    width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoEmoji: { fontSize: 38 },
  logoLabel: { fontSize: 28, fontFamily: 'Outfit_700Bold', color: '#FFF', letterSpacing: 1 },

  tagline: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Benefits
  benefits: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  benefitChip: {
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0D9C0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 2,
    minWidth: 82,
  },
  benefitIcon: { fontSize: 20 },
  benefitText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: '#C8903A',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 18,
  },
  cardTitle:    { fontSize: 22, fontFamily: 'Outfit_700Bold', color: '#1A0A00', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#888', marginBottom: 12 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 10, height: 48,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputFocused: {
    backgroundColor: '#FFF9F4',
    borderColor: '#D4A46C',
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 15, color: '#222' },
  eyeBtn:    { padding: 4 },

  walletNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8F0', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#F0D9C0',
    marginBottom: 12,
  },
  walletText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 11, color: '#C8903A' },

  btn: {
    backgroundColor: '#D4A46C',
    height: 50, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
    shadowColor: '#D4A46C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPressed: { opacity: 0.85 },
  btnRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:   { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#FFF' },
  btnEmoji:  { fontSize: 20 },

  loginLink: { marginTop: 14, alignItems: 'center' },
  loginText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: '#666' },
  loginBold: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#C8703A' },
});
