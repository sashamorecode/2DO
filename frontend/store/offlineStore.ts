import { create } from 'zustand';
import { getIsOnline, onReconnect } from '../services/networkStatus';
import { getQueueLength } from '../services/offlineQueue';
import { processSyncQueue } from '../services/sync';

/**
 * Lightweight in-memory store for offline-related UI state.
 *
 * Components read `isOnline` and `pendingChanges` to render sync
 * indicators and gate social features. The store is kept in sync with
 * the network monitor and the offline mutation queue.
 */

interface OfflineState {
  isOnline: boolean;
  pendingChanges: number;
  lastSyncAt: string | null;

  /** Call after the sync engine completes a successful pass. */
  markSynced: () => void;
  /** Refresh pendingChanges from the queue. */
  refreshPending: () => void;
  /** Force-set online status (called by the network monitor). */
  setOnline: (value: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: getIsOnline(),
  pendingChanges: getQueueLength(),
  lastSyncAt: null,

  markSynced: () =>
    set({ pendingChanges: getQueueLength(), lastSyncAt: new Date().toISOString() }),

  refreshPending: () => set({ pendingChanges: getQueueLength() }),

  setOnline: (value) => {
    set({ isOnline: value });
    // When coming back online, trigger sync.
    if (value) {
      processSyncQueue().then(() => {
        set({ pendingChanges: getQueueLength(), lastSyncAt: new Date().toISOString() });
      });
    }
  },
}));

// Keep the store in sync with the network monitor.
// We do this at module level so it's always active once the store is imported.
onReconnect(() => {
  useOfflineStore.getState().setOnline(true);
});

// Also poll periodically in case NetInfo doesn't fire reliably.
// (Some Android emulators miss transitions.)
// We also set up a NetInfo listener that can detect going offline:
import NetInfo from '@react-native-community/netinfo';
NetInfo.addEventListener((state) => {
  const connected = state.isConnected ?? true;
  const current = useOfflineStore.getState().isOnline;
  if (connected !== current) {
    useOfflineStore.getState().setOnline(connected);
  }
});
