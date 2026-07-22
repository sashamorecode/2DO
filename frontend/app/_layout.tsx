import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { useAuthStore } from '../store/authStore';
import { View } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { configureGoogleSignIn } from '../services/googleSignIn';
import { CelebrationHost } from '../components/completion/Celebration';
import { asyncStoragePersister } from '../services/queryPersister';
import { processSyncQueue } from '../services/sync';
import { getIsOnline } from '../services/networkStatus';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 5-minute stale time: persisted data stays fresh longer across
      // app restarts, reducing unnecessary refetches. When online,
      // pull-to-refresh or mutations will bring in fresh data.
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AuthGuard() {
  const { token, user, isLoaded, setUser } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  useNotifications();

  useEffect(() => {
    if (!isLoaded) return;
    const segs = segments as string[];
    const inAuth = segs[0] === '(auth)';
    const onOnboarding = inAuth && segs[1] === 'onboarding';
    const needsUsername = !!token && !!user && !user.username;

    if (!token) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    if (needsUsername) {
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }

    if (inAuth) {
      router.replace('/(app)');
    }
  }, [token, user, isLoaded, segments]);

  // Sync device timezone to backend when it changes (or is unset).
  useEffect(() => {
    if (!token || !user || !user.username) return;
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!deviceTz || deviceTz === user.timezone) return;
    import('../services/auth.api').then(({ authApi }) => {
      authApi
        .updateProfile({ timezone: deviceTz })
        .then((updated) => setUser(updated))
        .catch(() => {});
    });
  }, [token, user?.id, user?.timezone]);

  return <Slot />;
}

export default function RootLayout() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    configureGoogleSignIn();
    loadFromStorage();
  }, []);

  // Persist the React Query cache to AsyncStorage so todos and tags
  // survive app restarts when offline.
  useEffect(() => {
    persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
      maxAge: 7 * 24 * 60 * 60 * 1000, // discard caches older than 7 days
      buster: 'v1', // bump this to invalidate all persisted caches
    });
  }, []);

  // When the auth token is loaded and we're online, replay any queued
  // offline mutations.
  useEffect(() => {
    if (token && getIsOnline()) {
      processSyncQueue();
    }
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <AuthGuard />
        <CelebrationHost />
      </View>
    </QueryClientProvider>
  );
}
