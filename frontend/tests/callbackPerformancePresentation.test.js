import assert from "node:assert/strict";
import test from "node:test";
import {performanceSummary} from "../src/callbackPerformanceView.js";

const performance = {
  latestMs: 125, averageMs: 100,
  history: Array.from({length: 30}, (_, i) => ({sequence: i + 1, totalMs: i + 1})),
  statusCounts: {SUCCESS: 20, NO_UPDATE: 4, HTTP_ERROR: 2, CLIENTSIDE_ERROR: 3, NO_RESPONSE: 1},
  resourceTotals: {database: 40, compute: 120, absent: NaN, zero: 0},
  discardedCount: 2, unobservedCount: 3,
};

test("summary distinguishes failed runs from successful no-update outcomes", () => {
  const summary = performanceSummary(performance);
  assert.equal(summary.failedCount, 6);
  assert.equal(summary.comparison, 25);
  assert.equal(performanceSummary({...performance, latestMs: 80}).comparison, -20);
  for (const values of [{latestMs: null}, {averageMs: 0}, {averageMs: Infinity}]) {
    assert.equal(performanceSummary({...performance, ...values}).comparison, null);
  }
});

test("history disclosure preserves newest-first order and accurate omission counts", () => {
  const compact = performanceSummary(performance);
  const expanded = performanceSummary(performance, true);
  assert.deepEqual(compact.history.map((record) => record.sequence), [30, 29, 28, 27, 26]);
  assert.equal(compact.omittedCount, 30);
  assert.equal(expanded.history.length, 20);
  assert.equal(expanded.omittedCount, 15);
  assert.equal(compact.historyMaximum, 30);
  assert.equal(performance.history[0].sequence, 1);
});

test("custom timing comparison sorts valid independent durations without implying percentages of total", () => {
  const summary = performanceSummary(performance);
  assert.deepEqual(summary.timings, [["compute", 120], ["database", 40], ["zero", 0]]);
  assert.equal(summary.timingMaximum, 120);
  const empty = performanceSummary({...performance, history: [], resourceTotals: {}, statusCounts: {}, latestMs: null});
  assert.equal(empty.historyMaximum, 0);
  assert.equal(empty.timingMaximum, 0);
  assert.equal(empty.failedCount, 0);
});
