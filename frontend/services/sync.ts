import { getIsOnline } from './networkStatus';
import { getQueue, useOfflineQueue, QueuedMutation } from './offlineQueue';
import { todosApi, SyncPayload } from './todos.api';
import { queryClient } from './queryClient';
import { useAuthStore } from '../store/authStore';

/**
 * Sync engine.
 *
 * Flushes the offline mutation queue to the server as a single batched
 * request. Called on app startup (after auth is loaded) and whenever the
 * network transitions from offline → online.
 *
 * Strategy:
 * - Coalesce the queue into full snapshots + delete tombstones.
 * - POST once to /sync, which upserts by client ID and applies tombstones.
 * - On success → drop the flushed entries and refetch local caches.
 * - On transient error (network / 5xx / 429) → keep entries, retry on
 *   the next reconnect.
 * - On client error (4xx) → the server rejected the payload; drop the
 *   flushed entries and refetch so local state matches the server.
 */

let syncing = false;

export async function processSyncQueue(): Promise<void> {
  if (syncing) return;
  if (!getIsOnline()) return;
  // The queue rehydrates from storage before the token does; never push it
  // unauthenticated or the server would reject (and we'd discard) it.
  if (!useAuthStore.getState().token) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  syncing = true;
  const flushedIds = queue.map((m) => m.id);

  try {
    await todosApi.sync(buildPayload(queue));
    useOfflineQueue.getState().removeMany(flushedIds);
    await reconcileCaches();
  } catch (err: any) {
    if (isNonRetryable(err)) {
      console.warn(
        '[sync] discarding rejected mutations:',
        err?.response?.data ?? err?.message ?? err
      );
      useOfflineQueue.getState().removeMany(flushedIds);
      await reconcileCaches();
    } else {
      console.warn('[sync] deferring queue until next reconnect:', err?.message ?? err);
    }
  } finally {
    syncing = false;
  }
}

function buildPayload(queue: QueuedMutation[]): SyncPayload {
  const payload: SyncPayload = {
    todos: [],
    tags: [],
    deleted_todo_ids: [],
    deleted_tag_ids: [],
  };

  for (const mutation of queue) {
    if (mutation.op === 'delete') {
      if (mutation.resource === 'todo') {
        payload.deleted_todo_ids.push(mutation.resourceId);
      } else {
        payload.deleted_tag_ids.push(mutation.resourceId);
      }
      continue;
    }

    if (mutation.resource === 'todo') {
      payload.todos.push(mutation.payload);
    } else {
      payload.tags.push(mutation.payload);
    }
  }

  return payload;
}

/** Pull fresh server state into the caches the offline store mirrors. */
async function reconcileCaches(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['todos'] }),
    queryClient.invalidateQueries({ queryKey: ['todo'] }),
    queryClient.invalidateQueries({ queryKey: ['tags'] }),
  ]);
}

function isNonRetryable(err: any): boolean {
  if (!err?.response) return false; // network error → retry
  const status = err.response.status;
  // Only a malformed payload is guaranteed to fail forever. Anything else
  // (auth, ownership, server errors) keeps the queue so we never silently
  // lose a user's local changes.
  return status === 400 || status === 422;
}
