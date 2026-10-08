import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline mutation queue.
 *
 * When the device is offline, todo and tag mutations are persisted here so they
 * survive app restarts. The sync engine flushes them to the server (as a single
 * batched request) once connectivity returns.
 *
 * Mutations are coalesced per resource: a todo/tag has at most one queued
 * entry, holding its latest full snapshot (or a delete tombstone). This matches
 * the local-first model — the device always holds the current state, so only
 * the newest version ever needs to reach the server.
 *
 * SINGLE-DEVICE ASSUMPTION: this queue assumes each user only uses one device.
 * If the same user logs in on a second device, mutations queued on device A
 * won't be visible to device B, and server state may diverge. Multi-device
 * support would require CRDTs or vector clocks.
 */

export type MutationOp = 'upsert' | 'delete';
export type MutationResource = 'todo' | 'tag';

export interface QueuedMutation {
  /** Client-generated UUID, unique per queued entry (used for batch removal). */
  id: string;
  /** Whether the resource should be written or removed server-side. */
  op: MutationOp;
  /** Which resource type this mutation targets. */
  resource: MutationResource;
  /** The resource's client-generated ID. */
  resourceId: string;
  /** Full resource snapshot for 'upsert'; null for 'delete'. */
  payload: any;
  /** ISO-8601 timestamp set by the client when the mutation was queued. */
  clientUpdatedAt: string;
  /** ISO-8601 timestamp when this entry was created. */
  createdAt: string;
}

interface OfflineQueueState {
  queue: QueuedMutation[];
  enqueue: (mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) => void;
  dequeue: (id: string) => void;
  removeMany: (ids: string[]) => void;
  remapTagIds: (fromId: string, toId: string) => void;
  clearQueue: () => void;
}

function generateId(): string {
  // Simple UUID v4 generator — avoids a dependency just for this.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],

      enqueue: (mutation) => {
        const entry: QueuedMutation = {
          ...mutation,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        const queue = get().queue;
        const existing = queue.findIndex(
          (m) => m.resource === mutation.resource && m.resourceId === mutation.resourceId
        );
        if (existing !== -1) {
          // Coalesce: the newest state for a resource supersedes older entries.
          const next = queue.slice();
          next[existing] = entry;
          set({ queue: next });
          return;
        }
        set({ queue: [...queue, entry] });
      },

      dequeue: (id) => {
        set({ queue: get().queue.filter((m) => m.id !== id) });
      },

      removeMany: (ids) => {
        const remove = new Set(ids);
        set({ queue: get().queue.filter((m) => !remove.has(m.id)) });
      },

      remapTagIds: (fromId, toId) => {
        set({
          queue: get().queue.map((m) => {
            if (m.resource !== 'todo' || m.op !== 'upsert') return m;
            const tagIds = m.payload?.tag_ids as string[] | undefined;
            if (!tagIds?.includes(fromId)) return m;
            return {
              ...m,
              payload: {
                ...m.payload,
                tag_ids: tagIds.map((id) => (id === fromId ? toId : id)),
              },
            };
          }),
        });
      },

      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          const legacy = persistedState as { queue?: QueuedMutation[] } | null;
          return {
            ...legacy,
            queue: (legacy?.queue ?? []).filter(
              (m) =>
                (m.op === 'upsert' || m.op === 'delete') &&
                !!m.resource &&
                !!m.resourceId
            ),
          } as OfflineQueueState;
        }
        return persistedState as OfflineQueueState;
      },
    }
  )
);

/** Convenience: number of pending mutations. */
export function getQueueLength(): number {
  return useOfflineQueue.getState().queue.length;
}

/** Convenience: get queue without subscribing to React state. */
export function getQueue(): QueuedMutation[] {
  return useOfflineQueue.getState().queue;
}
