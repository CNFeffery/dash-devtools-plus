// Keep metric semantics shared by the history table and chart.
export const PERFORMANCE_DURATION_COLUMNS = [
  ["averageMs", "performanceAverage"],
  ["latestMs", "performanceLatest"],
  ["minMs", "performanceMinimum"],
  ["maxMs", "performanceMaximum"],
];

export function performancePresentation(row) {
  if (row.mode === "client") return {
    phases: ["client"], hint: "performanceClientHint", transfer: "none",
  };
  if (row.websocket || row.background) return {
    phases: ["total"],
    hint: row.websocket ? "performanceWebsocketHint" : "performanceBackgroundHint",
    transfer: "unknown",
  };
  return {phases: ["server", "network", "total"], hint: "performanceHttpHint", transfer: "profile"};
}

export function timingPhases(record, presentation) {
  if (!record.measurementAvailable) return [];
  if (presentation.phases.length === 1) {
    return [{phase: presentation.phases[0], duration: record.totalMs}];
  }
  // Zero compute may mean the Server-Timing header was absent. Avoid turning
  // an unknown split into a claim that all time was spent on the network.
  if (!(record.serverMs > 0) || !Number.isFinite(record.networkMs)) {
    return [{phase: "total", duration: record.totalMs}];
  }
  return [
    {phase: "server", duration: record.serverMs},
    {phase: "network", duration: record.networkMs},
  ];
}

export function transferValue(value, presentation) {
  if (presentation.transfer === "none") return 0;
  if (presentation.transfer === "unknown") return null;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function omittedHistoryCount(performance, visibleCount) {
  return performance.discardedCount + performance.unobservedCount +
    Math.max(0, performance.history.length - visibleCount);
}

export function performanceSummary(performance, expanded = false) {
  const history = [...performance.history].reverse().slice(0, expanded ? 20 : 5);
  const failedCount = ["HTTP_ERROR", "CLIENTSIDE_ERROR", "NO_RESPONSE"]
    .reduce((sum, status) => sum + (performance.statusCounts[status] || 0), 0);
  const comparison = Number.isFinite(performance.latestMs) && Number.isFinite(performance.averageMs) && performance.averageMs > 0
    ? Math.round((performance.latestMs / performance.averageMs - 1) * 100) : null;
  const timings = Object.entries(performance.resourceTotals)
    .filter(([, duration]) => Number.isFinite(duration) && duration >= 0)
    .sort((left, right) => right[1] - left[1]);
  return {
    history, failedCount, comparison,
    omittedCount: omittedHistoryCount(performance, history.length),
    historyMaximum: Math.max(0, ...history.map((record) => record.totalMs || 0)),
    timings,
    timingMaximum: timings[0]?.[1] || 0,
  };
}
