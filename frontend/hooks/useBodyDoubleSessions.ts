import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { bodyDoubleApi } from '../services/bodyDouble.api';
import { todosApi } from '../services/todos.api';
import { visibleBodyDoubleSessions } from '../services/bodyDoubleVisibility';
import { useAuthStore } from '../store/authStore';
import { useOfflineStore } from '../store/offlineStore';
import { useTodayKey } from './useTodayKey';

export function useBodyDoubleSessions(enabled: boolean, role?: 'invitee') {
  const timezone = useAuthStore((s) => s.user?.timezone);
  const online = useOfflineStore((s) => s.isOnline);
  const today = useTodayKey(timezone);
  // Observe local-first task mutations without issuing additional requests.
  const pending = useQuery({ queryKey: ['todos', 'pending'], queryFn: () => todosApi.list({ status: 'pending' }), enabled: false });
  const completed = useQuery({ queryKey: ['todos', 'completed'], queryFn: () => todosApi.list({ status: 'completed' }), enabled: false });
  const query = useQuery({
    queryKey: role ? ['body-double-sessions', role] : ['body-double-sessions'],
    queryFn: () => bodyDoubleApi.listSessions(role),
    enabled: enabled && online,
    staleTime: 0,
    refetchInterval: enabled && online ? 30_000 : false,
  });
  const refresh = useCallback(() => {
    if (enabled && online) void query.refetch();
  }, [enabled, online, query.refetch]);
  useFocusEffect(refresh);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription?.remove();
  }, [refresh]);
  const data = useMemo(() => visibleBodyDoubleSessions(
    query.data ?? [], today, timezone, [...(pending.data ?? []), ...(completed.data ?? [])]
  ), [query.data, today, timezone, pending.data, completed.data]);
  return { ...query, data };
}
