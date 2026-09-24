import assert from "node:assert/strict";
import test from "node:test";

import {
  comparePerformanceValues,
  createCallbackPerformanceMonitor,
  describeExecutionRecency,
} from "../src/callbackPerformance.js";

function createStore(initialState = {profile: {callbacks: {}, updated: []}}) {
  let state = initialState;
  const listeners = new Set();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(profile) {
      state = {profile};
      listeners.forEach((listener) => listener());
    },
    replace(profile) {
      state = {profile};
    },
  };
}

function callbackProfile({
  count,
  total,
  server,
  network,
  upload,
  download,
  latest = "SUCCESS",
  statuses = {SUCCESS: count},
  resources = {},
}) {
  return {
    count,
    total,
    compute: server,
    network: {time: network, upload, download},
    resources,
    status: {latest, ...statuses},
  };
}

function publish(store, callbackId, profile) {
  store.update({callbacks: {[callbackId]: profile}, updated: [callbackId]});
}

test("performance values sort numerically with unavailable metrics below measured values", () => {
  assert.ok(comparePerformanceValues(120, 40) > 0);
  assert.ok(comparePerformanceValues(40, 120) < 0);
  assert.ok(comparePerformanceValues(null, 40) < 0);
  assert.equal(comparePerformanceValues(null, undefined), 0);
});

test("execution recency follows the second, minute, and over-ten-minute display buckets", () => {
  const now = 1_000_000;
  assert.deepEqual(describeExecutionRecency(now - 59_000, now), {
    bucket: "seconds",
    seconds: 59,
  });
  assert.deepEqual(describeExecutionRecency(now - 60_000, now), {
    bucket: "minutes",
    minutes: 1,
    seconds: 0,
  });
  assert.deepEqual(describeExecutionRecency(now - 599_000, now), {
    bucket: "minutes",
    minutes: 9,
    seconds: 59,
  });
  assert.deepEqual(describeExecutionRecency(now - 600_000, now), {
    bucket: "overTenMinutes",
  });
  assert.equal(describeExecutionRecency(null, now), null);
  assert.deepEqual(describeExecutionRecency(now + 3_000, now), {
    bucket: "seconds",
    seconds: 0,
  });
});

test("monitor derives per-run timing and transfer history from Dash's cumulative profile", () => {
  const completed = [1_000, 2_000, 3_000];
  const monitor = createCallbackPerformanceMonitor({now: () => completed.shift()});
  const target = {};
  const store = createStore();
  monitor.install(target);
  target.dash_stores.push(store);

  publish(store, "result.children", callbackProfile({
    count: 1,
    total: 120,
    server: 80,
    network: 40,
    upload: 100,
    download: 200,
    resources: {database: 30},
  }));
  publish(store, "result.children", callbackProfile({
    count: 2,
    total: 170,
    server: 105,
    network: 65,
    upload: 140,
    download: 260,
    latest: "NO_UPDATE",
    statuses: {SUCCESS: 1, NO_UPDATE: 1},
    resources: {database: 42},
  }));

  const performance = monitor.getCallback("result.children");
  assert.equal(monitor.getSnapshot().connected, true);
  assert.equal(performance.executionCount, 2);
  assert.equal(performance.measuredCount, 2);
  assert.equal(performance.averageMs, 85);
  assert.equal(performance.latestMs, 50);
  assert.equal(performance.minMs, 50);
  assert.equal(performance.maxMs, 120);
  assert.equal(performance.requestSize, 140);
  assert.equal(performance.responseSize, 260);
  assert.equal(performance.lastExecutedAt, 2_000);
  assert.equal(performance.latestStatus, "NO_UPDATE");
  assert.deepEqual(performance.statusCounts, {SUCCESS: 1, NO_UPDATE: 1});
  assert.deepEqual(performance.history, [
    {
      sequence: 1,
      completedAt: 1_000,
      status: "SUCCESS",
      measurementAvailable: true,
      totalMs: 120,
      serverMs: 80,
      networkMs: 40,
      requestSize: 100,
      responseSize: 200,
      customTimings: {database: 30},
    },
    {
      sequence: 2,
      completedAt: 2_000,
      status: "NO_UPDATE",
      measurementAvailable: true,
      totalMs: 50,
      serverMs: 25,
      networkMs: 25,
      requestSize: 40,
      responseSize: 60,
      customTimings: {database: 12},
    },
  ]);
});

test("monitor refresh captures polling callbacks when a store notification is missed", () => {
  const monitor = createCallbackPerformanceMonitor({now: () => 5_000});
  const store = createStore();
  monitor.install({dash_stores: [store]});

  store.replace({
    callbacks: {
      "clock.children": callbackProfile({
        count: 1,
        total: 18,
        server: 7,
        network: 11,
        upload: 12,
        download: 24,
      }),
    },
    updated: ["clock.children"],
  });
  monitor.refresh();

  const performance = monitor.getCallback("clock.children");
  assert.equal(performance.executionCount, 1);
  assert.equal(performance.latestMs, 18);
  assert.equal(performance.history[0].completedAt, 5_000);
});

test("monitor scans every existing callback when it attaches to a populated store", () => {
  const store = createStore({
    profile: {
      callbacks: {
        "first.children": callbackProfile({
          count: 1, total: 20, server: 12, network: 8, upload: 5, download: 10,
        }),
        "second.children": callbackProfile({
          count: 1, total: 30, server: 18, network: 12, upload: 6, download: 11,
        }),
      },
      updated: ["second.children"],
    },
  });
  const monitor = createCallbackPerformanceMonitor({now: () => 5_000});
  monitor.install({dash_stores: [store]});

  assert.equal(monitor.getCallback("first.children").executionCount, 1);
  assert.equal(monitor.getCallback("second.children").executionCount, 1);
});

test("fallback refresh finds callbacks beyond the last updated identifier", () => {
  const store = createStore();
  const monitor = createCallbackPerformanceMonitor({now: () => 5_000});
  monitor.install({dash_stores: [store]});
  store.replace({
    callbacks: {
      "first.children": callbackProfile({
        count: 1, total: 20, server: 12, network: 8, upload: 5, download: 10,
      }),
      "second.children": callbackProfile({
        count: 1, total: 30, server: 18, network: 12, upload: 6, download: 11,
      }),
    },
    updated: ["second.children"],
  });
  monitor.refresh();

  assert.equal(monitor.getCallback("first.children").executionCount, 1);
  assert.equal(monitor.getCallback("second.children").executionCount, 1);
});

test("monitor records no-response attempts without corrupting timing aggregates", () => {
  const monitor = createCallbackPerformanceMonitor({now: () => 4_000});
  const store = createStore();
  monitor.install({dash_stores: [store]});

  publish(store, "result.children", callbackProfile({
    count: 1,
    total: 40,
    server: 25,
    network: 15,
    upload: 50,
    download: 80,
  }));
  publish(store, "result.children", callbackProfile({
    count: 2,
    total: 40,
    server: 25,
    network: 15,
    upload: 50,
    download: 80,
    latest: "NO_RESPONSE",
    statuses: {SUCCESS: 1, NO_RESPONSE: 1},
  }));

  const performance = monitor.getCallback("result.children");
  assert.equal(performance.executionCount, 2);
  assert.equal(performance.measuredCount, 1);
  assert.equal(performance.averageMs, 40);
  assert.equal(performance.latestMs, null);
  assert.equal(performance.minMs, 40);
  assert.equal(performance.maxMs, 40);
  assert.equal(performance.history[1].status, "NO_RESPONSE");
  assert.equal(performance.history[1].measurementAvailable, false);
  assert.equal(performance.history[1].totalMs, null);
  assert.equal(performance.lastExecutedAt, 4_000);
});

test("monitor bounds detailed history while retaining lifecycle aggregates", () => {
  let clock = 0;
  const monitor = createCallbackPerformanceMonitor({historyLimit: 2, now: () => ++clock});
  const store = createStore();
  monitor.install({dash_stores: [store]});

  for (let count = 1; count <= 3; count += 1) {
    publish(store, "result.children", callbackProfile({
      count,
      total: count * 10,
      server: count * 6,
      network: count * 4,
      upload: count * 2,
      download: count * 3,
    }));
  }

  const performance = monitor.getCallback("result.children");
  assert.deepEqual(performance.history.map((record) => record.sequence), [2, 3]);
  assert.equal(performance.discardedCount, 1);
  assert.equal(performance.executionCount, 3);
  assert.equal(performance.averageMs, 10);
  assert.equal(performance.minMs, 10);
  assert.equal(performance.maxMs, 10);
});

test("monitor reports executions that predate attachment as unobserved", () => {
  const callbackId = "result.children";
  const store = createStore({
    profile: {
      callbacks: {
        [callbackId]: callbackProfile({
          count: 3,
          total: 90,
          server: 60,
          network: 30,
          upload: 30,
          download: 60,
        }),
      },
      updated: [callbackId],
    },
  });
  const monitor = createCallbackPerformanceMonitor();
  monitor.install({dash_stores: [store]});

  const performance = monitor.getCallback(callbackId);
  assert.equal(performance.executionCount, 3);
  assert.equal(performance.averageMs, 30);
  assert.equal(performance.history.length, 0);
  assert.equal(performance.lastExecutedAt, null);
  assert.equal(performance.unobservedCount, 3);
});
