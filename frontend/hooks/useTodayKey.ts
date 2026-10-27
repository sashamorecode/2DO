import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDayKeyInTimeZone } from '../services/todoDates';

export function useTodayKey(timezone?: string): string {
  const [today, setToday] = useState(() => getDayKeyInTimeZone(new Date(), timezone)!);
  const update = useCallback(() => {
    setToday(getDayKeyInTimeZone(new Date(), timezone)!);
  }, [timezone]);

  useFocusEffect(update);

  useEffect(() => {
    update();
    // Refresh across midnight, including after the app resumes from sleep.
    const timer = setInterval(update, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [update]);

  // Apply a changed profile timezone immediately, before the effect runs.
  return getDayKeyInTimeZone(new Date(), timezone) ?? today;
}
