import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const BRAND = '#D4A46C';
const VERSION = '1.0.0';

export default function AboutModal() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();

  const rows = [
    { icon: 'shield-checkmark-outline', label: 'Paiements sécurisés', sub: 'Portefeuille virtuel chiffré' },
    { icon: 'location-outline', label: 'Géolocalisation', sub: 'Boulangerie la plus proche auto-sélectionnée' },
    { icon: 'repeat-outline', label: 'Commandes récurrentes', sub: 'Abonnez-vous pour recevoir votre pain tous les jours' },
    { icon: 'gift-outline', label: 'Offrir à un proche', sub: 'Envoyez une commande en cadeau' },
    { icon: 'star-outline', label: 'Programme fidélité', sub: '1 point pour 100 FCFA rechargés' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={theme.icon} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>À propos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>🥖</Text>
          <Text style={styles.appName}>Lim<Text style={{ color: BRAND }}>pa</Text></Text>
          <Text style={[styles.version, { color: theme.icon }]}>Version {VERSION}</Text>
        </View>

        <Text style={[styles.tagline, { color: theme.icon }]}>
          Commandez vos pains et pâtisseries fraîches en quelques secondes, livrés ou à récupérer en boulangerie.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
              <View style={[styles.iconBox, { backgroundColor: BRAND + '20' }]}>
                <Ionicons name={row.icon as any} size={18} color={BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{row.label}</Text>
                <Text style={[styles.rowSub, { color: theme.icon }]}>{row.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={() => Linking.openURL('mailto:support@limpa.app')} style={[styles.link, { borderColor: theme.border }]}>
          <Ionicons name="mail-outline" size={18} color={BRAND} />
          <Text style={[styles.linkText, { color: theme.text }]}>support@limpa.app</Text>
        </Pressable>

        <Text style={[styles.copy, { color: theme.icon }]}>
          © {new Date().getFullYear()} Limpa. Tous droits réservés.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 18 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  content: { padding: 24, alignItems: 'center' },
  logoRow: { alignItems: 'center', marginBottom: 16 },
  logoEmoji: { fontSize: 56 },
  appName: { fontFamily: 'Outfit_700Bold', fontSize: 32, marginTop: 8 },
  version: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 4 },
  tagline: { fontFamily: 'Outfit_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  rowSub: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  linkText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  copy: { fontFamily: 'Outfit_400Regular', fontSize: 12 },
});
