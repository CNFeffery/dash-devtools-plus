import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Chart} from "@antv/g2";
import {Alert, Button, Progress, Skeleton, Tag, Tooltip} from "antd";
import {
  CloudServerOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  HddOutlined,
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {endpointUrl} from "./utils";
import {createLiveLegendChart, seriesGradient} from "./liveLegendChart";

const SAMPLE_INTERVAL = 2000;
const MAX_SAMPLES = 120;
const METRIC_SERIES = ["cpu", "memory"];
const METRIC_GRADIENTS = {
  cpu: "l(270) 0:#e7f9f8 1:#48b8b8",
  memory: "l(270) 0:#e9f7ed 1:#82c994",
};

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Math.max(0, value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = size >= 100 || unit === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unit]}`;
}

function formatDuration(seconds, t) {
  if (!Number.isFinite(seconds)) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}${t("durationDays")} ${hours}${t("durationHours")}`;
  if (hours) return `${hours}${t("durationHours")} ${minutes}${t("durationMinutes")}`;
  return `${minutes}${t("durationMinutes")}`;
}

function MetricCard({icon, label, value, percent, detail, color, className = ""}) {
  return (
    <article className={`ddp-metric-card ${className}`}>
      <div className="ddp-metric-card-heading">
        <span className="ddp-metric-icon" style={{"--ddp-metric-color": color}}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="ddp-metric-value">{value}</div>
      <Progress
        percent={clampPercent(percent)}
        showInfo={false}
        strokeColor={color}
        trailColor="#edf2f5"
        size={["100%", 6]}
      />
      <div className="ddp-metric-detail">{detail}</div>
    </article>
  );
}

function TrendChart({history, t}) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const selectedMetricsRef = useRef(null);

  const chartData = useMemo(() => history.flatMap((sample) => [
    {time: sample.time, value: sample.cpu, metric: "cpu"},
    {time: sample.time, value: sample.memory, metric: "memory"},
  ]), [history]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = new Chart({container: containerRef.current, autoFit: true, height: 248});
    chart.options({
      type: "view",
      data: chartData,
      paddingLeft: 54,
      paddingRight: 24,
      paddingTop: 22,
      paddingBottom: 38,
      scale: {
        y: {domain: [0, 100], tickCount: 5},
        color: {
          domain: ["cpu", "memory"],
          range: ["#36a3a3", "#78b884"],
        },
      },
      axis: {
        x: {title: false, labelAutoHide: true, tick: false},
        y: {title: false, labelFormatter: (value) => `${value}%`, grid: true},
      },
      legend: {color: {
        position: "top",
        layout: {justifyContent: "flex-end"},
        labelFormatter: (metric) => metric === "cpu" ? t("cpuUsage") : t("memoryUsage"),
        defaultSelect: selectedMetricsRef.current ?? undefined,
      }},
      interaction: {tooltip: {shared: true}, legendFilter: true},
      children: [
        {
          type: "area",
          encode: {x: "time", y: "value", color: "metric", shape: "smooth"},
          style: {
            fill: (datum) => seriesGradient(datum, "metric", METRIC_GRADIENTS),
            fillOpacity: 0.72,
          },
          animate: false,
        },
        {
          type: "line",
          encode: {x: "time", y: "value", color: "metric", shape: "smooth"},
          style: {lineWidth: 2.4},
          animate: false,
        },
      ],
    });
    const controller = createLiveLegendChart(chart, METRIC_SERIES, chartData, selectedMetricsRef);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [t]);

  useEffect(() => {
    controllerRef.current?.update(chartData).catch((error) => {
      console.warn("[dash-devtools-plus] Metrics chart render failed", error);
    });
  }, [chartData, t]);

  return <div ref={containerRef} className="ddp-resource-chart" aria-label={t("resourceTrendChart")} />;
}

function InfoRow({label, value, mono = false}) {
  return (
    <div className="ddp-device-info-row">
      <span>{label}</span>
      <strong className={mono ? "is-mono" : ""} title={String(value)}>{value ?? "—"}</strong>
    </div>
  );
}

export function useServerMetrics(endpoint) {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadingRef = useRef(false);
  const metricsRef = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!metricsRef.current) setLoading(true);
    if (mountedRef.current) setError(false);
    try {
      const response = await fetch(endpointUrl(endpoint), {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = await response.json();
      if (!mountedRef.current) return;
      metricsRef.current = next;
      setMetrics(next);
      setHistory((current) => {
        const date = new Date(next.timestamp);
        const sample = {
          timestamp: next.timestamp,
          time: date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"}),
          cpu: clampPercent(next.cpu?.percent),
          memory: clampPercent(next.memory?.percent),
        };
        return [...current, sample].slice(-MAX_SAMPLES);
      });
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Server metrics request failed", loadError);
      if (mountedRef.current) setError(true);
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const timer = window.setInterval(load, SAMPLE_INTERVAL);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  return {metrics, history, loading, error, load};
}

export default function ServerMetricsPanel({monitor, t}) {
  const {metrics, history, loading, error, load} = monitor;

  const updatedAt = useMemo(() => {
    if (!metrics?.timestamp) return "--:--:--";
    return new Date(metrics.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [metrics?.timestamp]);

  const cpu = metrics?.cpu || {};
  const memory = metrics?.memory || {};
  const disk = metrics?.disk || {};
  const system = metrics?.system || {};

  return (
    <section className="ddp-panel ddp-server-panel" aria-label={t("serverMetricsTab")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon ddp-resource-workspace-icon" aria-hidden="true"><DashboardOutlined /></span>
          <div>
            <div className="ddp-eyebrow">{t("serverMetricsEyebrow")}</div>
            <h2>{t("serverMetricsTab")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <Tag className="ddp-live-tag" icon={<SyncOutlined spin />} bordered={false}>{t("liveSampling")}</Tag>
          <div className="ddp-last-updated" title={`${t("lastUpdated")} ${updatedAt}`}>
            <ClockCircleOutlined aria-hidden="true" />
            <span>{t("lastUpdated")}</span>
            <time dateTime={metrics?.timestamp ? new Date(metrics.timestamp).toISOString() : undefined}>
              {updatedAt}
            </time>
          </div>
          <Tooltip title={t("refresh")}>
            <Button className="ddp-refresh-button" icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label={t("refresh")} />
          </Tooltip>
        </div>
      </div>

      {error && <Alert className="ddp-inline-alert" type="error" showIcon message={t("serverMetricsError")} action={<Button size="small" onClick={load}>{t("refresh")}</Button>} />}

      {!metrics && loading ? (
        <div className="ddp-resource-loading"><Skeleton active paragraph={{rows: 9}} /></div>
      ) : (
        <div className="ddp-resource-scroll">
          <div className="ddp-metric-grid">
            <MetricCard
              icon={<ThunderboltOutlined />}
              label={t("cpuUsage")}
              value={`${clampPercent(cpu.percent).toFixed(1)}%`}
              percent={cpu.percent}
              detail={`${cpu.logicalCores ?? "—"} ${t("logicalCores")} · ${cpu.frequencyMhz ? `${Math.round(cpu.frequencyMhz)} MHz` : t("frequencyUnavailable")}`}
              color="#36a3a3"
            />
            <MetricCard
              icon={<DatabaseOutlined />}
              label={t("memoryUsage")}
              value={`${clampPercent(memory.percent).toFixed(1)}%`}
              percent={memory.percent}
              detail={`${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`}
              color="#78b884"
            />
            <MetricCard
              icon={<HddOutlined />}
              label={t("diskUsage")}
              value={`${clampPercent(disk.percent).toFixed(1)}%`}
              percent={disk.percent}
              detail={`${formatBytes(disk.freeBytes)} ${t("available")}`}
              color="#78a8d8"
            />
          </div>

          <div className="ddp-resource-main-grid">
            <article className="ddp-resource-card ddp-trend-card">
              <div className="ddp-resource-card-heading">
                <div><span>{t("liveTrend")}</span><h3>{t("resourceTrend")}</h3></div>
                <small className="ddp-chart-sample-count">{history.length} {t("samples")}</small>
              </div>
              <TrendChart history={history} t={t} />
            </article>

            <article className="ddp-resource-card ddp-device-card">
              <div className="ddp-resource-card-heading">
                <div><span>{t("deviceProfile")}</span><h3>{t("hardwareInfo")}</h3></div>
                <CloudServerOutlined />
              </div>
              <div className="ddp-device-info">
                <InfoRow label={t("hostname")} value={system.hostname} mono />
                <InfoRow label={t("operatingSystem")} value={[system.operatingSystem, system.osRelease].filter(Boolean).join(" ")} />
                <InfoRow label={t("architecture")} value={system.architecture} mono />
                <InfoRow label={t("processor")} value={system.processor} />
                <InfoRow label={t("cpuCores")} value={`${cpu.physicalCores ?? "—"} / ${cpu.logicalCores ?? "—"}`} mono />
                <InfoRow label={t("pythonVersion")} value={system.pythonVersion} mono />
                <InfoRow label={t("uptime")} value={formatDuration(system.uptimeSeconds, t)} />
              </div>
            </article>
          </div>

        </div>
      )}
    </section>
  );
}
