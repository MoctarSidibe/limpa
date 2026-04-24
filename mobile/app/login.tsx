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

// ── Smoke puff ───────────────────────────────────────────────────
function SmokePuff({ delay, x }: { delay: number; x: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0, duration: 1, useNativeDriver: true }), // reset
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -38] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.55, 0.25, 0] });
  const scale      = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.3] });

  return (
    <Animated.View
      style={[styles.smokePuff, { left: x, opacity, transform: [{ translateY }, { scale }] }]}
    />
  );
}

// ── Animated logo (decorative) ─────────────────────────────────
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
        <SmokePuff delay={0}    x={88} />
        <SmokePuff delay={600}  x={105} />
        <SmokePuff delay={1200} x={122} />
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

const { width: SW, height: SH } = Dimensions.get('screen');

// ── Login Screen ─────────────────────────────────────────────────
export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const pinRef = useRef<any>(null);

  const handleLogin = async () => {
    if (!phone || !pin) {
      Alert.alert('Champs manquants', 'Veuillez renseigner votre numéro et votre code PIN.');
      return;
    }
    try {
      await login(phone, pin);
      // AuthGuard handles role-based routing
    } catch (e: any) {
      Alert.alert('Connexion échouée', e.message || 'Vérifiez vos identifiants.');
    }
  };

  return (
    <LinearGradient
      colors={['#6B3A1F', '#A0622A', '#C8904A', '#E8C090']}
      style={styles.gradient}
    >
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
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Logo Zone */}
        <View style={styles.logoZone}>
          <AnimatedLogo />
          <Text style={styles.tagline}>Commandez · Programmez · Savourez</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>
          <Text style={styles.cardSubtitle}>Entrez votre numéro et votre PIN.</Text>

          {/* Phone */}
          <View style={[styles.inputWrapper, focused === 'phone' && styles.inputFocused]}>
            <Ionicons name="call-outline" size={20} color={focused === 'phone' ? '#D4A46C' : '#999'} style={styles.inputIcon} />
            <TextInput
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

          {/* PIN */}
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
              returnKeyType="done"
              autoCorrect={false}
              onFocus={() => setFocused('pin')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
              <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
            </Pressable>
          </View>

          {/* Simple Login Button */}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
          >
            {isLoading
              ? <ActivityIndicator color="#FFF" />
              : <View style={styles.btnRow}>
                  <Text style={styles.btnText}>Se Connecter</Text>
                  <Text style={styles.btnEmoji}>🥖</Text>
                </View>
            }
          </Pressable>

          {/* Register link */}
          <Pressable onPress={() => router.replace('/register')} style={styles.registerLink}>
            <Text style={styles.registerText}>Pas encore de compte ?</Text>
            <Text style={styles.registerBold}>Créer un compte</Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const PILL_W = 210;
const PILL_H = 86;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  bgPattern: { position: 'absolute', width: SW, height: SH, opacity: 0.10 },

  kav: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },

  // Logo (decorative)
  logoZone: { alignItems: 'center', marginBottom: 8 },
  logoWrapper: { alignItems: 'center', marginBottom: 12 },
  smokeZone: { position: 'absolute', top: -36, width: PILL_W, height: 40, alignSelf: 'center' },
  smokePuff: {
    position: 'absolute', bottom: 0,
    width: 10, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  logoPill: {
    width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  logoEmoji: { fontSize: 46 },
  logoLabel: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: '#FFF', letterSpacing: 1 },
  tagline: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginTop: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Form card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 18,
  },
  cardTitle: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#1A0A00', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#888', marginBottom: 22 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 16,
    paddingHorizontal: 16, marginBottom: 14, height: 54,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputFocused: {
    backgroundColor: '#FFF9F4',
    borderColor: '#D4A46C',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 16, color: '#222' },
  eyeBtn: { padding: 4 },

  // Simple login button
  btn: {
    backgroundColor: '#D4A46C',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    shadowColor: '#D4A46C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#FFF' },
  btnEmoji: { fontSize: 20 },

  registerLink: { marginTop: 16, alignItems: 'center' },
  registerText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: '#666' },
  registerBold: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#C8703A' },
});
