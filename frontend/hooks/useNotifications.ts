import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { ensureNotificationSetup, getConfiguredProjectId } from '../services/notifications';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const canRegisterRemote = Platform.OS !== 'web' && !isExpoGo;

export function useNotifications() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      // Request permission/channel setup first; remote registration checks
      // permission and would otherwise bail before the prompt resolves.
      const granted = await ensureNotificationSetup();
      if (granted && canRegisterRemote) {
        await registerForPushNotifications(token);
      }
    })().catch((e) => {
      console.error('[notifications] Setup failed:', e instanceof Error ? e.message : String(e));
    });
  }, [token]);
}

async function registerForPushNotifications(token: string) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = getConfiguredProjectId();
    if (!projectId) {
      console.warn('[notifications] No valid EAS projectId; remote push disabled. Set EXPO_PUBLIC_EAS_PROJECT_ID.');
      return;
    }

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (useAuthStore.getState().token !== token) return;
    await api.put('/me/push-token', { token: pushToken });
  } catch (e) {
    // Log only a safe summary: an Axios error here would carry the push token
    // and bearer token in its config.
    console.error(
      '[notifications] Push token registration failed:',
      e instanceof Error ? e.message : String(e)
    );
  }
}
