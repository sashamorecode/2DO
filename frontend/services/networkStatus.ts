import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Singleton network-status monitor.
 *
 * Tracks whether the device currently has internet access. Components
 * read `getIsOnline()` synchronously; the sync engine subscribes via
 * `onReconnect()` to flush the offline queue when connectivity returns.
 */

let isOnline = true;

// Reconnect callbacks registered by the sync engine.
const reconnectCallbacks: Array<() => void> = [];

function handleStateChange(state: NetInfoState): void {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? state.isInternetReachable ?? true;

  if (wasOffline && isOnline) {
    for (const cb of reconnectCallbacks) {
      try {
        cb();
      } catch {
        // A callback should never take down the monitor.
      }
    }
  }
}

// Subscribe once at module load.
const unsubscribe = NetInfo.addEventListener(handleStateChange);

/**
 * Synchronous check — safe to call from mutation paths outside React.
 */
export function getIsOnline(): boolean {
  return isOnline;
}

/**
 * Register a callback that fires once when the device transitions from
 * offline → online. Returns an unsubscribe function.
 */
export function onReconnect(cb: () => void): () => void {
  reconnectCallbacks.push(cb);
  return () => {
    const idx = reconnectCallbacks.indexOf(cb);
    if (idx !== -1) reconnectCallbacks.splice(idx, 1);
  };
}

/**
 * Tear down the NetInfo listener. Exposed for tests; not needed in
 * production since the listener lives for the app lifetime.
 */
export function _destroyNetworkMonitor(): void {
  unsubscribe();
  reconnectCallbacks.length = 0;
}
