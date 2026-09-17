import React, {useEffect, useMemo, useState} from "react";
import {Alert, Button, Collapse, Empty, Input, Select, Spin, Table, Tag, Tooltip} from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {endpointUrl} from "./utils";

const SELECT_CLASS_NAMES = {popup: {root: "ddp-select-popup"}};

function StatusTag({status, t}) {
  const colors = {
    registered: "processing",
    late: "warning",
    loaded: "cyan",
    discovered: "default",
  };
  return <Tag color={colors[status]}>{t(`hookStatus_${status}`)}</Tag>;
}

function HookTypeList({types, t}) {
  if (!types.length) return <span className="ddp-hook-no-registration">{t("hookNoRegistrations")}</span>;
  return (
    <div className="ddp-hook-types">
      {types.map((item) => (
        <span key={item.type}>
          <code>{item.type}</code>
          <b>{item.count}</b>
        </span>
      ))}
    </div>
  );
}

function HookDetails({library, t}) {
  const columns = [
    {
      title: t("hookColumnType"), dataIndex: "type", width: 150,
      render: (value) => <code className="ddp-hook-type-code">{value}</code>,
    },
    {
      title: t("hookColumnOrder"), dataIndex: "position", width: 82,
      render: (value, row) => row.ordered ? `#${value}` : t("registrationOrder"),
    },
    {
      title: t("hookColumnPriority"), dataIndex: "priority", width: 90,
      render: (value, row) => {
        if (row.final) return <Tag color="gold">{t("hookPriorityFinal")}</Tag>;
        if (row.callable === "capture_app_hook_snapshot") {
          return <Tag bordered={false}>{t("hookPriorityFirst")}</Tag>;
        }
        return value ?? "—";
      },
    },
    {
      title: t("hookColumnCallable"), key: "callable",
      render: (_value, row) => row.module ? (
        <div className="ddp-hook-callable">
          <code>{row.callable || row.namespace || "—"}</code>
          <span>{row.module}</span>
        </div>
      ) : <span className="ddp-muted">{row.namespace || t("hookCallableUnavailable")}</span>,
    },
    {
      title: t("hookColumnPhase"), dataIndex: "phase", width: 112,
      render: (value) => (
        <Tag color={value === "late" ? "warning" : "blue"}>
          {t(value === "late" ? "hookPhaseLate" : "hookPhaseSnapshot")}
        </Tag>
      ),
    },
  ];

  return (
    <Table
      className="ddp-hook-detail-table"
      columns={columns}
      dataSource={library.contributions}
      rowKey="runtimeId"
      pagination={false}
      size="small"
      scroll={{x: 760}}
      locale={{emptyText: t("hookNoRegistrations")}}
    />
  );
}

function HookLibraryCard({library, t}) {
  return (
    <article className="ddp-hook-library-card">
      <div className="ddp-hook-library-main">
        <span className="ddp-hook-library-mark" aria-hidden="true"><ApiOutlined /></span>
        <div className="ddp-hook-library-identity">
          <div className="ddp-hook-library-title">
            <h3>{library.name}</h3>
            <Tag className="ddp-version-tag" bordered={false}>
              {library.version ? `v${library.version}` : t("unknownVersion")}
            </Tag>
            <StatusTag status={library.status} t={t} />
            <Tag bordered={false}>{t(library.source === "manual" ? "hookManual" : "hookAutoDiscovered")}</Tag>
          </div>
          {library.entryPoints.length > 0 ? (
            <div className="ddp-hook-entrypoints">
              {library.entryPoints.map((entry) => (
                <div key={`${entry.name}:${entry.value}`}>
                  <span>{entry.name}</span><i>→</i><code>{entry.value}</code>
                </div>
              ))}
            </div>
          ) : (
            <code className="ddp-hook-module">{library.modules.join(", ")}</code>
          )}
        </div>
        <div className="ddp-hook-library-total">
          <strong>{library.registrationCount}</strong>
          <span>{t("hookRegistrations")}</span>
        </div>
      </div>

      <HookTypeList types={library.hookTypes} t={t} />

      {library.contributions.length > 0 && (
        <Collapse
          className="ddp-hook-collapse"
          ghost
          size="small"
          items={[{
            key: "details",
            label: t("hookExecutionDetails"),
            children: <HookDetails library={library} t={t} />,
          }]}
        />
      )}
    </article>
  );
}

export default function HookLibrariesPanel({endpoint, isActive, t}) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(endpointUrl(endpoint), {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setInventory(await response.json());
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Hook library request failed", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive && !inventory && !loading) load();
  }, [isActive]);

  const libraries = inventory?.libraries || [];
  const filteredLibraries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return libraries.filter((library) => {
      if (source !== "all" && library.source !== source) return false;
      const haystack = [
        library.name,
        library.version,
        ...library.modules,
        ...library.entryPoints.flatMap((entry) => [entry.name, entry.value]),
        ...library.hookTypes.map((item) => item.type),
        ...library.contributions.flatMap((item) => [item.module, item.callable, item.namespace]),
      ].filter(Boolean).join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [libraries, query, source]);

  const summary = inventory?.summary || {};
  const runtimeUnavailable = inventory?.completeness?.runtimeRegistry === "unavailable";

  return (
    <section className="ddp-panel ddp-hooks-panel" aria-label={t("hookLibrariesTab")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon" aria-hidden="true"><BranchesOutlined /></span>
          <div>
            <div className="ddp-eyebrow">{t("hookLibrariesEyebrow")}</div>
            <h2>{t("hookLibrariesTab")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <div className="ddp-count-line">
            <span><strong>{summary.libraries || 0}</strong> {t("hookLibraryCount")}</span>
            <i />
            <span><strong>{summary.registrations || 0}</strong> {t("hookRegistrations")}</span>
          </div>
          <Tooltip title={t("refresh")}>
            <Button className="ddp-refresh-button" icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label={t("refresh")} />
          </Tooltip>
        </div>
      </div>

      <div className="ddp-hook-summary-strip">
        <div><BranchesOutlined /><span>{t("hookTypeCount")}</span><strong>{summary.hookTypes || 0}</strong></div>
        <div><ClockCircleOutlined /><span>{t("hookLateCount")}</span><strong>{summary.late || 0}</strong></div>
        <div><WarningOutlined /><span>{t("hookUnassignedCount")}</span><strong>{summary.unassigned || 0}</strong></div>
        <span className="ddp-hook-dash-version">Dash {inventory?.dashVersion || "—"}</span>
      </div>

      <div className="ddp-hook-toolbar">
        <Input
          aria-label={t("hookSearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("hookSearchPlaceholder")}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Select
          classNames={SELECT_CLASS_NAMES}
          aria-label={t("hookSourceFilter")}
          value={source}
          onChange={setSource}
          options={[
            {value: "all", label: t("hookAllSources")},
            {value: "entry-point", label: t("hookAutoDiscovered")},
            {value: "manual", label: t("hookManual")},
          ]}
        />
      </div>

      {inventory?.orderWarnings?.length > 0 && (
        <div className="ddp-hook-order-note">
          <WarningOutlined />
          <span>{t("hookOrderWarning")}</span>
          <div>{inventory.orderWarnings.map((type) => <code key={type}>{type}</code>)}</div>
        </div>
      )}
      {runtimeUnavailable && <Alert type="warning" showIcon message={t("hookRuntimeUnavailable")} />}
      {error && <Alert className="ddp-inline-alert" type="error" showIcon message={t("hookError")} action={<Button size="small" onClick={load}>{t("refresh")}</Button>} />}

      <div className="ddp-hook-scroll">
        <Spin spinning={loading}>
          {filteredLibraries.length > 0 ? (
            <div className="ddp-hook-list">
              {filteredLibraries.map((library) => <HookLibraryCard key={library.id} library={library} t={t} />)}
            </div>
          ) : (
            <div className="ddp-library-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("hookEmpty")} /></div>
          )}
        </Spin>
      </div>
    </section>
  );
}
