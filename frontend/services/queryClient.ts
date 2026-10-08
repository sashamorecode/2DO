import { QueryClient } from '@tanstack/react-query';
import { asyncStoragePersister } from './queryPersister';
import { useOfflineQueue } from './offlineQueue';

/**
 * App-wide React Query client.
 *
 * Lives in its own module (rather than `app/_layout.tsx`) so non-React code
 * such as the sync engine can reconcile caches after replaying offline
 * mutations.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 5-minute stale time: persisted data stays fresh longer across app
      // restarts. When online, pull-to-refresh or mutations bring in fresh data.
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * Wipe all user-scoped local state. Called on logout so the next account can't
 * see a previous user's cached todos, queued mutations, or persisted queries.
 */
export async function resetLocalState(): Promise<void> {
  queryClient.clear();
  useOfflineQueue.getState().clearQueue();
  await asyncStoragePersister.removeClient();
}
