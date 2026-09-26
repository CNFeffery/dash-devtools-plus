import React, {useEffect, useMemo, useRef, useState} from "react";
import {Chart} from "@antv/g2";
import {Popover, Tooltip} from "antd";
import {ArrowDownOutlined, ArrowUpOutlined, DownOutlined, InfoCircleOutlined} from "@ant-design/icons";
import {useCallbackPerformance} from "./useCallbackPerformance";
import {createLiveLegendChart} from "./liveLegendChart";
import {performancePresentation, performanceSummary, timingPhases, transferValue} from "./callbackPerformanceView";

const PHASE_LABELS = {server: "performanceServer", network: "performanceNetworkOther", client: "performanceClient", total: "performanceTotal"};
const PHASE_COLORS = {server: "#147d78", network: "#aec6d2", client: "#147d78", total: "#526b89"};
const STATUS_LABELS = {SUCCESS: "performanceStatusSuccess", NO_UPDATE: "performanceStatusNoUpdate", NO_RESPONSE: "performanceStatusNoResponse", CLIENTSIDE_ERROR: "performanceStatusClientError", HTTP_ERROR: "performanceStatusHttpError"};

function duration(value) {
  if (!Number.isFinite(value)) return ["—", ""];
  if (value >= 1000) return [(value / 1000).toFixed(value >= 10000 ? 1 : 2), "s"];
  return [value > 0 && value < 1 ? "<1" : String(Math.round(value)), "ms"];
}

function bytes(value) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1048576) return `${(value / 1048576).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${Math.round(value)} B`;
}

function Duration({value}) {
  const [number, unit] = duration(value);
  return <span className="ddp-perf-duration">{number}{unit && <small>{unit}</small>}</span>;
}

function Status({status, code, t}) {
  return <span className={`ddp-perf-status is-${String(status || "unknown").toLowerCase()}`}>
    <i aria-hidden="true" />{t(STATUS_LABELS[status] || "performanceStatusUnknown")}{code ? ` · ${code}` : ""}
  </span>;
}

function DurationChart({history, presentation, t}) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const selectionRef = useRef(null);
  const records = useMemo(() => history.filter((record) => record.measurementAvailable).slice(-30), [history]);
  const data = useMemo(() => records.flatMap((record) => timingPhases(record, presentation)
    .map((phase) => ({sample: String(record.sequence), ...phase}))), [records, presentation]);
  const phaseKey = presentation.phases.filter((phase) => data.some((item) => item.phase === phase)).join(",");
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const phases = phaseKey.split(",");
    const chart = new Chart({container: containerRef.current, autoFit: true, height: 180});
    chart.options({
      type: "view", data, paddingTop: 30, paddingLeft: 38, paddingRight: 8, paddingBottom: 22,
      encode: {x: "sample", y: "duration", color: "phase"},
      scale: {x: {padding: 0.4}, y: {nice: true, tickCount: 3}, color: {domain: phases, range: phases.map((phase) => PHASE_COLORS[phase])}},
      axis: {
        x: {title: false, tick: false, line: false, labelFontSize: 10, labelFill: "#7b8a99", labelAutoHide: true},
        y: {title: false, tick: false, line: false, labelFontSize: 10, labelFill: "#7b8a99", grid: true, gridStroke: "#e8edf1", gridLineDash: [3, 3]},
      },
      legend: {color: {position: "top", layout: {justifyContent: "flex-end"}, labelFontSize: 10,
        labelFormatter: (phase) => t(PHASE_LABELS[phase]), defaultSelect: selectionRef.current ?? undefined}},
      interaction: {tooltip: {shared: true}, legendFilter: true}, animate: false,
      children: [{type: "interval", transform: [{type: "stackY"}], style: {maxWidth: 18, radiusTopLeft: 2, radiusTopRight: 2}}],
    });
    const controller = createLiveLegendChart(chart, phases, data, selectionRef);
    controllerRef.current = controller;
    return () => { controller.destroy(); controllerRef.current = null; };
  }, [phaseKey, t]);
  useEffect(() => {
    controllerRef.current?.update(data).catch((error) => console.warn("[dash-devtools-plus] Performance chart failed", error));
  }, [data, phaseKey, t]);
  return <div className="ddp-perf-chart">
    <div className="ddp-perf-chart-heading"><span>{t("performanceTrend")}</span><small>{t("performanceRecentSamples").replace("{count}", records.length)} · ms</small></div>
    {records.length ? <div ref={containerRef} className="ddp-perf-chart-canvas" role="img" aria-label={t("performanceTrend")} />
      : <div className="ddp-perf-chart-empty"><span>—</span><p>{t("performanceNoSamples")}</p></div>}
    {records.length > 0 && <div className="ddp-perf-chart-caption"><span>#{records[0].sequence}</span><span>{t("performanceExecutionOrder")}</span><span>#{records.at(-1).sequence}</span></div>}
  </div>;
}

export default function CallbackPerformanceSection({row, t}) {
  const {connected, performance} = useCallbackPerformance(row.callbackId);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [row.callbackId]);
  const presentation = useMemo(() => performancePresentation(row), [row.mode, row.background, row.websocket]);
  const summary = useMemo(() => performanceSummary(performance, expanded), [performance, expanded]);
  const request = transferValue(performance.requestSize, presentation);
  const response = transferValue(performance.responseSize, presentation);
  const total = request === null || response === null ? null : request + response;
  const status = performance.latestStatus;
  const hasCustomHistory = summary.history.some((record) => Object.keys(record.customTimings).length);
  const scope = <div className="ddp-perf-methodology">
    <p>{t("performanceScopeHint").replace("{count}", performance.sampledCount)}</p>
    <p>{t(presentation.hint)}</p><p>{t("performanceTransferHint")}</p>
  </div>;

  return <section className="ddp-performance-workspace" aria-label={t("performanceTitle")}>
    <header className="ddp-perf-header">
      <div><span className="ddp-perf-eyebrow">{t("performanceEyebrow")}</span><h3>{t("performanceTitle")}</h3></div>
      <div className="ddp-perf-header-actions">
        <span className={`ddp-perf-live ${connected ? "is-connected" : ""}`}><i />{t(connected ? "performanceLiveShort" : "performanceWaiting")}</span>
        <Popover content={scope} title={t("performanceMethodology")} trigger="click" placement="bottomRight">
          <button type="button" className="ddp-perf-info" aria-label={t("performanceMethodology")}><InfoCircleOutlined /></button>
        </Popover>
      </div>
    </header>

    <div className="ddp-perf-overview">
      <div className="ddp-perf-hero">
        <span className="ddp-perf-label">{t("performanceLatest")}</span>
        <strong className="ddp-perf-hero-value"><Duration value={performance.latestMs} /></strong>
        <div className="ddp-perf-hero-status">{performance.executionCount ? <Status status={status} t={t} /> : <span>{t("performanceNotRun")}</span>}</div>
        {summary.comparison !== null && <div className={`ddp-perf-comparison ${summary.comparison > 0 ? "is-slower" : "is-faster"}`}>
          {summary.comparison !== 0 && (summary.comparison > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />)}
          <b>{Math.abs(summary.comparison)}%</b><span>{t("performanceVersusAverage")}</span>
        </div>}
        <div className="ddp-perf-last-time">{Number.isFinite(performance.lastExecutedAt)
          ? <time dateTime={new Date(performance.lastExecutedAt).toISOString()} title={new Date(performance.lastExecutedAt).toLocaleString()}>{new Date(performance.lastExecutedAt).toLocaleTimeString()}</time>
          : t("performanceTimeUnavailable")}</div>
      </div>
      <DurationChart history={performance.history} presentation={presentation} t={t} />
    </div>

    <dl className="ddp-perf-metrics">
      <div><dt>{t("performanceExecutions")}</dt><dd>{performance.executionCount.toLocaleString()}<small>{t("performanceRunsShort")}</small></dd>
        <span className={summary.failedCount ? "ddp-perf-failures" : ""}>{summary.failedCount ? t("performanceFailures").replace("{count}", summary.failedCount) : t("performancePageSession")}</span></div>
      <div><dt>{t("performanceAverage")}</dt><dd><Duration value={performance.averageMs} /></dd><span>{t("performanceTimedSamples").replace("{count}", performance.measuredCount)}</span></div>
      <div><dt>{t("performanceMinimum")}</dt><dd><Duration value={performance.minMs} /></dd><span>{t("performanceCapturedSamples").replace("{count}", performance.sampledCount)}</span></div>
      <div><dt>{t("performanceMaximum")}</dt><dd><Duration value={performance.maxMs} /></dd><span>{t("performanceCapturedSamples").replace("{count}", performance.sampledCount)}</span></div>
    </dl>

    <div className={`ddp-perf-resources ${summary.timings.length ? "has-timings" : ""}`}>
      <div className="ddp-perf-transfer">
        <div className="ddp-perf-subheading"><span>{t("performanceTransfer")}</span><Tooltip title={t("performanceTransferHint")}><button type="button" className="ddp-perf-info" aria-label={t("performanceTransferHint")}><InfoCircleOutlined /></button></Tooltip></div>
        <div className="ddp-perf-transfer-values"><strong>{bytes(total)}</strong><span><ArrowUpOutlined />{t("performanceRequest")}<b>{bytes(request)}</b></span><span><ArrowDownOutlined />{t("performanceResponse")}<b>{bytes(response)}</b></span></div>
      </div>
      {summary.timings.length > 0 && <details className="ddp-perf-custom">
        <summary><span>{t("performanceCustomTimings")}<b>{summary.timings.length}</b></span><DownOutlined /></summary>
        <div className="ddp-perf-timing-list">{summary.timings.map(([name, value]) => <div key={name}>
          <span title={name}>{name}</span><span className="ddp-perf-timing-track"><i style={{width: `${summary.timingMaximum ? value / summary.timingMaximum * 100 : 0}%`}} /></span><strong><Duration value={value} /></strong>
        </div>)}</div>
      </details>}
    </div>

    <div className="ddp-perf-history-heading"><h4>{t("performanceHistory")}</h4><span>{t("performanceVisibleRecords").replace("{count}", summary.history.length)}</span></div>
    {summary.history.length ? <div className="ddp-perf-history-scroll" tabIndex={0} role="region" aria-label={t("performanceHistory")}>
      <table className="ddp-perf-history-table">
        <thead><tr><th scope="col">#</th><th scope="col">{t("performanceCompleted")}</th><th scope="col">{t("performanceStatus")}</th><th scope="col">{t("performanceTotal")}</th>
          {presentation.phases.length > 1 && <><th scope="col">{t("performanceServer")}</th><th scope="col">{t("performanceNetworkOther")}</th></>}
          <th scope="col">{t("performanceTransfer")}</th>{hasCustomHistory && <th scope="col">{t("performanceCustomRun")}</th>}</tr></thead>
        <tbody>{summary.history.map((record) => <tr key={record.sequence}>
          <td className="ddp-perf-sequence">{String(record.sequence).padStart(2, "0")}</td>
          <td>{Number.isFinite(record.completedAt) ? new Date(record.completedAt).toLocaleTimeString() : "—"}</td>
          <td><Status status={record.status} code={record.httpStatus} t={t} /></td>
          <td className="ddp-perf-total-cell"><span className="ddp-perf-duration-bar" aria-hidden="true" style={{width: `${summary.historyMaximum && record.totalMs !== null ? Math.max(0, record.totalMs / summary.historyMaximum * 100) : 0}%`}} /><strong><Duration value={record.totalMs} /></strong></td>
          {presentation.phases.length > 1 && <><td><Duration value={record.serverMs > 0 ? record.serverMs : null} /></td><td><Duration value={record.serverMs > 0 ? record.networkMs : null} /></td></>}
          <td><span className="ddp-perf-payload" title={`${t("performanceRequest")} / ${t("performanceResponse")}`}><span>↑ {bytes(transferValue(record.requestSize, presentation))}</span><span>↓ {bytes(transferValue(record.responseSize, presentation))}</span></span></td>
          {hasCustomHistory && <td className="ddp-perf-custom-cell">{Object.entries(record.customTimings).map(([name, value]) => <span key={name}>{name} <Duration value={value} /></span>)}</td>}
        </tr>)}</tbody>
      </table>
    </div> : <div className="ddp-perf-history-empty"><strong>{t("performanceNoHistory")}</strong><span>{t("performanceNoHistoryHint")}</span></div>}
    <div className="ddp-perf-footer"><span>{summary.omittedCount > 0 ? t("performanceOmitted").replace("{count}", summary.omittedCount) : t("performancePageSession")}</span>
      {performance.history.length > 5 && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{t(expanded ? "performanceCollapse" : "performanceExpand").replace("{count}", Math.min(20, performance.history.length))}<DownOutlined className={expanded ? "is-expanded" : ""} /></button>}
    </div>
  </section>;
}
