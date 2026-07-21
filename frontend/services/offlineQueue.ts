import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline mutation queue.
 *
 * When the device is offline, todo and tag mutations are persisted here
 * so they survive app restarts. The sync engine replays them in FIFO
 * order once connectivity returns.
 *
 * SINGLE-DEVICE ASSUMPTION: this queue assumes each user only uses one
 * device. If the same user logs in on a second device, mutations queued
 * on device A won't be visible to device B, and server state may diverge.
 * Multi-device support would require CRDTs or vector clocks.
 */

export type MutationOp = 'create' | 'update' | 'delete' | 'complete' | 'reopen';
export type MutationResource = 'todo' | 'tag';

export interface QueuedMutation {
  /** Client-generated UUID for idempotency tracking. */
  id: string;
  /** The operation to perform. */
  op: MutationOp;
  /** Which resource type this mutation targets. */
  resource: MutationResource;
  /**
   * For 'create': the full CreateTodoInput or CreateTagInput.
   * For 'update': the full CreateTodoInput / CreateTagInput.
   * For 'complete' / 'reopen': null (the resourceId is sufficient).
   * For 'delete': null.
   */
  payload: any;
  /** The resource's ID (for update / delete / complete / reopen). */
  resourceId?: string;
  /** ISO-8601 timestamp set by the client when the mutation was queued. */
  clientUpdatedAt: string;
  /** ISO-8601 timestamp when this entry was created. */
  createdAt: string;
}

interface OfflineQueueState {
  queue: QueuedMutation[];
  enqueue: (mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) => void;
  dequeue: (id: string) => void;
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
        set({ queue: [...get().queue, entry] });
      },

      dequeue: (id) => {
        set({ queue: get().queue.filter((m) => m.id !== id) });
      },

      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
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
