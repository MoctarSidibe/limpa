import { Platform } from 'react-native';

// Lighter wheat-crust brown — replaces the old dark #7C4A1E everywhere
export const BRAND = '#D4A46C';

export const Colors = {
  light: {
    text: '#4A3B32',
    background: '#FAF8F5',
    tint: BRAND,
    icon: '#8C7A6B',
    tabIconDefault: '#8C7A6B',
    tabIconSelected: BRAND,
    card: '#FFFFFF',
    border: '#EAE0D5',
    primary: BRAND,
  },
  dark: {
    text: '#FDEFE4',
    background: '#2C241E',
    tint: '#E8B880',
    icon: '#A69282',
    tabIconDefault: '#A69282',
    tabIconSelected: '#E8B880',
    card: '#3A3028',
    border: '#4A3B32',
    primary: '#E8B880',
  },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
});
