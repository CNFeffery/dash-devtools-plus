const DASH_STORES_REGISTRY = Symbol.for("dash-devtools-plus.callback-performance");

export const DEFAULT_CALLBACK_HISTORY_LIMIT = 200;

export function comparePerformanceValues(left, right) {
  const leftAvailable = Number.isFinite(left);
  const rightAvailable = Number.isFinite(right);
  if (!leftAvailable && !rightAvailable) return 0;
  if (!leftAvailable) return -1;
  if (!rightAvailable) return 1;
  return left - right;
}

export function describeExecutionRecency(completedAt, currentTime = Date.now()) {
  if (!Number.isFinite(completedAt) || !Number.isFinite(currentTime)) return null;

  const elapsedSeconds = Math.max(0, Math.floor((currentTime - completedAt) / 1000));
  if (elapsedSeconds < 60) {
    return {bucket: "seconds", seconds: elapsedSeconds};
  }
  if (elapsedSeconds < 10 * 60) {
    return {
      bucket: "minutes",
      minutes: Math.floor(elapsedSeconds / 60),
      seconds: elapsedSeconds % 60,
    };
  }
  return {bucket: "overTenMinutes"};
}

const EMPTY_PERFORMANCE = Object.freeze({
  callbackId: "",
  executionCount: 0,
  measuredCount: 0,
  averageMs: null,
  latestMs: null,
  minMs: null,
  maxMs: null,
  totalMs: 0,
  serverMs: 0,
  networkMs: 0,
  requestSize: 0,
  responseSize: 0,
  lastExecutedAt: null,
  latestStatus: null,
  statusCounts: Object.freeze({}),
  resourceTotals: Object.freeze({}),
  history: Object.freeze([]),
  discardedCount: 0,
  unobservedCount: 0,
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function captureProfile(profile = {}) {
  return {
    count: finiteNumber(profile.count),
    total: finiteNumber(profile.total),
    compute: finiteNumber(profile.compute),
    networkTime: finiteNumber(profile.network?.time),
    requestSize: finiteNumber(profile.network?.upload),
    responseSize: finiteNumber(profile.network?.download),
    resources: {...(profile.resources || {})},
    status: {...(profile.status || {})},
  };
}

function numericDelta(current, previous) {
  return finiteNumber(current) - finiteNumber(previous);
}

function statusDelta(current = {}, previous = {}) {
  let selected = null;
  let selectedDelta = 0;

  for (const [status, value] of Object.entries(current)) {
    if (status === "latest") continue;
    const delta = numericDelta(value, previous[status]);
    if (delta > selectedDelta) {
      selected = status;
      selectedDelta = delta;
    }
  }

  return selected || current.latest || null;
}

function resourceDelta(current = {}, previous = {}) {
  const result = {};
  for (const [name, value] of Object.entries(current)) {
    const delta = numericDelta(value, previous[name]);
    if (delta >= 0) result[name] = delta;
  }
  return result;
}

function countUnmeasured(status = {}) {
  return finiteNumber(status.NO_RESPONSE);
}

function emptyPerformance(callbackId) {
  return {...EMPTY_PERFORMANCE, callbackId};
}

function createPerformance(previousPerformance, current, previous, historyLimit, completedAt) {
  const countDelta = current.count - previous.count;
  const performance = previousPerformance || emptyPerformance("");
  const measuredDelta = Math.max(
    0,
    countDelta - numericDelta(countUnmeasured(current.status), countUnmeasured(previous.status)),
  );
  const measuredCount = Math.max(0, current.count - countUnmeasured(current.status));
  const totalDelta = numericDelta(current.total, previous.total);
  const serverDelta = numericDelta(current.compute, previous.compute);
  const networkDelta = numericDelta(current.networkTime, previous.networkTime);
  const requestDelta = numericDelta(current.requestSize, previous.requestSize);
  const responseDelta = numericDelta(current.responseSize, previous.responseSize);
  const status = statusDelta(current.status, previous.status);
  const measurementAvailable = countDelta === 1 && measuredDelta === 1;
  const record = measurementAvailable || countDelta === 1
    ? {
        sequence: current.count,
        completedAt,
        status,
        measurementAvailable,
        totalMs: measurementAvailable ? totalDelta : null,
        serverMs: measurementAvailable ? serverDelta : null,
        networkMs: measurementAvailable ? Math.max(0, networkDelta) : null,
        requestSize: measurementAvailable ? Math.max(0, requestDelta) : null,
        responseSize: measurementAvailable ? Math.max(0, responseDelta) : null,
        customTimings: measurementAvailable
          ? resourceDelta(current.resources, previous.resources)
          : {},
      }
    : null;
  const history = record ? [...performance.history, record] : [...performance.history];
  const discardedNow = Math.max(0, history.length - historyLimit);
  if (discardedNow) history.splice(0, discardedNow);

  const measuredTotal = finiteNumber(current.total);
  const latestMs = record?.measurementAvailable ? record.totalMs : null;
  const minMs = record?.measurementAvailable
    ? performance.minMs === null
      ? record.totalMs
      : Math.min(performance.minMs, record.totalMs)
    : performance.minMs;
  const maxMs = record?.measurementAvailable
    ? performance.maxMs === null
      ? record.totalMs
      : Math.max(performance.maxMs, record.totalMs)
    : performance.maxMs;

  return {
    callbackId: performance.callbackId,
    executionCount: current.count,
    measuredCount,
    averageMs: measuredCount ? measuredTotal / measuredCount : null,
    latestMs,
    minMs,
    maxMs,
    totalMs: measuredTotal,
    serverMs: finiteNumber(current.compute),
    networkMs: Math.max(0, finiteNumber(current.networkTime)),
    requestSize: Math.max(0, finiteNumber(current.requestSize)),
    responseSize: Math.max(0, finiteNumber(current.responseSize)),
    lastExecutedAt: record ? completedAt : performance.lastExecutedAt,
    latestStatus: status || current.status.latest || null,
    statusCounts: Object.fromEntries(
      Object.entries(current.status).filter(([name]) => name !== "latest"),
    ),
    resourceTotals: {...current.resources},
    history,
    discardedCount: performance.discardedCount + discardedNow,
    unobservedCount: performance.unobservedCount + (countDelta > 1 ? countDelta : 0),
  };
}

export function createCallbackPerformanceMonitor({
  historyLimit = DEFAULT_CALLBACK_HISTORY_LIMIT,
  now = () => Date.now(),
} = {}) {
  const callbacks = new Map();
  const profileSnapshots = new Map();
  const listeners = new Set();
  const attachedStores = new WeakSet();
  const installedTargets = new WeakSet();
  let activeStore = null;
  let publicSnapshot = {revision: 0, connected: false};

  const publish = () => {
    publicSnapshot = {
      revision: publicSnapshot.revision + 1,
      connected: Boolean(activeStore),
    };
    listeners.forEach((listener) => listener());
  };

  const processStore = (store, scanAll = false) => {
    if (store !== activeStore) return;
    const profile = store.getState()?.profile;
    if (!profile?.callbacks) return;

    const candidateIds = scanAll || !profile.updated?.length
      ? Object.keys(profile.callbacks)
      : profile.updated;
    let changed = false;

    for (const callbackId of candidateIds) {
      const currentProfile = profile.callbacks[callbackId];
      if (!currentProfile) continue;
      const current = captureProfile(currentProfile);
      const previous = profileSnapshots.get(callbackId) || captureProfile();
      if (current.count === previous.count) continue;

      const previousPerformance = callbacks.get(callbackId) || emptyPerformance(callbackId);
      callbacks.set(
        callbackId,
        createPerformance(
          previousPerformance,
          current,
          previous,
          historyLimit,
          now(),
        ),
      );
      profileSnapshots.set(callbackId, current);
      changed = true;
    }

    if (changed) publish();
  };

  const attachStore = (store) => {
    if (!store || attachedStores.has(store)) return;
    if (typeof store.getState !== "function" || typeof store.subscribe !== "function") return;
    attachedStores.add(store);
    if (!activeStore) {
      activeStore = store;
      publicSnapshot = {...publicSnapshot, connected: true};
    }
    store.subscribe(() => processStore(store));
    processStore(store, true);
    publish();
  };

  const install = (target = globalThis) => {
    if (!target || installedTargets.has(target)) return;
    installedTargets.add(target);
    const stores = target.dash_stores = target.dash_stores || [];
    let registry = stores[DASH_STORES_REGISTRY];

    if (!registry) {
      const attachers = new Set();
      const originalPush = stores.push;
      Object.defineProperty(stores, DASH_STORES_REGISTRY, {
        configurable: false,
        enumerable: false,
        value: {attachers},
      });
      stores.push = function pushDashStores(...items) {
        const result = originalPush.apply(this, items);
        items.forEach((item) => attachers.forEach((attacher) => attacher(item)));
        return result;
      };
      registry = stores[DASH_STORES_REGISTRY];
    }

    registry.attachers.add(attachStore);
    stores.forEach(attachStore);
  };

  return {
    install,
    refresh() {
      if (activeStore) processStore(activeStore, true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return publicSnapshot;
    },
    getCallback(callbackId) {
      return callbacks.get(callbackId) || {...EMPTY_PERFORMANCE, callbackId: callbackId || ""};
    },
  };
}

export const callbackPerformanceMonitor = createCallbackPerformanceMonitor();

export function installCallbackPerformanceMonitor(target) {
  callbackPerformanceMonitor.install(target);
}
