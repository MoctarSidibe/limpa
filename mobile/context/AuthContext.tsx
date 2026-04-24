import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '@/utils/push';
import { API_URL } from '@/constants/api';
const AUTH_KEY = '@limpa_user';

export interface AuthUser {
  userId: string;
  name: string;
  role: 'CLIENT' | 'COURIER' | 'BAKER' | 'ADMIN';
  phone: string;
  token: string;
  bakeryId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isRestoring: boolean; // true while reading AsyncStorage on launch
  login: (phone: string, pin: string) => Promise<void>;
  register: (name: string, phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  authHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // blocks guard until we know

  // Restore session from AsyncStorage on app launch
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (raw) {
          const saved: AuthUser = JSON.parse(raw);
          setUser(saved);
        }
      } catch {
        // Corrupted storage — ignore, user will re-login
      } finally {
        setIsRestoring(false);
      }
    };
    restore();
  }, []);

  const persist = async (u: AuthUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  };

  const authHeader = (): Record<string, string> => {
    if (!user?.token) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` };
  };

  const fetchWithTimeout = (url: string, options: RequestInit, ms = 10000): Promise<Response> => {
    const timeout: Promise<Response> = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    );
    return Promise.race([fetch(url, options), timeout]);
  };

  const login = async (phone: string, pin: string) => {
    setIsLoading(true);
    let pushToken: string | undefined;
    try {
      pushToken = await registerForPushNotificationsAsync();
    } catch { console.warn('Could not get push token'); }
    try {
      const resp = await fetchWithTimeout(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, pushToken }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Identifiants incorrects');
      }
      const data = await resp.json();
      await persist({ userId: data.userId, name: data.name, role: data.role, phone: data.phone, token: data.token, bakeryId: data.bakeryId ?? null });
    } catch (e: any) {
      if (e.message === 'TIMEOUT') throw new Error('Serveur inaccessible. Vérifiez votre connexion.');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, phone: string, pin: string) => {
    setIsLoading(true);
    let pushToken: string | undefined;
    try {
      pushToken = await registerForPushNotificationsAsync();
    } catch { console.warn('Could not get push token'); }
    try {
      const resp = await fetchWithTimeout(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, pin, pushToken }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erreur lors de l'inscription");
      }
      const data = await resp.json();
      await persist({ userId: data.userId, name: data.name, role: data.role, phone: data.phone, token: data.token, bakeryId: data.bakeryId ?? null });
    } catch (e: any) {
      if (e.message === 'TIMEOUT') throw new Error('Serveur inaccessible. Vérifiez votre connexion.');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isRestoring, login, register, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
