import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { syncTodoReminders, cancelUserReminders, ensureNotificationSetup } from '../services/notifications';
import { Todo } from '../services/todos.api';

/**
 * Reconciles on-device reminders with the local-first `['todos', 'pending']`
 * cache. Reminders are account-scoped and cancelled on logout.
 *
 * NOTE: these local reminders cover the same owner do-date/due-date cases that
 * the backend deadline worker also pushes (Stage 1). Remote push is currently
 * unconfigured (no EAS projectId/FCM), so only local reminders fire. If remote
 * push is enabled later, disable the backend Stage-1 owner notifications to
 * avoid sending both.
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
    let ready = false;

    const run = () => {
      if (!ready) return;
      const todos = qc.getQueryData<Todo[]>(['todos', 'pending']);
      if (todos === undefined) return;
      void syncTodoReminders(userId, todos);
    };

    // Ensure permission/channel exist before the first sync. Child effects run
    // before the parent AuthGuard's, so we cannot rely on useNotifications
    // having created the Android channel already.
    void ensureNotificationSetup().then((granted) => {
      if (cancelled) return;
      ready = granted;
      if (granted) run();
    });

    const unsub = qc.getQueryCache().subscribe((event) => {
      const key = event?.query?.queryKey;
      if (!key || key[0] !== 'todos' || key[1] !== 'pending') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, 250);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [isLoaded, token, userId, qc]);
}
