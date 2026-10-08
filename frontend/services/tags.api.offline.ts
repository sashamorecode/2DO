import { QueryClient } from '@tanstack/react-query';
import { getIsOnline } from './networkStatus';
import { useOfflineQueue } from './offlineQueue';
import { tagsApi, Tag, CreateTagInput } from './tags.api';

/**
 * Offline-aware tag mutations.
 *
 * Same local-first pattern as todos.api.offline.ts:
 * 1. Optimistically update the React Query cache.
 * 2. Try the API if online.
 * 3. Queue a full local snapshot for sync if offline or if the call fails.
 *
 * Queued payloads carry the client-generated ID so the server upserts under
 * the same ID. If a queued tag shares a name with an existing server tag, the
 * server adopts the existing row and remaps the association (see sync.go).
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

function toSyncTag(tag: Tag): Record<string, unknown> {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    client_updated_at: tag.updated_at,
  };
}

function enqueueTagUpsert(tag: Tag): void {
  useOfflineQueue.getState().enqueue({
    op: 'upsert',
    resource: 'tag',
    resourceId: tag.id,
    payload: toSyncTag(tag),
    clientUpdatedAt: new Date().toISOString(),
  });
}

function enqueueTagDelete(id: string): void {
  useOfflineQueue.getState().enqueue({
    op: 'delete',
    resource: 'tag',
    resourceId: id,
    payload: null,
    clientUpdatedAt: new Date().toISOString(),
  });
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
        enqueueTagUpsert(optimistic);
        return optimistic;
      }
    } else {
      enqueueTagUpsert(optimistic);
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
        enqueueTagUpsert(optimistic);
        return optimistic;
      }
    } else {
      enqueueTagUpsert(optimistic);
      return optimistic;
    }
  }

  async function deleteTag(id: string): Promise<void> {
    removeFromTagCache(qc, id);

    if (getIsOnline()) {
      try {
        await tagsApi.delete(id);
      } catch {
        enqueueTagDelete(id);
      }
    } else {
      enqueueTagDelete(id);
    }
  }

  return { createTag, updateTag, deleteTag };
}
