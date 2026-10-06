import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  ensureNotificationSetup,
  getConfiguredProjectId,
  isRemotePushConfigured,
} from '../services/notifications';

// Avoid redundant PUTs when re-checking on foreground.
let lastRegisteredPushToken: string | null = null;

export function useNotifications() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      lastRegisteredPushToken = null;
      return;
    }

    const attempt = () => {
      void (async () => {
        const granted = await ensureNotificationSetup();
        if (granted && isRemotePushConfigured()) {
          await registerForPushNotifications(token);
        }
      })().catch((e) => {
        console.error('[notifications] Setup failed:', e instanceof Error ? e.message : String(e));
      });
    };

    attempt();
    // Permission may be granted later in Settings; re-check on foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt();
    });
    return () => sub.remove();
  }, [token]);
}

async function registerForPushNotifications(token: string) {
  try {
    const projectId = getConfiguredProjectId();
    if (!projectId) return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (useAuthStore.getState().token !== token) return;
    if (lastRegisteredPushToken === pushToken) return;

    await api.put('/me/push-token', { token: pushToken });
    lastRegisteredPushToken = pushToken;
  } catch (e) {
    // Log only a safe summary: an Axios error here would carry the push token
    // and bearer token in its config.
    console.error(
      '[notifications] Push token registration failed:',
      e instanceof Error ? e.message : String(e)
    );
  }
}
