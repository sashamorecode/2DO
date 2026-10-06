import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { ensureNotificationSetup } from '../services/notifications';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const canRegisterRemote = Platform.OS !== 'web' && !isExpoGo;

export function useNotifications() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    void ensureNotificationSetup();
    if (canRegisterRemote) void registerForPushNotifications(token);
  }, [token]);
}

async function registerForPushNotifications(token: string) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const candidates: (string | undefined)[] = [
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    Constants.expoConfig?.extra?.eas?.projectId,
    Constants.easConfig?.projectId,
  ];
  const projectId = candidates.find((c): c is string => typeof c === 'string' && UUID_RE.test(c));
  if (!projectId) {
    console.warn('[notifications] No valid EAS projectId; remote push disabled. Set EXPO_PUBLIC_EAS_PROJECT_ID.');
    return;
  }

  try {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (useAuthStore.getState().token !== token) return;
    await api.put('/me/push-token', { token: pushToken });
  } catch (e) {
    console.error('[notifications] Push token registration failed:', e);
  }
}
