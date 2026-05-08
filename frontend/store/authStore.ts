import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export interface User {
  id: string;
  username: string | null;
  email: string;
  timezone?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoaded: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoaded: false,

  setAuth: async (token, user) => {
    await storage.setItem(TOKEN_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },

  setUser: async (user) => {
    const { token } = get();
    if (token) {
      await storage.setItem(TOKEN_KEY, JSON.stringify({ token, user }));
    }
    set({ user });
  },

  clearAuth: async () => {
    await storage.deleteItem(TOKEN_KEY);
    set({ token: null, user: null });
  },

  loadFromStorage: async () => {
    try {
      const raw = await storage.getItem(TOKEN_KEY);
      if (raw) {
        const { token, user } = JSON.parse(raw);
        set({ token, user, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));
