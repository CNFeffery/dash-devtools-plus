import {useEffect, useSyncExternalStore} from "react";

import {callbackPerformanceMonitor} from "./callbackPerformance";

export function useCallbackPerformanceSnapshot() {
  const snapshot = useSyncExternalStore(
    callbackPerformanceMonitor.subscribe,
    callbackPerformanceMonitor.getSnapshot,
    callbackPerformanceMonitor.getSnapshot,
  );

  return {
    connected: snapshot.connected,
    revision: snapshot.revision,
    getCallback: callbackPerformanceMonitor.getCallback,
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
  }, [callbackId]);

  return {
    connected: snapshot.connected,
    performance: callbackPerformanceMonitor.getCallback(callbackId),
  };
}
