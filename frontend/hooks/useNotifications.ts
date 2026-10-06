import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { ensureNotificationSetup, getConfiguredProjectId, isRemotePushConfigured } from '../services/notifications';

// Dedupe and coalesce registration, keyed by the auth token so a direct
// account switch never reuses the previous account's registration.
let lastRegistered: { authToken: string; pushToken: string } | null = null;
let inFlight: { authToken: string; promise: Promise<void> } | null = null;

export function useNotifications() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      lastRegistered = null;
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

function registerForPushNotifications(token: string): Promise<void> {
  if (inFlight && inFlight.authToken === token) return inFlight.promise;
  const promise = doRegister(token).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { authToken: token, promise };
  return promise;
}

async function doRegister(token: string) {
  try {
    const projectId = getConfiguredProjectId();
    if (!projectId) return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (useAuthStore.getState().token !== token) return;

    if (lastRegistered?.authToken === token && lastRegistered.pushToken === pushToken) return;

    await api.put('/me/push-token', { token: pushToken });
    lastRegistered = { authToken: token, pushToken };
  } catch (e) {
    // Log only a safe summary: an Axios error here would carry the push token
    // and bearer token in its config.
    console.error(
      '[notifications] Push token registration failed:',
      e instanceof Error ? e.message : String(e)
    );
  }
}
