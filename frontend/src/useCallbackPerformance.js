import {useCallback, useEffect, useSyncExternalStore} from "react";

import {callbackPerformanceMonitor} from "./callbackPerformance";

const noStore = () => null;

function usePerformanceMonitor() {
  const context = window.dash_component_api?.useDashContext?.() || {};
  const store = (context.useStore || noStore)();
  return store ? callbackPerformanceMonitor.forStore(store) : callbackPerformanceMonitor;
}

export function useCallbackPerformanceSnapshot(enabled = true) {
  const monitor = usePerformanceMonitor();
  // Collect every execution synchronously; only throttle React notifications.
  const subscribe = useCallback((listener) => {
    if (!enabled) return () => {};
    let timer = null;
    const unsubscribe = monitor.subscribe(() => {
      if (timer !== null) return;
      timer = window.setTimeout(() => { timer = null; listener(); }, 100);
    });
    return () => { unsubscribe(); window.clearTimeout(timer); };
  }, [monitor, enabled]);
  const snapshot = useSyncExternalStore(
    subscribe,
    monitor.getSnapshot,
    monitor.getSnapshot,
  );

  return {
    connected: snapshot.connected,
    revision: snapshot.revision,
    getCallback: monitor.getCallback,
    monitor,
  };
}

export function useCallbackPerformance(callbackId) {
  const snapshot = useCallbackPerformanceSnapshot();

  useEffect(() => {
    if (!callbackId) return undefined;
    callbackPerformanceMonitor.refresh();
    const timer = window.setInterval(
      callbackPerformanceMonitor.refresh,
      500,
    );
    return () => window.clearInterval(timer);
  }, [callbackId, snapshot.monitor]);

  return {
    connected: snapshot.connected,
    performance: snapshot.getCallback(callbackId),
  };
}
