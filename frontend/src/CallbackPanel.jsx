import React, {useEffect, useMemo, useRef, useState} from "react";
import {Chart} from "@antv/g2";
import {createLiveLegendChart} from "./liveLegendChart";
import {Alert, Button, Dropdown, Empty, Input, Modal, Popover, Select, Space, Switch, Table, Tag, Tooltip} from "antd";
import {
  ApiOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExportOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {siCursor, siPycharm} from "simple-icons";
import {comparePerformanceValues, describeExecutionRecency} from "./callbackPerformance";
import {
  readCallbackPerformanceColumns,
  writeCallbackPerformanceColumns,
} from "./callbackTablePreferences";
import {endpointUrl, normalizeCallbacks} from "./utils";
import {useCallbackPerformance, useCallbackPerformanceSnapshot} from "./useCallbackPerformance";

const PAGE_SIZE = 8;
const SELECT_CLASS_NAMES = {popup: {root: "ddp-callback-select-popup"}};

const ROLE_ICONS = {
  input: <ImportOutlined />,
  output: <ExportOutlined />,
  state: <DatabaseOutlined />,
};

function RolePopoverContent({kind, title, items, t}) {
  return (
    <div className={`ddp-role-popover is-${kind}`}>
      <div className="ddp-role-popover-heading">
        <span aria-hidden="true">{ROLE_ICONS[kind]}</span>
        <div>
          <strong>{title}</strong>
          <small>{t("completeRoleList")}</small>
        </div>
        <b>{items.length}</b>
      </div>
      <div className="ddp-role-popover-list">
        {items.map((item, index) => (
          <div key={`${kind}-${item}-${index}`}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <code>{item}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleCell({kind, title, items, empty, t}) {
  if (!items.length) return <span className="ddp-muted">{empty}</span>;

  return (
    <Popover
      rootClassName="ddp-role-popover-root"
      placement="topLeft"
      trigger={["hover", "focus"]}
      mouseEnterDelay={0.12}
      content={<RolePopoverContent kind={kind} title={title} items={items} t={t} />}
    >
      <button
        type="button"
        className={`ddp-role-preview is-${kind}`}
        aria-label={`${title}: ${items.join(", ")}`}
      >
        <span className="ddp-role-preview-icon" aria-hidden="true">{ROLE_ICONS[kind]}</span>
        <code>{items[0]}</code>
        {items.length > 1 && <b>+{items.length - 1}</b>}
      </button>
    </Popover>
  );
}

function NoOutputRole({t}) {
  return (
    <span className="ddp-no-output-role">
      <StopOutlined aria-hidden="true" />
      {t("noOutputRole")}
    </span>
  );
}

function SimpleBrandIcon({icon}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
}

function VsCodeIcon() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M96.46 10.8 75.86.88a6.25 6.25 0 0 0-7.11 1.2L1.3 63.58a4.17 4.17 0 0 0 0 6.16l5.51 5.01a4.17 4.17 0 0 0 5.32.24l81.23-61.62c2.73-2.07 6.64-.12 6.64 3.3v-.24a6.25 6.25 0 0 0-3.54-5.63Z" fill="#0065A9" />
      <path d="m96.46 89.2-20.6 9.92a6.25 6.25 0 0 1-7.11-1.2L1.3 36.42a4.17 4.17 0 0 1 0-6.17l5.51-5a4.17 4.17 0 0 1 5.32-.24l81.23 61.62c2.73 2.07 6.64.12 6.64-3.3v.24a6.25 6.25 0 0 1-3.54 5.64Z" fill="#007ACC" />
      <path d="M75.86 99.13a6.25 6.25 0 0 1-7.11-1.21A3.65 3.65 0 0 0 75 95.33V4.67a3.65 3.65 0 0 0-6.25-2.59A6.25 6.25 0 0 1 75.86.87l20.6 9.91a6.25 6.25 0 0 1 3.54 5.63v67.18a6.25 6.25 0 0 1-3.54 5.63l-20.6 9.91Z" fill="#1F9CF0" />
    </svg>
  );
}

function EditorBrandIcon({editor}) {
  if (editor === "vscode") return <VsCodeIcon />;
  if (editor === "cursor") return <SimpleBrandIcon icon={siCursor} />;
  return <SimpleBrandIcon icon={siPycharm} />;
}

function EditorDropdown({row, t, children, placement = "bottomLeft"}) {
  if (!row.editorUris.length) return children;

  const items = row.editorUris.map((target) => {
    const supported = target.supported !== false && Boolean(target.uri);
    const content = (
      <>
        <span className={`ddp-editor-logo is-${target.id}`} aria-hidden="true">
          <EditorBrandIcon editor={target.id} />
        </span>
        <span className="ddp-editor-name">{target.label}</span>
      </>
    );
    return {
      key: target.id,
      disabled: !supported,
      label: supported
        ? <a className="ddp-editor-option" href={target.uri}>{content}</a>
        : <span className="ddp-editor-option is-disabled">{content}</span>,
    };
  });

  return (
    <Dropdown
      menu={{items}}
      placement={placement}
      trigger={["click"]}
      rootClassName="ddp-editor-dropdown"
    >
      {children}
    </Dropdown>
  );
}

function SourceLocation({row, t}) {
  if (row.sourceKind === "clientside") {
    return <span className="ddp-source-unavailable">{t("clientsideSource")}</span>;
  }
  if (!row.sourcePath || !row.sourceLine) {
    return <span className="ddp-source-unavailable">{t("sourceUnavailable")}</span>;
  }

  const location = `${row.sourcePath}:${row.sourceLine}`;
  const content = (
    <>
      <code>{row.sourceFunction}()</code>
      <span>
        {row.sourcePath}<b>:{row.sourceLine}</b>
        {row.editorUris.length > 0 && <DownOutlined className="ddp-source-open-icon" aria-hidden="true" />}
      </span>
    </>
  );

  if (!row.editorUris.length) {
    return <div className="ddp-source-location" title={`${row.sourceFunction} · ${location}`}>{content}</div>;
  }

  return (
    <EditorDropdown row={row} t={t}>
      <Tooltip title={t("openSourceInEditor")} placement="topLeft" mouseEnterDelay={0.25}>
        <button
          type="button"
          className="ddp-source-location is-actionable"
          aria-label={`${t("openSourceInEditor")} · ${location}`}
        >
          {content}
        </button>
      </Tooltip>
    </EditorDropdown>
  );
}

function DocstringPopoverContent({docstring, t}) {
  return (
    <div className="ddp-docstring-popover">
      <div className="ddp-docstring-popover-heading">
        <span aria-hidden="true"><FileTextOutlined /></span>
        <div>
          <strong>{t("docstringHeading")}</strong>
          <small>{t("docstringFormattingHint")}</small>
        </div>
      </div>
      <pre>{docstring}</pre>
    </div>
  );
}

function DocstringCell({docstring, mode, t}) {
  if (!docstring) {
    return (
      <span className="ddp-docstring-empty">
        <FileTextOutlined aria-hidden="true" />
        {t(mode === "client" ? "clientDocstringUnavailable" : "docstringUnavailable")}
      </span>
    );
  }

  return (
    <Popover
      rootClassName="ddp-docstring-popover-root"
      placement="topLeft"
      trigger={["hover", "focus"]}
      mouseEnterDelay={0.15}
      content={<DocstringPopoverContent docstring={docstring} t={t} />}
    >
      <button
        type="button"
        className="ddp-docstring-preview"
        aria-label={t("viewDocstring")}
      >
        <span><FileTextOutlined aria-hidden="true" />{t("docstringAvailable")}</span>
        <pre>{docstring}</pre>
      </button>
    </Popover>
  );
}

function formatDuration(value, empty = "—") {
  if (!Number.isFinite(value)) return empty;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} s`;
  if (value > 0 && value < 1) return "<1 ms";
  return `${Math.round(value)} ms`;
}

function formatBytes(value, empty = "—") {
  if (!Number.isFinite(value)) return empty;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${Math.round(value)} B`;
}

function performanceStatusLabel(status, t) {
  return {
    SUCCESS: t("performanceStatusSuccess"),
    NO_UPDATE: t("performanceStatusNoUpdate"),
    NO_RESPONSE: t("performanceStatusNoResponse"),
    CLIENTSIDE_ERROR: t("performanceStatusClientError"),
  }[status] || status || t("performanceStatusUnknown");
}

function PerformanceMetricCell({connected, metric, performance, t}) {
  if (!connected) {
    return (
      <span className="ddp-performance-empty">
        <FieldTimeOutlined aria-hidden="true" />
        {t("performanceWaiting")}
      </span>
    );
  }

  const value = performance[metric];
  const isExecutionCount = metric === "executionCount";
  if (!isExecutionCount && !Number.isFinite(value)) {
    return <span className="ddp-performance-empty">—</span>;
  }

  return (
    <span className={`ddp-performance-metric is-${metric}`}>
      {isExecutionCount ? value : formatDuration(value)}
    </span>
  );
}

function formatLocalExecutionTime(completedAt) {
  if (!Number.isFinite(completedAt)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(completedAt));
}

function formatExecutionRecency(completedAt, currentTime, t) {
  const recency = describeExecutionRecency(completedAt, currentTime);
  if (!recency) return t("performanceNotRun");
  if (recency.bucket === "seconds") {
    return t("lastExecutionSecondsAgo").replace("{seconds}", String(recency.seconds));
  }
  if (recency.bucket === "minutes") {
    return t("lastExecutionMinutesAgo")
      .replace("{minutes}", String(recency.minutes))
      .replace("{seconds}", String(recency.seconds));
  }
  return t("lastExecutionOverTenMinutesAgo");
}

function LastExecutionCell({connected, completedAt, executionCount, currentTime, t}) {
  if (!connected) {
    return (
      <span className="ddp-performance-empty">
        <FieldTimeOutlined aria-hidden="true" />
        {t("performanceWaiting")}
      </span>
    );
  }
  if (!Number.isFinite(completedAt)) {
    return (
      <span className="ddp-performance-empty">
        {t(executionCount > 0 ? "performanceTimeUnavailable" : "performanceNotRun")}
      </span>
    );
  }

  const absoluteTime = formatLocalExecutionTime(completedAt);
  return (
    <time
      className="ddp-last-execution"
      dateTime={new Date(completedAt).toISOString()}
      title={absoluteTime}
    >
      <strong>{absoluteTime}</strong>
      <span><HistoryOutlined aria-hidden="true" />{formatExecutionRecency(completedAt, currentTime, t)}</span>
    </time>
  );
}

const PERFORMANCE_PHASES = ["server", "network"];

function PerformanceSparkline({history, t}) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const selectedPhasesRef = useRef(null);
  const records = useMemo(() => history
    .filter((record) => record.measurementAvailable)
    .slice(-30), [history]);
  const chartData = useMemo(() => records.flatMap((record, index) => {
    const total = Math.max(0, Number(record.totalMs) || 0);
    const server = Math.min(total, Math.max(0, Number(record.serverMs) || 0));
    return [
      {sample: String(index + 1), duration: server, phase: "server"},
      {sample: String(index + 1), duration: total - server, phase: "network"},
    ];
  }), [records]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = new Chart({container: containerRef.current, autoFit: true, height: 120});
    chart.options({
      type: "view",
      autoFit: true,
      data: chartData,
      paddingLeft: 7,
      paddingRight: 7,
      paddingTop: 28,
      paddingBottom: 5,
      encode: {x: "sample", y: "duration", color: "phase"},
      scale: {
        x: {padding: 0.68},
        y: {nice: true},
        color: {
          domain: PERFORMANCE_PHASES,
          range: ["#36a986", "#119dff"],
        },
      },
      axis: {x: false, y: false},
      legend: {color: {
        position: "top",
        layout: {justifyContent: "flex-end"},
        labelFormatter: (phase) => phase === "server" ? t("performanceServer") : t("performanceNetwork"),
        defaultSelect: selectedPhasesRef.current ?? undefined,
      }},
      interaction: {tooltip: {shared: true}, legendFilter: true},
      animate: false,
      children: [
        {
          type: "interval",
          transform: [{type: "dodgeX", padding: 0}],
          style: {
            fillOpacity: 0.9,
            radiusTopLeft: 2,
            radiusTopRight: 2,
          },
        },
      ],
    });
    const controller = createLiveLegendChart(chart, PERFORMANCE_PHASES, chartData, selectedPhasesRef);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [records.length > 0, t]);

  useEffect(() => {
    controllerRef.current?.update(chartData).catch((error) => {
      console.warn("[dash-devtools-plus] Callback performance chart render failed", error);
    });
  }, [chartData, records, t]);

  return (
    <div className="ddp-performance-chart">
      <div className="ddp-performance-chart-label">
        <span className="ddp-performance-chart-title"><LineChartOutlined />{t("performanceTrend")}</span>
        <div className="ddp-performance-chart-meta">
          <small>{t("performanceRecentSamples").replace("{count}", String(records.length))}</small>
        </div>
      </div>
      {records.length ? (
        <div ref={containerRef} className="ddp-performance-chart-canvas" aria-label={t("performanceTrend")} />
      ) : (
        <div className="ddp-performance-chart-empty">{t("performanceNoSamples")}</div>
      )}
    </div>
  );
}

function CallbackPerformanceSection({callbackId, t}) {
  const {connected, performance} = useCallbackPerformance(callbackId);
  const history = [...performance.history].reverse().slice(0, 20);
  const transferTotal = performance.requestSize + performance.responseSize;
  const supportingMetrics = [
    [t("performanceExecutions"), String(performance.executionCount), "is-count"],
    [t("performanceAverage"), formatDuration(performance.averageMs), "is-average"],
    [t("performanceMaximum"), formatDuration(performance.maxMs), "is-maximum"],
    [t("performanceMinimum"), formatDuration(performance.minMs), "is-minimum"],
  ];

  return (
    <section className="ddp-detail-section ddp-performance-section" aria-label={t("performanceTitle")}>
      <div className="ddp-detail-section-heading">
        <div>
          <span>{t("performanceEyebrow")}</span>
          <h3>{t("performanceTitle")}</h3>
        </div>
        <span className={`ddp-performance-live ${connected ? "is-connected" : ""}`}>
          <i aria-hidden="true" />
          {t(connected ? "performanceLive" : "performanceWaiting")}
        </span>
      </div>

      <div className="ddp-performance-console">
        <div className="ddp-performance-primary">
          <div className="ddp-performance-hero-label">
            <span aria-hidden="true"><FieldTimeOutlined /></span>
            <span>{t("performanceLatest")}</span>
          </div>
          <strong>{formatDuration(performance.latestMs)}</strong>
          <div className="ddp-performance-hero-meta">
            <span className={`ddp-performance-status is-${String(performance.latestStatus || "unknown").toLowerCase().replaceAll("_", "-")}`}>
              {performance.executionCount
                ? performanceStatusLabel(performance.latestStatus, t)
                : t("performanceNotRun")}
            </span>
            <small>{performance.executionCount}{t("performanceRunsShort")}</small>
          </div>
        </div>
        <div className="ddp-performance-stats">
          {supportingMetrics.map(([label, value, className]) => (
            <div className={className} key={label}>
              <i aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="ddp-performance-analysis">
        <PerformanceSparkline history={performance.history} t={t} />
        <div className="ddp-performance-transfer">
          <div className="ddp-performance-transfer-heading">
            <span><SwapOutlined />{t("performanceTransfer")}</span>
            <Tooltip title={t("performanceTransferHint")} placement="topRight">
              <InfoCircleOutlined className="ddp-performance-transfer-info" />
            </Tooltip>
          </div>
          <strong className="ddp-performance-transfer-total">{formatBytes(transferTotal)}</strong>
          <div className="ddp-performance-transfer-breakdown">
            <div>
              <span><i className="is-request" />{t("performanceRequest")}</span>
              <strong>{formatBytes(performance.requestSize)}</strong>
            </div>
            <div>
              <span><i className="is-response" />{t("performanceResponse")}</span>
              <strong>{formatBytes(performance.responseSize)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="ddp-performance-history-heading">
        <div>
          <HistoryOutlined aria-hidden="true" />
          <span>{t("performanceHistory")}</span>
        </div>
        {(performance.discardedCount > 0 || performance.unobservedCount > 0) && (
          <small>
            {t("performanceOmitted").replace(
              "{count}",
              String(performance.discardedCount + performance.unobservedCount),
            )}
          </small>
        )}
      </div>

      {history.length ? (
        <div className="ddp-performance-history-scroll">
          <table className="ddp-performance-history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("performanceCompleted")}</th>
                <th>{t("performanceStatus")}</th>
                <th>{t("performanceTotal")}</th>
                <th>{t("performanceServer")}</th>
                <th>{t("performanceNetwork")}</th>
                <th>{t("performanceRequest")}</th>
                <th>{t("performanceResponse")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.sequence}>
                  <td>{record.sequence}</td>
                  <td>{new Date(record.completedAt).toLocaleTimeString()}</td>
                  <td>
                    <span className={`ddp-performance-status is-${String(record.status || "unknown").toLowerCase().replaceAll("_", "-")}`}>
                      {performanceStatusLabel(record.status, t)}
                    </span>
                  </td>
                  <td><strong>{formatDuration(record.totalMs)}</strong></td>
                  <td>{formatDuration(record.serverMs)}</td>
                  <td>{formatDuration(record.networkMs)}</td>
                  <td>{formatBytes(record.requestSize)}</td>
                  <td>{formatBytes(record.responseSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ddp-performance-history-empty">
          <ThunderboltOutlined aria-hidden="true" />
          <strong>{t("performanceNoHistory")}</strong>
          <span>{t("performanceNoHistoryHint")}</span>
        </div>
      )}
    </section>
  );
}

function DetailDependencyGroup({kind, title, items, empty}) {
  return (
    <div className={`ddp-detail-dependency-group is-${kind}`}>
      <div className="ddp-detail-dependency-heading">
        <span><i aria-hidden="true">{ROLE_ICONS[kind]}</i>{title}</span>
        <b>{items.length}</b>
      </div>
      <div className="ddp-detail-dependency-list">
        {items.length ? items.map((item, itemIndex) => (
          <div className="ddp-detail-dependency" key={`${kind}-${item}-${itemIndex}`}>
            <i>{String(itemIndex + 1).padStart(2, "0")}</i>
            <code title={item}>{item}</code>
          </div>
        )) : <span className="ddp-detail-empty">{empty}</span>}
      </div>
    </div>
  );
}

function NoOutputTerminal({t}) {
  return (
    <div className="ddp-detail-side-effect-node">
      <span aria-hidden="true"><StopOutlined /></span>
      <small>{t("sideEffectTerminal")}</small>
      <strong>{t("noOutputRole")}</strong>
      <p>{t("sideEffectHint")}</p>
    </div>
  );
}

function CallbackDetailModal({row, ...props}) {
  if (!row) return null;
  return <CallbackDetailModalContent row={row} {...props} />;
}

function CallbackDetailModalContent({row, open, onClose, onAfterClose, t}) {

  const callbackName = row.mode === "client"
    ? t("clientsideCallback")
    : (row.sourceFunction || t("anonymousCallback"));
  const sourceKindLabel = {
    python: t("sourceKindPython"),
    "clientside-registration": t("sourceKindClientsideRegistration"),
    clientside: t("sourceKindClientside"),
    unavailable: t("sourceKindUnavailable"),
  }[row.sourceKind] || row.sourceKind;
  const behaviorItems = [
    {
      label: t("detailInitialCall"),
      value: row.preventInitialCall ? t("prevented") : t("allowed"),
      active: row.preventInitialCall,
    },
    {
      label: t("detailOptional"),
      value: row.optional ? t("enabled") : t("disabled"),
      active: row.optional,
    },
    {
      label: t("detailBackground"),
      value: row.background ? t("enabled") : t("disabled"),
      active: row.background,
    },
    {
      label: t("detailDynamic"),
      value: row.dynamicCreator ? t("enabled") : t("disabled"),
      active: row.dynamicCreator,
    },
    {
      label: t("detailPersistent"),
      value: row.persistent ? t("enabled") : t("disabled"),
      active: row.persistent,
    },
    {
      label: t("detailWebsocket"),
      value: row.websocket ? t("enabled") : t("disabled"),
      active: row.websocket,
    },
    {
      label: t("detailNoOutput"),
      value: row.noOutput ? t("enabled") : t("disabled"),
      active: row.noOutput,
    },
    {
      label: t("detailMcp"),
      value: row.mcpEnabled ? t("enabled") : t("disabled"),
      active: row.mcpEnabled,
    },
    {
      label: t("detailRunning"),
      value: row.running ? t("configured") : t("notConfigured"),
      active: Boolean(row.running),
    },
  ];
  const roleCount = row.inputs.length + row.state.length + row.outputs.length;
  const runningEntries = Object.entries(row.running || {}).flatMap(([phase, values]) =>
    Object.entries(values || {}).map(([target, value]) => ({phase, target, value})),
  );

  return (
    <Modal
      className="ddp-callback-detail-modal"
      rootClassName="ddp-callback-detail-modal-root"
      open={open}
      onCancel={onClose}
      afterClose={onAfterClose}
      footer={null}
      centered
      width="min(1120px, calc(100vw - 32px))"
      zIndex={100010}
      destroyOnHidden
      title={(
        <div className="ddp-detail-modal-title">
          <span className="ddp-detail-title-mark" aria-hidden="true"><CodeOutlined /></span>
          <div>
            <span>{t("callbackDetails")}</span>
            <strong>{callbackName}()</strong>
          </div>
        </div>
      )}
    >
      <div className="ddp-detail-intro">
        <p>{t("callbackDetailsSubtitle")}</p>
        <div className="ddp-detail-tags">
          <Tag color={row.mode === "client" ? "purple" : "blue"} icon={<ApiOutlined />}>
            {t(row.mode)}
          </Tag>
          <Tag color={row.hidden ? "default" : "success"} icon={row.hidden ? <EyeInvisibleOutlined /> : <CheckCircleOutlined />}>
            {t(row.hidden ? "hidden" : "visible")}
          </Tag>
        </div>
      </div>

      <div className="ddp-detail-role-summary" aria-label={t("detailRoleSummary")}>
        <div className="is-input">
          <span aria-hidden="true"><ImportOutlined /></span>
          <div><small>{t("columnInputs")}</small><strong>{row.inputs.length}</strong></div>
        </div>
        <div className="is-state">
          <span aria-hidden="true"><DatabaseOutlined /></span>
          <div><small>{t("columnState")}</small><strong>{row.state.length}</strong></div>
        </div>
        <div className="is-output">
          <span aria-hidden="true"><ExportOutlined /></span>
          <div><small>{t("columnOutput")}</small><strong>{row.outputs.length}</strong></div>
        </div>
        <div className="is-total">
          <span aria-hidden="true"><NodeIndexOutlined /></span>
          <div><small>{t("detailTotalRoles")}</small><strong>{roleCount}</strong></div>
        </div>
      </div>

      <div className="ddp-detail-source-card">
        <span className="ddp-detail-source-icon" aria-hidden="true"><FileTextOutlined /></span>
        <div>
          <span>{t("detailSource")}</span>
          {row.sourcePath && row.sourceLine ? (
            <strong><code>{row.sourcePath}</code><b>:{row.sourceLine}</b></strong>
          ) : (
            <strong>{row.sourceKind === "clientside" ? t("clientsideSource") : t("sourceUnavailable")}</strong>
          )}
        </div>
        <div className="ddp-detail-source-actions">
          <code className="ddp-detail-function-name">{callbackName}()</code>
          {row.editorUris.length > 0 && (
            <EditorDropdown row={row} t={t} placement="bottomRight">
              <Button
                className="ddp-open-editor-button"
                size="small"
                icon={<ExportOutlined />}
              >
                {t("openInEditor")}<DownOutlined />
              </Button>
            </EditorDropdown>
          )}
        </div>
      </div>

      <section className="ddp-detail-section" aria-label={t("detailFlow")}>
        <div className="ddp-detail-section-heading">
          <div>
            <span>{t("detailTopology")}</span>
            <h3>{t("detailFlow")}</h3>
          </div>
          <span className="ddp-detail-section-hint"><InfoCircleOutlined />{t("detailTopologyHint")}</span>
        </div>
        <div className="ddp-detail-flow">
          <div className="ddp-detail-upstream">
            <DetailDependencyGroup kind="input" title={t("detailInputs")} items={row.inputs} empty={t("noInputs")} />
            <DetailDependencyGroup kind="state" title={t("detailState")} items={row.state} empty={t("noState")} />
          </div>
          <div className="ddp-detail-flow-link is-merge" aria-hidden="true">
            <i /><i /><b /><ArrowRightOutlined />
          </div>
          <div className="ddp-detail-callback-node">
            <span aria-hidden="true"><CodeOutlined /></span>
            <small>{t("detailCallbackNode")}</small>
            <strong title={callbackName}>{callbackName}</strong>
            <code>{row.mode === "client" ? "CLIENT" : "PYTHON"}</code>
          </div>
          <div className="ddp-detail-flow-link is-output" aria-hidden="true">
            <b /><ArrowRightOutlined />
          </div>
          {row.noOutput ? (
            <NoOutputTerminal t={t} />
          ) : (
            <DetailDependencyGroup kind="output" title={t("detailOutputs")} items={row.outputs} empty="—" />
          )}
        </div>
      </section>

      <section className="ddp-detail-section ddp-detail-behavior" aria-label={t("detailBehavior")}>
        <div className="ddp-detail-section-heading">
          <div>
            <span>{t("detailExecution")}</span>
            <h3>{t("detailBehavior")}</h3>
          </div>
        </div>
        <div className="ddp-detail-behavior-grid">
          {behaviorItems.map((item) => (
            <div className={item.active ? "is-active" : ""} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="ddp-detail-section" aria-label={t("detailRegistration")}>
        <div className="ddp-detail-section-heading">
          <div>
            <span>{t("detailMetadata")}</span>
            <h3>{t("detailRegistration")}</h3>
          </div>
        </div>
        <div className="ddp-detail-registration-grid">
          <div className="is-signature">
            <span>{t("detailOutputSignature")}</span>
            <code title={row.rawOutput}>{row.noOutput ? t("notApplicable") : (row.rawOutput || "—")}</code>
          </div>
          <div>
            <span>{t("detailSourceKind")}</span>
            <strong>{sourceKindLabel || t("sourceUnavailable")}</strong>
          </div>
          <div>
            <span>{t("detailVisibility")}</span>
            <strong>{t(row.hidden ? "hidden" : "visible")}</strong>
          </div>
          <div>
            <span>{t("detailRunningUpdates")}</span>
            <strong>{runningEntries.length}</strong>
          </div>
        </div>
        {row.clientsideFunction && (
          <div className="ddp-detail-clientside-meta">
            <div>
              <span>{t("detailClientsideNamespace")}</span>
              <code>{row.clientsideFunction.namespace || "—"}</code>
            </div>
            <div>
              <span>{t("detailClientsideFunction")}</span>
              <code>{row.clientsideFunction.function_name || "—"}</code>
            </div>
          </div>
        )}
        {runningEntries.length > 0 && (
          <div className="ddp-detail-running-list">
            {runningEntries.map((entry, index) => (
              <div key={`${entry.phase}-${entry.target}-${index}`}>
                <span>{entry.phase}</span>
                <code>{entry.target}</code>
                <ArrowRightOutlined aria-hidden="true" />
                <strong>{String(entry.value)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <CallbackPerformanceSection callbackId={row.callbackId} t={t} />
    </Modal>
  );
}

export default function CallbackPanel({endpoint, isActive, t, accentColor = "#119DFF"}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(() =>
    readCallbackPerformanceColumns(window.localStorage),
  );
  const [selectedCallback, setSelectedCallback] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const performanceSnapshot = useCallbackPerformanceSnapshot();
  const selectStyles = useMemo(
    () => ({popup: {root: {"--ddp-primary": accentColor}}}),
    [accentColor],
  );

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(endpointUrl(endpoint), {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setRows(normalizeCallbacks(await response.json()));
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Callback map request failed", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive && rows.length === 0 && !loading) load();
  }, [isActive]);

  useEffect(() => {
    if (!isActive) setDetailOpen(false);
  }, [isActive]);

  const openCallbackDetails = (row) => {
    setSelectedCallback(row);
    setDetailOpen(true);
  };

  const updatePerformanceMetricsVisibility = (visible) => {
    setShowPerformanceMetrics(visible);
    writeCallbackPerformanceColumns(window.localStorage, visible);
  };

  const rowsWithPerformance = useMemo(
    () => rows.map((row) => ({
      ...row,
      performance: performanceSnapshot.getCallback(row.callbackId),
    })),
    [rows, performanceSnapshot.revision],
  );
  const hasExecutionTimes = rowsWithPerformance.some(
    (row) => Number.isFinite(row.performance.lastExecutedAt),
  );
  const [relativeNow, setRelativeNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive || !hasExecutionTimes) return undefined;
    setRelativeNow(Date.now());
    const timer = window.setInterval(() => setRelativeNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive, hasExecutionTimes]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rowsWithPerformance.filter((row) => {
      const matchesMode = mode === "all" || row.mode === mode;
      const matchesVisibility =
        visibility === "all" ||
        (visibility === "hidden" ? row.hidden : !row.hidden);
      const haystack = `${row.outputText} ${row.inputText} ${row.stateText} ${row.sourceText} ${row.mode}`.toLowerCase();
      return matchesMode && matchesVisibility && (!needle || haystack.includes(needle));
    });
  }, [rowsWithPerformance, query, mode, visibility]);
  const visibleCountLabel = filteredRows.length === 1
    ? t("visibleCountOne")
    : t("visibleCount");

  const columns = [
    {
      title: t("columnMode"), dataIndex: "mode", key: "mode", width: 132,
      fixed: "left",
      className: "ddp-identity-cell is-mode",
      sorter: (left, right) => left.mode.localeCompare(right.mode),
      render: (value, row) => (
        <Space size={6}>
          <Tag color={value === "client" ? "purple" : "blue"} icon={<ApiOutlined />}>
            {t(value)}
          </Tag>
          {row.hidden && (
            <Tooltip title={t("hidden")}>
              <EyeInvisibleOutlined className="ddp-hidden-icon" aria-label={t("hidden")} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t("columnSource"), dataIndex: "sourceText", key: "source", width: 230,
      fixed: "left",
      className: "ddp-identity-cell is-source",
      render: (_value, row) => <SourceLocation row={row} t={t} />,
    },
    ...(showPerformanceMetrics ? [{
      title: t("columnLastExecution"),
      dataIndex: ["performance", "lastExecutedAt"],
      key: "last-execution",
      width: 194,
      className: "ddp-performance-column is-last-execution",
      sorter: (left, right) => comparePerformanceValues(
        left.performance.lastExecutedAt,
        right.performance.lastExecutedAt,
      ),
      sortDirections: ["descend", "ascend"],
      render: (_value, row) => (
        <LastExecutionCell
          connected={performanceSnapshot.connected}
          completedAt={row.performance.lastExecutedAt}
          executionCount={row.performance.executionCount}
          currentTime={relativeNow}
          t={t}
        />
      ),
    },
    {
      title: t("performanceExecutions"),
      dataIndex: ["performance", "executionCount"],
      key: "performance-executions",
      width: 110,
      align: "right",
      className: "ddp-performance-column",
      sorter: (left, right) => comparePerformanceValues(
        left.performance.executionCount,
        right.performance.executionCount,
      ),
      sortDirections: ["descend", "ascend"],
      render: (_value, row) => (
        <PerformanceMetricCell
          connected={performanceSnapshot.connected}
          metric="executionCount"
          performance={row.performance}
          t={t}
        />
      ),
    },
    {
      title: t("performanceAverage"),
      dataIndex: ["performance", "averageMs"],
      key: "performance-average",
      width: 118,
      align: "right",
      className: "ddp-performance-column",
      sorter: (left, right) => comparePerformanceValues(
        left.performance.averageMs,
        right.performance.averageMs,
      ),
      sortDirections: ["descend", "ascend"],
      render: (_value, row) => (
        <PerformanceMetricCell
          connected={performanceSnapshot.connected}
          metric="averageMs"
          performance={row.performance}
          t={t}
        />
      ),
    },
    {
      title: t("performanceLatest"),
      dataIndex: ["performance", "latestMs"],
      key: "performance-latest",
      width: 118,
      align: "right",
      className: "ddp-performance-column",
      sorter: (left, right) => comparePerformanceValues(
        left.performance.latestMs,
        right.performance.latestMs,
      ),
      sortDirections: ["descend", "ascend"],
      render: (_value, row) => (
        <PerformanceMetricCell
          connected={performanceSnapshot.connected}
          metric="latestMs"
          performance={row.performance}
          t={t}
        />
      ),
    }] : []),
    {
      title: t("columnOutput"), dataIndex: "outputs", key: "output", width: 218,
      render: (items, row) => row.noOutput ? (
        <NoOutputRole t={t} />
      ) : (
        <RoleCell kind="output" title={t("columnOutput")} items={items} empty="—" t={t} />
      ),
    },
    {
      title: t("columnInputs"), dataIndex: "inputs", key: "inputs", width: 218,
      render: (items) => (
        <RoleCell kind="input" title={t("columnInputs")} items={items} empty={t("noInputs")} t={t} />
      ),
    },
    {
      title: t("columnState"), dataIndex: "state", key: "state", width: 196,
      render: (items) => (
        <RoleCell kind="state" title={t("columnState")} items={items} empty={t("noState")} t={t} />
      ),
    },
    {
      title: t("columnDocstring"), dataIndex: "docstring", key: "docstring", width: 260,
      render: (value, row) => <DocstringCell docstring={value} mode={row.mode} t={t} />,
    },
    {
      title: t("columnActions"), key: "actions", width: 96, fixed: "right", align: "center",
      className: "ddp-action-cell",
      render: (_value, row) => (
        <Button
          className="ddp-detail-button"
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openCallbackDetails(row)}
          aria-label={`${t("viewDetails")} · ${row.sourceFunction || row.outputText}`}
        >
          {t("viewDetails")}
        </Button>
      ),
    },
  ];

  return (
    <section className="ddp-panel ddp-callback-panel" aria-label={t("callbacksTab")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon" aria-hidden="true">
            <ApartmentOutlined />
          </span>
          <div>
            <div className="ddp-eyebrow">{t("callbackEyebrow")}</div>
            <h2>{t("callbacksTab")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <div className="ddp-count-line" aria-label={`${rows.length} ${t("callbackCount")}`}>
            <span><strong>{rows.length}</strong> {t("callbackCount")}</span>
            <i />
            <span><strong>{filteredRows.length}</strong> {visibleCountLabel}</span>
          </div>
          <Tooltip title={t("refresh")}>
            <Button
              className="ddp-refresh-button"
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              aria-label={t("refresh")}
            />
          </Tooltip>
        </div>
      </div>

      <div className="ddp-commandbar">
        <span className="ddp-commandbar-icon" aria-hidden="true"><FilterOutlined /></span>
        <Input
          variant="borderless"
          aria-label={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Select
          classNames={SELECT_CLASS_NAMES}
          styles={selectStyles}
          variant="borderless"
          aria-label={t("allModes")}
          value={mode}
          onChange={setMode}
          options={[
            {value: "all", label: t("allModes")},
            {value: "server", label: t("server")},
            {value: "client", label: t("client")},
          ]}
        />
        <Select
          classNames={SELECT_CLASS_NAMES}
          styles={selectStyles}
          variant="borderless"
          aria-label={t("allVisibility")}
          value={visibility}
          onChange={setVisibility}
          options={[
            {value: "all", label: t("allVisibility")},
            {value: "visible", label: t("visible")},
            {value: "hidden", label: t("hidden")},
          ]}
        />
        <label
          className={`ddp-performance-columns-toggle ${showPerformanceMetrics ? "is-active" : ""}`}
          title={t("showPerformanceMetrics")}
        >
          <LineChartOutlined className="ddp-performance-columns-toggle-icon" aria-hidden="true" />
          <span>{t("columnPerformance")}</span>
          <Switch
            size="small"
            checked={showPerformanceMetrics}
            onChange={updatePerformanceMetricsVisibility}
            aria-label={t("showPerformanceMetrics")}
          />
        </label>
      </div>

      {error && (
        <Alert
          className="ddp-inline-alert"
          type="error"
          showIcon
          message={t("callbackError")}
          action={<Button size="small" onClick={load}>{t("refresh")}</Button>}
        />
      )}

      <div className="ddp-table-shell">
        <Table
          aria-label={t("callbacksTab")}
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          rowKey="key"
          size="small"
          tableLayout="fixed"
          scroll={{x: showPerformanceMetrics ? 1890 : 1350}}
          locale={{emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("emptyCallbacks")} />}}
          pagination={{
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            position: ["bottomRight"],
            showTotal: (total) => `${total} ${t(total === 1 ? "visibleCountOne" : "visibleCount")}`,
          }}
        />
      </div>
      <CallbackDetailModal
        row={selectedCallback}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAfterClose={() => setSelectedCallback(null)}
        t={t}
      />
    </section>
  );
}
