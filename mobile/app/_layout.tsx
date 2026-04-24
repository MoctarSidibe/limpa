import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Constants from 'expo-constants';

if (Constants.appOwnership !== 'expo') {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

SplashScreen.preventAutoHideAsync();

// Auth guard — waits for AsyncStorage restore before deciding where to navigate
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isRestoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';

    if (!user && inTabsGroup) {
      router.replace('/login');
    } else if (user && onAuthScreen) {
      const role = user.role;
      if (role === 'COURIER' || role === 'LIVREUR') {
        router.replace('/(tabs)/courier');
      } else if (role === 'BAKER' || role === 'BOULANGER') {
        router.replace('/(tabs)/baker');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, isRestoring, segments]);

  return <>{children}</>;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <CartProvider>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="register" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="success" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </AuthGuard>
          <StatusBar style="auto" />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
