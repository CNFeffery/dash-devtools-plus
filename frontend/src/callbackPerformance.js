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
  sampledCount: 0,
  supplementalCount: 0,
  supplementalStatuses: Object.freeze({}),
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
  const metric = (value) => profile.count ?
    (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null) : 0;
  return {
    count: finiteNumber(profile.count),
    total: metric(profile.total),
    compute: metric(profile.compute),
    networkTime: metric(profile.network?.time),
    requestSize: metric(profile.network?.upload),
    responseSize: metric(profile.network?.download),
    resources: {...(profile.resources || {})},
    status: {...(profile.status || {})},
  };
}

function numericDelta(current, previous) {
  return finiteNumber(current) - finiteNumber(previous);
}

function statusDelta(current = {}, previous = {}) {
  if (current.latest) return current.latest;
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

function createPerformance(previousPerformance, current, previous, historyLimit, completedAt, observed = true) {
  const countDelta = current.count - previous.count;
  const performance = previousPerformance || emptyPerformance("");
  const measuredDelta = Math.max(
    0,
    countDelta - numericDelta(countUnmeasured(current.status), countUnmeasured(previous.status)),
  );
  const measuredCount = Math.max(0, current.count - countUnmeasured(current.status));
  const totalDelta = numericDelta(current.total, previous.total);
  const status = statusDelta(current.status, previous.status);
  const measurementAvailable = countDelta === 1 && measuredDelta === 1 &&
    Number.isFinite(current.total) && Number.isFinite(previous.total) && totalDelta >= 0;
  const availableDelta = (currentValue, previousValue) =>
    measurementAvailable && Number.isFinite(currentValue) && Number.isFinite(previousValue) &&
      currentValue >= previousValue ? currentValue - previousValue : null;
  const record = observed && countDelta === 1
    ? {
        sequence: current.count + performance.supplementalCount,
        completedAt,
        status,
        measurementAvailable,
        totalMs: measurementAvailable ? totalDelta : null,
        serverMs: availableDelta(current.compute, previous.compute),
        networkMs: availableDelta(current.networkTime, previous.networkTime),
        requestSize: availableDelta(current.requestSize, previous.requestSize),
        responseSize: availableDelta(current.responseSize, previous.responseSize),
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
    executionCount: current.count + performance.supplementalCount,
    measuredCount,
    sampledCount: performance.sampledCount + (record?.measurementAvailable ? 1 : 0),
    supplementalCount: performance.supplementalCount,
    supplementalStatuses: performance.supplementalStatuses,
    averageMs: measuredCount && Number.isFinite(current.total) ? measuredTotal / measuredCount : null,
    latestMs,
    minMs,
    maxMs,
    totalMs: measuredTotal,
    serverMs: finiteNumber(current.compute),
    networkMs: Math.max(0, finiteNumber(current.networkTime)),
    requestSize: Math.max(0, finiteNumber(current.requestSize)),
    responseSize: Math.max(0, finiteNumber(current.responseSize)),
    lastExecutedAt: record ? completedAt : null,
    latestStatus: status || current.status.latest || null,
    statusCounts: {...Object.fromEntries(
      Object.entries(current.status).filter(([name]) => name !== "latest"),
    ), ...performance.supplementalStatuses},
    resourceTotals: {...current.resources},
    history,
    discardedCount: performance.discardedCount + discardedNow,
    unobservedCount: performance.unobservedCount + (!record ? Math.max(0, countDelta) : 0),
  };
}

function createStoreMonitor(store, {historyLimit, now}) {
  const callbacks = new Map();
  const profileSnapshots = new Map();
  const listeners = new Set();
  const emptyCallbacks = new Map();
  let seenResults = new WeakSet();
  let seenPromises = new WeakSet();
  let previousCallbacks = null;
  let previousProfile = null;
  let previousConfig = store.getState()?.config;
  let epoch = 0;
  let disposed = false;
  let publicSnapshot = {revision: 0, connected: false};

  const publish = () => {
    publicSnapshot = {
      revision: publicSnapshot.revision + 1,
      connected: !disposed && Boolean(store.getState()?.profile?.callbacks),
    };
    listeners.forEach((listener) => listener());
  };

  const reset = () => {
    callbacks.clear();
    profileSnapshots.clear();
    seenResults = new WeakSet();
    seenPromises = new WeakSet();
    epoch += 1;
  };

  // HTTP error Responses do not enter Dash's profile (unlike NO_RESPONSE and
  // clientside errors). Observe final execution results, never individual fetch
  // attempts: JWT retries and background polling must not inflate run counts.
  const recordFailure = (callback, result, observed) => {
    if (!result || typeof result !== "object" || seenResults.has(result)) return false;
    seenResults.add(result);
    const httpStatus = result.error?.status;
    const callbackId = callback?.output;
    if (!callbackId || callback.clientside_function || callback.websocket ||
        !Number.isInteger(httpStatus) || httpStatus < 400 || httpStatus > 599) return false;
    // Future renderers may profile these statuses themselves.
    if (store.getState()?.profile?.callbacks?.[callbackId]?.status?.[httpStatus]) return false;
    const performance = callbacks.get(callbackId) || emptyPerformance(callbackId);
    const status = "HTTP_ERROR";
    const completedAt = observed ? now() : null;
    const history = [...performance.history, {
      sequence: performance.executionCount + 1, completedAt, status, httpStatus,
      measurementAvailable: false, totalMs: null, serverMs: null, networkMs: null,
      requestSize: null, responseSize: null, customTimings: {},
    }];
    const discardedNow = Math.max(0, history.length - historyLimit);
    callbacks.set(callbackId, {
      ...performance,
      executionCount: performance.executionCount + 1,
      supplementalCount: performance.supplementalCount + 1,
      supplementalStatuses: {[status]: (performance.supplementalStatuses[status] || 0) + 1},
      statusCounts: {...performance.statusCounts, [status]: (performance.statusCounts[status] || 0) + 1},
      // A recovered terminal result has no ordering guarantee relative to the
      // aggregate profile; do not present it as the latest completion.
      latestMs: null, latestStatus: observed ? status : null, lastExecutedAt: completedAt,
      history: history.slice(discardedNow),
      discardedCount: performance.discardedCount + discardedNow,
    });
    return true;
  };

  const processStore = (scanAll = false, observed = true) => {
    if (disposed) return;
    const fallback = scanAll;
    const state = store.getState();
    const profile = state?.profile;
    let changed = false;
    if (state?.config !== previousConfig || !profile?.callbacks ||
        (profileSnapshots.size && previousCallbacks !== profile.callbacks && Object.keys(profile.callbacks).length === 0)) {
      changed = callbacks.size > 0;
      reset();
      previousConfig = state?.config;
      scanAll = true;
    }
    if (!profile?.callbacks) {
      previousCallbacks = null;
      if (changed || publicSnapshot.connected) publish();
      return;
    }
    // Dash mutates callback profiles in place. A replacement dictionary can
    // remove callbacks, so reconcile it even when `updated` lists only one ID.
    if (previousCallbacks && previousCallbacks !== profile.callbacks) {
      for (const id of profileSnapshots.keys()) {
        if (!(id in profile.callbacks)) {
          callbacks.delete(id);
          profileSnapshots.delete(id);
          changed = true;
        }
      }
      scanAll = true;
    }
    previousCallbacks = profile.callbacks;
    const candidateIds = !scanAll && profile === previousProfile ? [] :
      scanAll || !profile.updated?.length ? Object.keys(profile.callbacks) : profile.updated;
    previousProfile = profile;

    for (const callbackId of candidateIds) {
      const currentProfile = profile.callbacks[callbackId];
      if (!currentProfile) continue;
      const current = captureProfile(currentProfile);
      let previous = profileSnapshots.get(callbackId) || captureProfile();
      let previousPerformance = callbacks.get(callbackId) || emptyPerformance(callbackId);
      // Includes resets whose first new run happens to match the old count.
      if (current.count < previous.count ||
          (Number.isFinite(current.total) && Number.isFinite(previous.total) && current.total < previous.total) ||
          Object.entries(previous.status).some(([key, value]) =>
            key !== "latest" && finiteNumber(current.status[key]) < finiteNumber(value))) {
        previous = captureProfile();
        previousPerformance = emptyPerformance(callbackId);
        callbacks.set(callbackId, previousPerformance);
        profileSnapshots.set(callbackId, previous);
        changed = true;
      }
      if (current.count === previous.count) continue;
      callbacks.set(
        callbackId,
        createPerformance(
          previousPerformance,
          current,
          previous,
          historyLimit,
          observed && !fallback ? now() : null,
          observed,
        ),
      );
      profileSnapshots.set(callbackId, current);
      changed = true;
    }

    const executionState = state.callbacks || {};
    for (const cb of [...(executionState.executed || []), ...(executionState.stored || [])]) {
      if (recordFailure(cb.callback, cb.executionResult, observed && !fallback)) changed = true;
    }
    for (const cb of [...(executionState.executing || []), ...(executionState.watched || [])]) {
      const promise = cb.executionPromise;
      if (!promise || typeof promise.then !== "function" || seenPromises.has(promise)) continue;
      seenPromises.add(promise);
      const currentEpoch = epoch;
      Promise.resolve(promise).then((result) => {
        if (disposed || currentEpoch !== epoch) return;
        if (recordFailure(cb.callback, result, true)) publish();
      }).catch(() => {}); // Renderer owns rejection reporting.
    }
    if (changed || !publicSnapshot.connected) publish();
  };

  const unsubscribe = store.subscribe(() => processStore());
  processStore(true, false);
  return {
    refresh: () => processStore(true),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => publicSnapshot,
    getCallback(callbackId) {
      if (callbacks.has(callbackId)) return callbacks.get(callbackId);
      if (!emptyCallbacks.has(callbackId)) emptyCallbacks.set(callbackId, emptyPerformance(callbackId));
      return emptyCallbacks.get(callbackId);
    },
    dispose() {
      disposed = true;
      unsubscribe();
      reset();
      publish();
      listeners.clear();
      emptyCallbacks.clear();
    },
  };
}

export function createCallbackPerformanceMonitor({
  historyLimit = DEFAULT_CALLBACK_HISTORY_LIMIT,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(historyLimit) || historyLimit < 1) throw new RangeError("historyLimit must be a positive integer");
  const sessions = new Map();
  const targets = new Map();
  const listeners = new Set();
  let active = null;
  let snapshot = {revision: 0, connected: false};
  const publish = () => {
    snapshot = {revision: snapshot.revision + 1, connected: active?.getSnapshot().connected || false};
    listeners.forEach((listener) => listener());
  };
  const attachStore = (store) => {
    if (!store || typeof store.getState !== "function" || typeof store.subscribe !== "function") return null;
    if (sessions.has(store)) return sessions.get(store);
    const session = createStoreMonitor(store, {historyLimit, now});
    sessions.set(store, session);
    active = session;
    session.subscribe(publish);
    publish();
    return session;
  };
  const detachRegistry = (stores) => {
    const registry = stores[DASH_STORES_REGISTRY];
    if (!registry) return;
    registry.attachers.delete(attachStore);
    if (!registry.attachers.size) {
      if (stores.push === registry.push) stores.push = registry.originalPush;
      delete stores[DASH_STORES_REGISTRY];
    }
  };
  const install = (target = globalThis) => {
    if (!target || targets.has(target)) return;
    const stores = target.dash_stores = target.dash_stores || [];
    let registry = stores[DASH_STORES_REGISTRY];

    if (!registry) {
      const attachers = new Set();
      const originalPush = stores.push;
      Object.defineProperty(stores, DASH_STORES_REGISTRY, {
        configurable: true,
        enumerable: false,
        value: {attachers, originalPush},
      });
      stores.push = function pushDashStores(...items) {
        const result = originalPush.apply(this, items);
        items.forEach((item) => attachers.forEach((attacher) => attacher(item)));
        return result;
      };
      registry = stores[DASH_STORES_REGISTRY];
      registry.push = stores.push;
    }

    registry.attachers.add(attachStore);
    targets.set(target, stores);
    stores.forEach(attachStore);
  };

  return {
    install,
    forStore: attachStore,
    refresh() {
      for (const [target, stores] of targets) {
        if (target.dash_stores !== stores) {
          detachRegistry(stores);
          targets.delete(target);
          install(target);
        }
      }
      const registered = new Set([...targets.values()].flatMap((stores) => [...stores]));
      for (const [store, session] of sessions) {
        if (targets.size && !registered.has(store)) {
          sessions.delete(store);
          session.dispose();
          if (active === session) active = [...sessions.values()].at(-1) || null;
        } else session.refresh();
      }
      publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    getCallback(callbackId) {
      return active?.getCallback(callbackId) || EMPTY_PERFORMANCE;
    },
    dispose() {
      for (const stores of targets.values()) detachRegistry(stores);
      targets.clear();
      sessions.forEach((session) => session.dispose());
      sessions.clear();
      active = null;
      publish();
      listeners.clear();
    },
  };
}

export const callbackPerformanceMonitor = createCallbackPerformanceMonitor();

export function installCallbackPerformanceMonitor(target) {
  callbackPerformanceMonitor.install(target);
}
