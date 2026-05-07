import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    registerForPushNotifications();
  }, [token]);
}

async function registerForPushNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put('/me/push-token', { token: pushToken });
  } catch (e) {
    console.warn('Push token registration failed:', e);
  }
}
