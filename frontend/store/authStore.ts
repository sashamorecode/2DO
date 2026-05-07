import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

interface User {
  id: string;
  username: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoaded: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoaded: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },

  loadFromStorage: async () => {
    try {
      const raw = await SecureStore.getItemAsync(TOKEN_KEY);
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
