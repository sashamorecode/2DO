import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, usePathname } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import type { Todo } from '../services/todos.api';
import { deriveIconState, type IconState } from '../services/deriveIconState';

type IconNavigation = NativeStackNavigationProp<ParamListBase>;
type Auth = ReturnType<typeof useAuthStore.getState>;

// Survive layout unmounts, but never leave callbacks running after cleanup.
let lastAccountId: string | null = null;
let needsAccountReset = false;
let warned = false;

function warnOnce(error: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[app-icon] Failed to update app icon:', error instanceof Error ? error.message : String(error));
}

function recordAccount(auth: Auth) {
  if (!auth.isLoaded) return;
  const accountId = auth.token ? auth.user?.id ?? null : null;
  if (lastAccountId && lastAccountId !== accountId) needsAccountReset = true;
  lastAccountId = accountId;
}

export function useDynamicAppIcon() {
  const qc = useQueryClient();
  const navigation = useNavigation<IconNavigation>();
  const pathname = usePathname();
  const lastSuccessfulState = useRef<IconState | null>(null);
  const settleNavigationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Descendant path changes restart quiet settling.
    settleNavigationRef.current?.();
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let api: typeof import('expo-dynamic-app-icon');
    try {
      // The package resolves its native module at import time. Expo Go is a
      // silent no-op; only load the package once the optional module exists.
      if (!requireOptionalNativeModule('ExpoDynamicAppIcon')) return;
      api = require('expo-dynamic-app-icon') as typeof import('expo-dynamic-app-icon');
    } catch (error) {
      warnOnce(error);
      return;
    }
    try {
      const icon = api.getAppIcon();
      const knownStates: Record<string, IconState> = {
        '': 'DEFAULT',
        DEFAULT: 'DEFAULT',
        yellow: 'yellow',
        red: 'red',
      };
      lastSuccessfulState.current = knownStates[icon] ?? null;
    } catch (error) {
      warnOnce(error);
    }

    let cancelled = false;
    let navigationSettled = false;
    const transitions = new Set<string | IconNavigation>();
    let work: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    let cacheTimer: ReturnType<typeof setTimeout> | null = null;
    let navigationTimer: ReturnType<typeof setTimeout> | null = null;
    let minuteTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelWork = () => {
      work?.cancel();
      work = null;
    };
    const safeToWrite = () => !cancelled && AppState.currentState === 'active'
      && navigationSettled && transitions.size === 0;
    const write = (state: IconState): boolean => {
      if (lastSuccessfulState.current === state) return true;
      try {
        if (api.setAppIcon(state === 'DEFAULT' ? '' : state) === false) {
          warnOnce('setAppIcon returned false');
          return false;
        }
        lastSuccessfulState.current = state;
        return true;
      } catch (error) {
        warnOnce(error);
        return false;
      }
    };

    const queueEvaluation = () => {
      cancelWork();
      if (!safeToWrite()) return;
      work = InteractionManager.runAfterInteractions(() => {
        work = null;
        if (!safeToWrite()) return;
        const auth = useAuthStore.getState();
        recordAccount(auth);
        if (!auth.isLoaded) return;
        // A failed reset blocks all new-account colors until DEFAULT succeeds.
        if (needsAccountReset) {
          if (write('DEFAULT')) {
            needsAccountReset = false;
            queueEvaluation();
          }
          return;
        }
        const userId = auth.user?.id;
        if (!auth.token || !userId) return;
        // Read here, not when scheduling: both auth and the cache may change
        // while interactions/navigation are settling.
        const todos = qc.getQueryData<Todo[]>(['todos', 'pending']);
        if (todos === undefined) return;
        write(deriveIconState(todos.filter((todo) => todo.user_id === userId), new Date()));
      });
    };

    const settleNavigation = () => {
      navigationSettled = false;
      cancelWork();
      if (navigationTimer !== null) clearTimeout(navigationTimer);
      navigationTimer = setTimeout(() => {
        navigationTimer = null;
        navigationSettled = true;
        queueEvaluation();
      }, 250);
    };
    settleNavigationRef.current = settleNavigation;

    const handleAuth = () => {
      cancelWork();
      if (cacheTimer !== null) clearTimeout(cacheTimer);
      cacheTimer = null;
      const auth = useAuthStore.getState();
      recordAccount(auth);
      // Zustand fires synchronously, before AuthGuard's redirect effect can
      // unmount us. Account resets are the sole exception to deferred writes.
      if (auth.isLoaded && needsAccountReset && safeToWrite() && write('DEFAULT')) {
        needsAccountReset = false;
      }
      queueEvaluation();
    };
    const unsubscribeAuth = useAuthStore.subscribe((auth, previous) => {
      if (auth.isLoaded !== previous.isLoaded || auth.token !== previous.token
        || auth.user?.id !== previous.user?.id) handleAuth();
    });

    const unsubscribeCache = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key[0] !== 'todos' || key[1] !== 'pending') return;
      cancelWork();
      if (cacheTimer !== null) clearTimeout(cacheTimer);
      cacheTimer = setTimeout(() => {
        cacheTimer = null;
        queueEvaluation();
      }, 250);
    });
    const appStateSub = AppState.addEventListener('change', (state) => {
      cancelWork();
      if (state === 'active') queueEvaluation();
    });

    // Some router parents aren't stacks; unsupported transition subscriptions
    // are harmless, while their state events still provide a settling window.
    const navigationUnsubscribers: Array<() => void> = [];
    for (let nav: IconNavigation | undefined = navigation; nav; nav = nav.getParent<IconNavigation | undefined>()) {
      const current = nav;
      navigationUnsubscribers.push(
        current.addListener('state', settleNavigation),
        current.addListener('transitionStart', (event) => {
          transitions.add(event.target ?? current);
          settleNavigation();
        }),
        current.addListener('transitionEnd', (event) => {
          transitions.delete(event.target ?? current);
          settleNavigation();
        })
      );
    }

    recordAccount(useAuthStore.getState());
    settleNavigation();
    minuteTimer = setTimeout(function tick() {
      queueEvaluation();
      minuteTimer = setTimeout(tick, 60_000);
    }, 60_000 - Date.now() % 60_000);

    return () => {
      cancelled = true;
      settleNavigationRef.current = null;
      cancelWork();
      if (cacheTimer !== null) clearTimeout(cacheTimer);
      if (navigationTimer !== null) clearTimeout(navigationTimer);
      if (minuteTimer !== null) clearTimeout(minuteTimer);
      unsubscribeAuth();
      unsubscribeCache();
      appStateSub.remove();
      navigationUnsubscribers.forEach((unsubscribe) => unsubscribe());
      // Capture any auth change at teardown without resetting for an ordinary
      // navigation unmount. An unsafe/failed reset waits for a safe next mount.
      recordAccount(useAuthStore.getState());
    };
  }, [qc, navigation]);
}
