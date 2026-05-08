import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { View } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { configureGoogleSignIn } from '../services/googleSignIn';
import { CelebrationHost } from '../components/completion/Celebration';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
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

  useEffect(() => {
    configureGoogleSignIn();
    loadFromStorage();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <AuthGuard />
        <CelebrationHost />
      </View>
    </QueryClientProvider>
  );
}
