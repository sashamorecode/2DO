import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  syncTodoReminders,
  cancelUserReminders,
  ensureNotificationSetup,
} from '../services/notifications';
import { Todo } from '../services/todos.api';

/**
 * Reconciles on-device reminders with the local-first `['todos', 'pending']`
 * cache. Reminders are account-scoped and cancelled on logout/account switch.
 *
 * These local reminders are the source of truth for an owner's own do-date/
 * due-date reminders, so they run regardless of remote push. If remote Expo
 * push is enabled later, the backend Stage-1 owner notifications
 * (deadline_checker) must be disabled to avoid sending both.
 */
export function useTodoReminderSync() {
  const qc = useQueryClient();
  const isLoaded = useAuthStore((s) => s.isLoaded);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!token || !userId) {
      if (lastUserId.current) {
        void cancelUserReminders(lastUserId.current);
        lastUserId.current = null;
      }
      return;
    }

    // Switching directly between two signed-in accounts: cancel the previous
    // account's reminders before scheduling the new one's.
    if (lastUserId.current && lastUserId.current !== userId) {
      void cancelUserReminders(lastUserId.current);
    }
    lastUserId.current = userId;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = () => {
      const todos = qc.getQueryData<Todo[]>(['todos', 'pending']);
      if (todos === undefined) return;
      // Re-check setup on every run rather than caching it: permission may be
      // granted later (via the test button or system settings).
      void ensureNotificationSetup().then((granted) => {
        if (!cancelled && granted) void syncTodoReminders(userId, todos);
      });
    };

    run();

    const unsub = qc.getQueryCache().subscribe((event) => {
      const key = event?.query?.queryKey;
      if (!key || key[0] !== 'todos' || key[1] !== 'pending') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, 250);
    });

    // Re-run when returning to the foreground in case permission changed.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
      appStateSub.remove();
    };
  }, [isLoaded, token, userId, qc]);
}
