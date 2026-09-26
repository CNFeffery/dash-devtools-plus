import assert from "node:assert/strict";
import test from "node:test";
import {createCallbackPerformanceMonitor} from "../src/callbackPerformance.js";
import {PERFORMANCE_DURATION_COLUMNS, omittedHistoryCount, performancePresentation, timingPhases, transferValue} from "../src/callbackPerformanceView.js";

// Like Dash, retain the callback dictionary and mutate its cumulative values.
function runtimeStore() {
  let state = {config: {}, profile: {callbacks: {}, updated: []}, callbacks: {}};
  const listeners = new Set();
  const notify = () => [...listeners].forEach((fn) => fn());
  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    listenerCount: () => listeners.size,
    notify,
    run(duration, status = "SUCCESS", id = "out.children", notification = true) {
      const cb = state.profile.callbacks[id] ||= {
        count: 0, total: 0, compute: 0, network: {time: 0, upload: 0, download: 0}, status: {}, resources: {},
      };
      cb.count += 1;
      cb.status[status] = (cb.status[status] || 0) + 1;
      cb.status.latest = status;
      if (duration !== null) {
        cb.total += duration;
        cb.compute += duration * 0.6;
        cb.network.time += duration * 0.4;
        cb.resources.database = (cb.resources.database || 0) + duration * 0.2;
      }
      state = {...state, profile: {...state.profile, updated: [id]}};
      if (notification) notify();
    },
    executions(callbacks) { state = {...state, callbacks}; notify(); },
    replaceProfile(profile) { state = {...state, profile}; notify(); },
    reset(notification = true) {
      state = {...state, config: {}, profile: {callbacks: {}, updated: []}, callbacks: {}};
      if (notification) notify();
    },
  };
}

const errorResult = (status = 500) => ({error: {status}, payload: null});
const execution = (result, callback = {output: "out.children"}) => ({callback, executionResult: result});
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("native in-place updates retain correct deltas, extrema and custom timings", () => {
  const store = runtimeStore();
  const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  [100, 20, 30].forEach((value) => store.run(value));
  const p = monitor.getCallback("out.children");
  assert.equal(p.averageMs, 50);
  assert.equal(p.minMs, 20); assert.equal(p.maxMs, 100);
  assert.equal(p.sampledCount, 3);
  assert.deepEqual(p.history.map((r) => r.customTimings.database), [20, 4, 6]);
});

test("reset clears histories, extrema and old counts even when next count matches", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor();
  monitor.install({dash_stores: [store]}); store.run(100); store.reset();
  assert.equal(monitor.getCallback("out.children").executionCount, 0);
  store.run(20); store.run(30);
  const p = monitor.getCallback("out.children");
  assert.equal(p.latestMs, 30); assert.equal(p.minMs, 20); assert.equal(p.maxMs, 30);
  assert.equal(p.averageMs, 25);
  assert.deepEqual(p.history.map((r) => r.sequence), [1, 2]);
});

test("unannounced counter rollback starts a new callback baseline", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(100);
  store.replaceProfile({callbacks: {"out.children": {count: 1, total: 20, compute: 10, status: {SUCCESS: 1, latest: "SUCCESS"}}}, updated: ["out.children"]});
  assert.equal(monitor.getCallback("out.children").latestMs, 20);
  assert.equal(monitor.getCallback("out.children").maxMs, 20);
});

test("late attachment to one run never invents its timestamp or sampled extrema", () => {
  const store = runtimeStore(); store.run(25);
  const monitor = createCallbackPerformanceMonitor({now: () => 12345}); monitor.install({dash_stores: [store]});
  const p = monitor.getCallback("out.children");
  assert.equal(p.executionCount, 1); assert.equal(p.averageMs, 25);
  assert.equal(p.lastExecutedAt, null); assert.equal(p.latestMs, null);
  assert.equal(p.minMs, null); assert.equal(p.sampledCount, 0); assert.equal(p.unobservedCount, 1);
});

test("batched recovery uses the latest status and does not retain a stale completion time", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(10); store.run(20, "NO_UPDATE", "out.children", false);
  store.run(30, "NO_UPDATE", "out.children", false); store.run(40, "SUCCESS", "out.children", false);
  monitor.refresh(); const p = monitor.getCallback("out.children");
  assert.equal(p.latestStatus, "SUCCESS"); assert.equal(p.lastExecutedAt, null);
  assert.equal(p.averageMs, 25); assert.equal(p.sampledCount, 1); assert.equal(p.unobservedCount, 3);
});

test("HTTP failures count once across executed, stored and promise completion without entering timing averages", async () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor({now: () => 42}); monitor.install({dash_stores: [store]});
  store.run(80);
  let resolve; const promise = new Promise((done) => { resolve = done; });
  const result = errorResult(); const cb = execution(result);
  store.executions({watched: [{callback: cb.callback, executionPromise: promise}]});
  resolve(result); await flush();
  store.executions({executed: [cb], stored: [{...cb}]}); store.notify();
  let p = monitor.getCallback("out.children");
  assert.equal(p.executionCount, 2); assert.equal(p.statusCounts.HTTP_ERROR, 1);
  assert.equal(p.averageMs, 80); assert.equal(p.minMs, 80); assert.equal(p.latestMs, null);
  assert.equal(p.lastExecutedAt, 42); assert.equal(p.history.at(-1).httpStatus, 500);
  store.run(20);
  p = monitor.getCallback("out.children");
  assert.equal(p.executionCount, 3); assert.equal(p.averageMs, 50);
  assert.equal(p.statusCounts.HTTP_ERROR, 1); assert.equal(p.latestStatus, "SUCCESS");
  assert.deepEqual(p.history.map((r) => r.sequence), [1, 2, 3]);
});

test("failure-only callback survives unrelated Redux notifications", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.executions({executed: [execution(errorResult(403))]}); store.executions({}); store.notify();
  assert.equal(monitor.getCallback("out.children").executionCount, 1);
  assert.equal(monitor.getCallback("out.children").measuredCount, 0);
});

test("transport and client errors already in profile are not supplemented", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(null, "NO_RESPONSE"); store.executions({executed: [execution({error: new Error("offline")})]});
  store.run(10, "CLIENTSIDE_ERROR");
  store.executions({executed: [execution(errorResult(), {output: "out.children", clientside_function: {}})]});
  assert.equal(monitor.getCallback("out.children").executionCount, 2);
  assert.equal(monitor.getCallback("out.children").supplementalCount, 0);
});

test("final successful retry adds no HTTP failure; stale promises after reset are ignored", async () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.executions({watched: [{callback: {output: "out.children"}, executionPromise: Promise.resolve({data: {}})}]});
  await flush(); assert.equal(monitor.getCallback("out.children").executionCount, 0);
  let resolve; const promise = new Promise((done) => { resolve = done; });
  store.executions({watched: [{callback: {output: "out.children"}, executionPromise: promise}]});
  store.reset(); resolve(errorResult()); await flush();
  assert.equal(monitor.getCallback("out.children").executionCount, 0);
});

test("stores remain isolated and removed stores are unsubscribed", () => {
  const first = runtimeStore(); const second = runtimeStore(); const target = {dash_stores: [first]};
  const monitor = createCallbackPerformanceMonitor(); monitor.install(target);
  first.run(10); target.dash_stores.push(second); second.run(30);
  assert.equal(monitor.forStore(first).getCallback("out.children").latestMs, 10);
  assert.equal(monitor.forStore(second).getCallback("out.children").latestMs, 30);
  target.dash_stores.splice(0, 1); monitor.refresh();
  assert.equal(first.listenerCount(), 0); assert.equal(second.listenerCount(), 1);
  monitor.dispose(); assert.equal(second.listenerCount(), 0);
  assert.equal(target.dash_stores.push, Array.prototype.push);
});

test("disconnected stores report unavailable and reconnect on a valid profile", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(10); store.replaceProfile(null);
  assert.equal(monitor.getSnapshot().connected, false);
  assert.equal(monitor.getCallback("out.children").executionCount, 0);
  store.reset(); store.run(20);
  assert.equal(monitor.getSnapshot().connected, true); assert.equal(monitor.getCallback("out.children").latestMs, 20);
});

test("invalid timings stay unavailable instead of producing zero samples", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.replaceProfile({callbacks: {"out.children": {count: 1, total: NaN, status: {SUCCESS: 1, latest: "SUCCESS"}}}, updated: ["out.children"]});
  const p = monitor.getCallback("out.children");
  assert.equal(p.averageMs, null); assert.equal(p.latestMs, null); assert.equal(p.minMs, null);
  assert.equal(p.history[0].measurementAvailable, false);
});

test("history omissions include cached but invisible rows as well as discarded runs", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor({historyLimit: 25}); monitor.install({dash_stores: [store]});
  for (let i = 0; i < 30; i++) store.run(10);
  const p = monitor.getCallback("out.children");
  assert.equal(omittedHistoryCount(p, 20), 10);
  assert.equal(p.sampledCount, 30); assert.equal(p.history.length, 25);
});

test("type-aware presentation never labels client or background time as server/network", () => {
  const record = {measurementAvailable: true, totalMs: 100, serverMs: 100, networkMs: 0};
  const client = performancePresentation({mode: "client"});
  assert.deepEqual(timingPhases(record, client), [{phase: "client", duration: 100}]);
  assert.equal(transferValue(0, client), 0);
  for (const row of [{background: true}, {websocket: true}]) {
    const view = performancePresentation(row);
    assert.deepEqual(timingPhases(record, view), [{phase: "total", duration: 100}]);
    assert.equal(transferValue(0, view), null);
  }
  const http = performancePresentation({mode: "server"});
  assert.deepEqual(timingPhases({...record, serverMs: 0}, http), [{phase: "total", duration: 100}]);
  assert.equal(transferValue(0, http), null);
  assert.deepEqual(timingPhases({...record, measurementAvailable: false}, http), []);
  assert.deepEqual(PERFORMANCE_DURATION_COLUMNS.map(([key]) => key), ["averageMs", "latestMs", "minMs", "maxMs"]);
});

test("reset to zero publishes the cleared state without waiting for another run", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(10);
  const revision = monitor.getSnapshot().revision;
  store.replaceProfile({callbacks: {"out.children": {count: 0, total: 0, status: {}}}, updated: ["out.children"]});
  assert.equal(monitor.getCallback("out.children").executionCount, 0);
  assert.ok(monitor.getSnapshot().revision > revision);
});

test("replacing the store registry detaches old stores and restores its push method", () => {
  const store = runtimeStore(); const target = {dash_stores: [store]}; const original = target.dash_stores;
  const monitor = createCallbackPerformanceMonitor(); monitor.install(target); store.run(50);
  const next = runtimeStore(); target.dash_stores = [next]; monitor.refresh(); next.run(10);
  assert.equal(original.push, Array.prototype.push); assert.equal(store.listenerCount(), 0);
  assert.equal(monitor.getCallback("out.children").latestMs, 10);
  monitor.dispose();
});

test("multiple monitor installations share and safely release the registry wrapper", () => {
  const target = {dash_stores: []}; const first = createCallbackPerformanceMonitor(); const second = createCallbackPerformanceMonitor();
  first.install(target); second.install(target); first.install(target);
  const store = runtimeStore(); target.dash_stores.push(store); store.run(10);
  assert.equal(store.listenerCount(), 2); first.dispose();
  assert.equal(store.listenerCount(), 1); store.run(20);
  assert.equal(second.getCallback("out.children").executionCount, 2);
  second.dispose(); assert.equal(store.listenerCount(), 0);
  assert.equal(target.dash_stores.push, Array.prototype.push);
});

test("distinct concurrent HTTP failures are all recorded, including no-output IDs", async () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor({historyLimit: 2}); monitor.install({dash_stores: [store]});
  const id = "opaque-no-output-hash";
  const results = [errorResult(400), errorResult(500), errorResult(503)];
  store.executions({watched: results.map((result) => ({callback: {output: id, no_output: true}, executionPromise: Promise.resolve(result)}))});
  await flush();
  const p = monitor.getCallback(id);
  assert.equal(p.executionCount, 3); assert.equal(p.statusCounts.HTTP_ERROR, 3);
  assert.equal(p.averageMs, null); assert.equal(p.discardedCount, 1);
  assert.deepEqual(p.history.map((r) => r.httpStatus), [500, 503]);
});

test("a future Renderer that already profiles HTTP statuses is not counted twice", () => {
  const store = runtimeStore(); const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  store.run(10, "500"); store.executions({executed: [execution(errorResult())]});
  assert.equal(monitor.getCallback("out.children").executionCount, 1);
  assert.equal(monitor.getCallback("out.children").supplementalCount, 0);
});

test("pre-attachment failures preserve their status without inventing latest ordering", () => {
  const store = runtimeStore(); store.run(20);
  store.executions({stored: [execution(errorResult())]});
  const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
  const p = monitor.getCallback("out.children");
  assert.equal(p.executionCount, 2); assert.equal(p.latestStatus, null);
  assert.equal(p.lastExecutedAt, null); assert.equal(p.history[0].completedAt, null);
  assert.equal(p.history[0].status, "HTTP_ERROR");
});
