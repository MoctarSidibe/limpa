import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const BRAND = '#D4A46C';

type ProductCardProps = {
  title: string;
  price: string;
  description: string;
  imageSource: any;
  quantity?: number;
  onPress?: () => void;
  onAdd?: () => void;
};

export function ProductCard({ title, price, description, imageSource, quantity = 0, onPress, onAdd }: ProductCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const selected = quantity > 0;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.card, shadowColor: theme.text },
        selected && styles.cardSelected,
      ]}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" />

        {/* Dark overlay when selected */}
        {selected && <View style={styles.imageOverlay} />}

        {/* Quantity pill — top right */}
        {selected && (
          <View style={styles.qtyPill}>
            <Ionicons name="checkmark" size={13} color="#FFF" />
            <Text style={styles.qtyText}>{quantity} ajouté{quantity > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Selected strip under image */}
      {selected && (
        <View style={styles.selectedStrip}>
          <Ionicons name="cart" size={14} color="#FFF" />
          <Text style={styles.stripText}>
            {quantity} × dans votre panier
          </Text>
          <Pressable onPress={onAdd} style={styles.stripAddBtn}>
            <Ionicons name="add" size={16} color={BRAND} />
          </Pressable>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.price, { color: BRAND }]}>{price}</Text>
        </View>
        <Text style={[styles.description, { color: theme.icon }]} numberOfLines={2}>
          {description}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: pressed ? '#BF9060' : BRAND },
          ]}
          onPress={onAdd}
        >
          <Ionicons name="bag-add-outline" size={18} color="#FFF" />
          <Text style={styles.addButtonText}>Ajouter au panier</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginVertical: 10,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // Highlighted border + stronger shadow when selected
  cardSelected: {
    borderColor: BRAND,
    shadowOpacity: 0.22,
    elevation: 10,
  },

  imageContainer: {
    height: 180,
    width: '100%',
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Subtle warm tint overlay on image when in cart
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212, 164, 108, 0.18)',
  },
  // Quantity pill top-right of image
  qtyPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  qtyText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },

  // Green strip shown below image when in cart
  selectedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  stripText: {
    flex: 1,
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
  },
  stripAddBtn: {
    backgroundColor: '#FFF',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 20, flex: 1 },
  price: { fontFamily: 'Outfit_700Bold', fontSize: 18, marginLeft: 10 },
  description: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
  },
});
