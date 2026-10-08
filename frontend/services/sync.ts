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
 * - On client error (4xx) → the server rejected the batch; retry each
 *   entry individually and drop only those it rejects, then refetch.
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
        '[sync] batch rejected, flushing entries individually:',
        err?.response?.data ?? err?.message ?? err
      );
      await flushIndividually();
      // Leave local caches untouched while mutations remain queued so the UI
      // keeps showing changes the server has not accepted yet.
      if (useOfflineQueue.getState().queue.length === 0) {
        await reconcileCaches();
      }
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

type SyncResult = Awaited<ReturnType<typeof todosApi.sync>>;
type FlushOutcome = 'ok' | 'transient' | 'permanent';

/**
 * Fall back to per-entry sync when the server rejects the whole batch. Each
 * entry is retried on its own so one malformed item cannot discard unrelated
 * local changes; only entries the server rejects outright are dropped. If an
 * entry fails transiently the rest are left queued for the next reconnect.
 */
async function flushIndividually(): Promise<void> {
  const pending = () => useOfflineQueue.getState().queue;

  // Tags first so todos can reference them. Splitting the batch loses the
  // server's within-request remap (a tag renamed onto an existing one is
  // adopted and the client's row is removed), so persist the canonical ID back
  // onto the queued todos — otherwise a later pass sends the dead client ID and
  // the server silently drops the association.
  for (const mutation of pending().filter((m) => m.resource === 'tag' && m.op === 'upsert')) {
    const outcome = await flushMutation(mutation, buildPayload([mutation]), (result) => {
      const canonicalId = result.tags?.[0]?.id;
      if (canonicalId && canonicalId !== mutation.resourceId) {
        useOfflineQueue.getState().remapTagIds(mutation.resourceId, canonicalId);
      }
    });
    // A transient tag failure must not let dependent todos sync first.
    if (outcome === 'transient') return;
  }

  for (const mutation of pending().filter((m) => m.resource === 'todo' && m.op === 'upsert')) {
    if ((await flushMutation(mutation, buildPayload([mutation]))) === 'transient') return;
  }

  for (const mutation of pending().filter((m) => m.op === 'delete')) {
    if ((await flushMutation(mutation, buildPayload([mutation]))) === 'transient') return;
  }
}

async function flushMutation(
  mutation: QueuedMutation,
  payload: SyncPayload,
  onSuccess?: (result: SyncResult) => void
): Promise<FlushOutcome> {
  try {
    const result = await todosApi.sync(payload);
    onSuccess?.(result);
    useOfflineQueue.getState().removeMany([mutation.id]);
    return 'ok';
  } catch (err: any) {
    if (isNonRetryable(err)) {
      console.warn(
        '[sync] dropping rejected mutation:',
        mutation.resource,
        mutation.resourceId,
        err?.response?.data ?? err?.message ?? err
      );
      useOfflineQueue.getState().removeMany([mutation.id]);
      return 'permanent';
    }
    return 'transient';
  }
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
  // A malformed payload (400/422) or an ownership conflict (409) will never
  // succeed on retry. Anything else (auth, server errors) keeps the queue so
  // we never silently lose a user's local changes.
  return status === 400 || status === 409 || status === 422;
}
