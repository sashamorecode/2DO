import { QueryClient } from '@tanstack/react-query';
import { getIsOnline } from './networkStatus';
import { useOfflineQueue, QueuedMutation } from './offlineQueue';
import { tagsApi, Tag, CreateTagInput } from './tags.api';

/**
 * Offline-aware tag mutations.
 *
 * Same local-first pattern as todos.api.offline.ts:
 * 1. Optimistically update the React Query cache.
 * 2. Try the API if online.
 * 3. Queue for later if offline or if the API call fails.
 */

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function optimisticTag(input: CreateTagInput, userId: string): Tag {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    user_id: userId,
    name: input.name,
    color: input.color,
    created_at: now,
    updated_at: now,
  };
}

function addToTagCache(qc: QueryClient, tag: Tag): void {
  qc.setQueryData<Tag[]>(['tags'], (old) => [...(old ?? []), tag]);
}

function updateInTagCache(qc: QueryClient, tag: Tag): void {
  qc.setQueryData<Tag[]>(['tags'], (old) =>
    (old ?? []).map((t) => (t.id === tag.id ? tag : t))
  );
}

function removeFromTagCache(qc: QueryClient, id: string): void {
  qc.setQueryData<Tag[]>(['tags'], (old) => (old ?? []).filter((t) => t.id !== id));
}

function enqueueTagOp(
  op: QueuedMutation['op'],
  resourceId: string | undefined,
  payload: any
): void {
  useOfflineQueue.getState().enqueue({
    op,
    resource: 'tag',
    resourceId,
    payload,
    clientUpdatedAt: new Date().toISOString(),
  });
}

export interface OfflineTagOps {
  createTag: (input: CreateTagInput) => Promise<Tag>;
  updateTag: (id: string, input: CreateTagInput) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
}

export function useOfflineTagOps(qc: QueryClient, userId: string): OfflineTagOps {
  async function createTag(input: CreateTagInput): Promise<Tag> {
    const optimistic = optimisticTag(input, userId);
    addToTagCache(qc, optimistic);

    if (getIsOnline()) {
      try {
        const server = await tagsApi.create(input);
        removeFromTagCache(qc, optimistic.id);
        addToTagCache(qc, server);
        return server;
      } catch {
        enqueueTagOp('create', optimistic.id, input);
        return optimistic;
      }
    } else {
      enqueueTagOp('create', optimistic.id, input);
      return optimistic;
    }
  }

  async function updateTag(id: string, input: CreateTagInput): Promise<Tag> {
    const existing = qc.getQueryData<Tag[]>(['tags'])?.find((t) => t.id === id);
    const optimistic: Tag = {
      id,
      user_id: userId,
      name: input.name,
      color: input.color,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updateInTagCache(qc, optimistic);

    if (getIsOnline()) {
      try {
        const server = await tagsApi.update(id, input);
        updateInTagCache(qc, server);
        return server;
      } catch {
        enqueueTagOp('update', id, input);
        return optimistic;
      }
    } else {
      enqueueTagOp('update', id, input);
      return optimistic;
    }
  }

  async function deleteTag(id: string): Promise<void> {
    removeFromTagCache(qc, id);

    if (getIsOnline()) {
      try {
        await tagsApi.delete(id);
      } catch {
        enqueueTagOp('delete', id, null);
      }
    } else {
      enqueueTagOp('delete', id, null);
    }
  }

  return { createTag, updateTag, deleteTag };
}
