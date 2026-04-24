import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function SplashScreen() {
  const logoScale   = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity  = useRef(new Animated.Value(0)).current;
  const subY        = useRef(new Animated.Value(20)).current;
  const screenFade  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, damping: 12, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(subY,       { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(3200),
      Animated.timing(screenFade, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => router.replace('/login'));
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]}>
      <LinearGradient
        colors={['#3E1A0A', '#7A3818', '#B46A28', '#D4944A', '#ECC07A']}
        style={styles.gradient}
      >
        {/* ── Logo ── */}
        <Animated.View style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.emojiRing}>
            <Text style={styles.emoji}>🥖</Text>
          </View>
          <Text style={styles.brand}>Limpa</Text>
        </Animated.View>

        {/* ── Welcome text ── */}
        <Animated.View style={[styles.textBlock, { opacity: subOpacity, transform: [{ translateY: subY }] }]}>
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.diamond}>✦</Text>
            <View style={styles.line} />
          </View>
          <Text style={styles.welcome}>Bienvenue</Text>
          <Text style={styles.tagline}>Votre boulangerie à portée de main</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const RING = 148;

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32 },

  // Logo
  logoBlock: { alignItems: 'center', gap: 16 },

  emojiRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emoji: { fontSize: 72 },

  brand: {
    fontSize: 58,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
    letterSpacing: 5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },

  // Welcome
  textBlock: { alignItems: 'center', gap: 10, paddingHorizontal: 40 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 200,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  diamond: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.60)',
  },

  welcome: {
    fontSize: 28,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFF',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.20)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  tagline: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.4,
  },
});
