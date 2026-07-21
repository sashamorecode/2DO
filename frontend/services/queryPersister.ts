import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

/**
 * React Query persister backed by AsyncStorage.
 *
 * Only persists the user's own data (todos, tags, single-todo lookups).
 * Social queries (feed, friends, body-double) are NOT persisted — they
 * require network to be useful and would only show stale data.
 */

const STORAGE_KEY = 'RQ_CACHE';

/** Query-key prefixes we persist. Everything else is skipped. */
const PERSISTED_PREFIXES = ['todos', 'tags', 'todo'];

function shouldPersist(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  const root = queryKey[0];
  if (typeof root !== 'string') return false;
  return PERSISTED_PREFIXES.includes(root);
}

export const asyncStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      // Filter to only the query keys we care about.
      const filtered = {
        ...client,
        clientState: {
          ...client.clientState,
          queries: client.clientState.queries.filter((q) =>
            shouldPersist(q.queryKey)
          ),
        },
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (err) {
      // AsyncStorage can fail if the data is too large. Swallow — the
      // in-memory cache is still valid for the current session.
      console.warn('[queryPersister] failed to persist:', err);
    }
  },

  restoreClient: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      return JSON.parse(raw) as PersistedClient;
    } catch {
      // Corrupted or unreadable cache — start fresh.
      await AsyncStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
  },

  removeClient: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
