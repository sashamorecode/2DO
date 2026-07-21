import { getIsOnline } from './networkStatus';
import { getQueue, useOfflineQueue, QueuedMutation } from './offlineQueue';
import { todosApi } from './todos.api';
import { tagsApi } from './tags.api';

/**
 * Sync engine.
 *
 * Replays the offline mutation queue in FIFO order against the live API.
 * Called on app startup (after auth is loaded) and whenever the network
 * transitions from offline → online.
 *
 * Strategy:
 * - Process mutations sequentially to preserve causal order.
 * - On success → dequeue.
 * - On network error → stop processing (will retry on next reconnect).
 * - On non-retryable error (404, 409, 422) → dequeue anyway (discard).
 */

let syncing = false;

export async function processSyncQueue(): Promise<void> {
  if (syncing) return;
  if (!getIsOnline()) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  syncing = true;

  for (const mutation of queue) {
    if (!getIsOnline()) break; // Lost connectivity mid-sync.

    try {
      await applyMutation(mutation);
      useOfflineQueue.getState().dequeue(mutation.id);
    } catch (err: any) {
      // If it's a network error, stop processing — we'll retry later.
      if (isNetworkError(err)) {
        break;
      }
      // Non-retryable error (e.g. 404, 409, 422) — discard the mutation.
      console.warn(
        `[sync] discarding mutation ${mutation.id} (${mutation.op} ${mutation.resource}):`,
        err?.response?.data ?? err?.message ?? err
      );
      useOfflineQueue.getState().dequeue(mutation.id);
    }
  }

  syncing = false;
}

async function applyMutation(m: QueuedMutation): Promise<void> {
  if (m.resource === 'todo') {
    await applyTodoMutation(m);
  } else if (m.resource === 'tag') {
    await applyTagMutation(m);
  }
}

async function applyTodoMutation(m: QueuedMutation): Promise<void> {
  switch (m.op) {
    case 'create':
      await todosApi.create(m.payload);
      break;
    case 'update':
      if (!m.resourceId) throw new Error('missing resourceId for update');
      await todosApi.update(m.resourceId, m.payload);
      break;
    case 'delete':
      if (!m.resourceId) throw new Error('missing resourceId for delete');
      await todosApi.delete(m.resourceId);
      break;
    case 'complete':
      if (!m.resourceId) throw new Error('missing resourceId for complete');
      await todosApi.complete(m.resourceId);
      break;
    case 'reopen':
      if (!m.resourceId) throw new Error('missing resourceId for reopen');
      await todosApi.reopen(m.resourceId);
      break;
  }
}

async function applyTagMutation(m: QueuedMutation): Promise<void> {
  switch (m.op) {
    case 'create':
      await tagsApi.create(m.payload);
      break;
    case 'update':
      if (!m.resourceId) throw new Error('missing resourceId for update');
      await tagsApi.update(m.resourceId, m.payload);
      break;
    case 'delete':
      if (!m.resourceId) throw new Error('missing resourceId for delete');
      await tagsApi.delete(m.resourceId);
      break;
    default:
      throw new Error(`unsupported tag op: ${m.op}`);
  }
}

function isNetworkError(err: any): boolean {
  // Axios network errors have no response, or a 5xx status (server down).
  if (!err?.response) return true;
  const status = err.response.status;
  return status >= 500 || status === 429 || status === 0;
}
