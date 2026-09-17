import React, {useEffect, useMemo, useState} from "react";
import {Alert, Button, Empty, Input, Select, Table, Tag, Tooltip} from "antd";
import {
  ApiOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  CodeOutlined,
  JavaScriptOutlined,
  ProductOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {endpointUrl} from "./utils";

const PAGE_SIZE = 12;
const SELECT_CLASS_NAMES = {popup: {root: "ddp-callback-select-popup"}};

const CATEGORY_META = {
  standard: {icon: <CodeOutlined />, color: "default", label: "dependencyCategoryStandard"},
  "dash-component": {icon: <AppstoreOutlined />, color: "blue", label: "dependencyCategoryComponent"},
  "dash-hook": {icon: <BranchesOutlined />, color: "purple", label: "dependencyCategoryHook"},
  other: {icon: <ApiOutlined />, color: "cyan", label: "dependencyCategoryOther"},
};

function CategoryTag({category, t}) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  return (
    <Tag className={`ddp-dependency-category is-${category}`} color={meta.color} icon={meta.icon}>
      {t(meta.label)}
    </Tag>
  );
}

function DependencyExpandIcon({expanded, expandable, onExpand, record, t}) {
  if (!expandable) return null;

  return (
    <button
      type="button"
      className={`ddp-dependency-expand-button ${expanded ? "is-expanded" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onExpand(record, event);
      }}
      aria-label={t(expanded ? "dependencyCollapseRow" : "dependencyExpandRow")}
      aria-expanded={expanded}
    >
      <RightOutlined />
    </button>
  );
}

function StatusTag({status, t}) {
  const colors = {
    registered: "processing",
    late: "warning",
    loaded: "cyan",
    discovered: "default",
  };
  return <Tag color={colors[status] || "default"}>{t(`hookStatus_${status}`)}</Tag>;
}

function ComponentDetails({component, t}) {
  return (
    <section className="ddp-dependency-detail-section">
      <div className="ddp-dependency-detail-heading">
        <span><AppstoreOutlined /></span>
        <div>
          <strong>{t("dependencyComponentDetails")}</strong>
          <small>{t("dependencyComponentDetailsHint")}</small>
        </div>
      </div>
      <div className="ddp-dependency-facts">
        <div><span>{t("dependencyModule")}</span><code>{component.module}</code></div>
        <div>
          <span>{t("dependencyScope")}</span>
          <Tag bordered={false} color={component.scope === "core" ? "blue" : "cyan"}>
            {t(component.scope === "core" ? "dashCore" : "thirdParty")}
          </Tag>
        </div>
        <div><span>{t("libraryExports")}</span><strong>{component.exports ?? "—"}</strong></div>
        <div><span>{t("libraryAssets")}</span><strong>{component.jsAssets ?? "—"}</strong></div>
      </div>
      <div className="ddp-dependency-alias-row">
        <span>{t("libraryAliases")}</span>
        {component.aliases?.length > 0
          ? component.aliases.map((alias) => <code key={alias}>{alias}</code>)
          : <em>{t("dependencyNoAliases")}</em>}
      </div>
    </section>
  );
}

function HookContributionTable({hook, t}) {
  const columns = [
    {
      title: t("hookColumnType"), dataIndex: "type", width: 140,
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
      dataSource={hook.contributions || []}
      rowKey="runtimeId"
      pagination={false}
      size="small"
      scroll={{x: 760}}
      locale={{emptyText: t("hookNoRegistrations")}}
    />
  );
}

function HookDetails({hook, t}) {
  return (
    <section className="ddp-dependency-detail-section">
      <div className="ddp-dependency-detail-heading">
        <span><BranchesOutlined /></span>
        <div>
          <strong>{t("dependencyHookDetails")}</strong>
          <small>{t("dependencyHookDetailsHint")}</small>
        </div>
        <div className="ddp-dependency-hook-tags">
          <StatusTag status={hook.status} t={t} />
          <Tag bordered={false}>{t(hook.source === "manual" ? "hookManual" : "hookAutoDiscovered")}</Tag>
          <Tag bordered={false}>{hook.registrationCount} {t("hookRegistrations")}</Tag>
        </div>
      </div>

      <div className="ddp-dependency-hook-grid">
        <div>
          <span>{t("dependencyEntryPoints")}</span>
          {hook.entryPoints?.length > 0 ? hook.entryPoints.map((entry) => (
            <code key={`${entry.name}:${entry.value}`}>{entry.name} → {entry.value}</code>
          )) : <em>{t("dependencyNoEntryPoints")}</em>}
        </div>
        <div>
          <span>{t("hookTypeCount")}</span>
          <div className="ddp-hook-types ddp-dependency-hook-types">
            {hook.hookTypes?.length > 0 ? hook.hookTypes.map((item) => (
              <span key={item.type}><code>{item.type}</code><b>{item.count}</b></span>
            )) : <em>{t("hookNoRegistrations")}</em>}
          </div>
        </div>
      </div>

      <div className="ddp-dependency-runtime-heading">{t("hookExecutionDetails")}</div>
      <HookContributionTable hook={hook} t={t} />
    </section>
  );
}

function ExpandedDependency({library, t}) {
  return (
    <div className="ddp-dependency-expanded">
      {library.component && <ComponentDetails component={library.component} t={t} />}
      {library.hook && <HookDetails hook={library.hook} t={t} />}
    </div>
  );
}

export default function DependenciesPanel({endpoint, isActive, t, accentColor = "#119DFF"}) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
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
      setInventory(await response.json());
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Dependency inventory request failed", loadError);
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
      if (category !== "all" && library.category !== category) return false;
      if (!needle) return true;
      const component = library.component;
      const hook = library.hook;
      const haystack = [
        library.name,
        library.version,
        ...library.modules,
        ...(component?.aliases || []),
        ...(hook?.entryPoints || []).flatMap((entry) => [entry.name, entry.value]),
        ...(hook?.hookTypes || []).map((item) => item.type),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [libraries, query, category]);

  const columns = [
    {
      title: t("dependencyColumnLibrary"), key: "library", width: 265,
      render: (_value, library) => (
        <div className="ddp-dependency-identity">
          <span className={`ddp-dependency-mark is-${library.category}`}>
            {CATEGORY_META[library.category]?.icon || <ApiOutlined />}
          </span>
          <div><strong>{library.name}</strong><code>{library.modules.join(", ")}</code></div>
        </div>
      ),
    },
    {
      title: t("dependencyColumnCategory"), dataIndex: "category", width: 150,
      render: (value) => <CategoryTag category={value} t={t} />,
    },
    {
      title: t("dependencyColumnVersion"), dataIndex: "version", width: 120,
      render: (value) => <code className="ddp-dependency-version">{value ? `v${value}` : "—"}</code>,
    },
    {
      title: t("dependencyColumnModules"), dataIndex: "modules",
      render: (modules) => (
        <div className="ddp-dependency-modules">
          {modules.slice(0, 3).map((module) => <code key={module}>{module}</code>)}
          {modules.length > 3 && <span>+{modules.length - 3}</span>}
        </div>
      ),
    },
    {
      title: t("dependencyColumnLoaded"), dataIndex: "moduleCount", width: 112, align: "right",
      render: (value) => <span className="ddp-dependency-loaded"><strong>{value}</strong> {t("dependencyModulesUnit")}</span>,
    },
  ];

  const summary = inventory?.summary || {};
  const categories = [
    ["standard", "standard"],
    ["dash-component", "dashComponents"],
    ["dash-hook", "dashHooks"],
    ["other", "other"],
  ];
  const runtimeUnavailable = inventory?.hookMeta?.completeness?.runtimeRegistry === "unavailable";

  return (
    <section className="ddp-panel ddp-dependencies-panel" aria-label={t("dependenciesTab")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon" aria-hidden="true"><ProductOutlined /></span>
          <div>
            <div className="ddp-eyebrow">{t("dependenciesEyebrow")}</div>
            <h2>{t("dependenciesTab")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <div className="ddp-count-line">
            <span><strong>{summary.total || 0}</strong> {t("dependencyCount")}</span>
            {(query || category !== "all") && <><i /><span><strong>{filteredLibraries.length}</strong> {t("visibleCount")}</span></>}
          </div>
          <Tooltip title={t("refresh")}>
            <Button className="ddp-refresh-button" icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label={t("refresh")} />
          </Tooltip>
        </div>
      </div>

      <div className="ddp-dependency-summary" aria-label={t("dependencyCategoryFilter")}>
        {categories.map(([value, countKey]) => {
          const meta = CATEGORY_META[value];
          return (
            <button
              key={value}
              type="button"
              className={category === value ? "is-active" : ""}
              onClick={() => setCategory(category === value ? "all" : value)}
            >
              <span>{meta.icon}</span>
              <div><small>{t(meta.label)}</small><strong>{summary[countKey] || 0}</strong></div>
            </button>
          );
        })}
      </div>

      <div className="ddp-dependency-toolbar">
        <Input
          aria-label={t("dependencySearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("dependencySearchPlaceholder")}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Select
          classNames={SELECT_CLASS_NAMES}
          styles={selectStyles}
          aria-label={t("dependencyCategoryFilter")}
          value={category}
          onChange={setCategory}
          options={[
            {value: "all", label: t("dependencyAllCategories")},
            ...categories.map(([value]) => ({value, label: t(CATEGORY_META[value].label)})),
          ]}
        />
      </div>

      {inventory?.hookMeta?.orderWarnings?.length > 0 && (
        <div className="ddp-hook-order-note ddp-dependency-order-note">
          <WarningOutlined />
          <span>{t("hookOrderWarning")}</span>
          <div>{inventory.hookMeta.orderWarnings.map((type) => <code key={type}>{type}</code>)}</div>
        </div>
      )}
      {runtimeUnavailable && <Alert className="ddp-inline-alert" type="warning" showIcon message={t("hookRuntimeUnavailable")} />}
      {error && <Alert className="ddp-inline-alert" type="error" showIcon message={t("dependencyError")} action={<Button size="small" onClick={load}>{t("refresh")}</Button>} />}

      <div className="ddp-dependency-table-wrap">
        <Table
          className="ddp-dependency-table"
          columns={columns}
          dataSource={filteredLibraries}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{x: 900}}
          expandable={{
            expandedRowRender: (library) => <ExpandedDependency library={library} t={t} />,
            rowExpandable: (library) => Boolean(library.component || library.hook),
            expandIcon: (props) => <DependencyExpandIcon {...props} t={t} />,
            columnWidth: 44,
          }}
          pagination={{
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            hideOnSinglePage: filteredLibraries.length <= PAGE_SIZE,
            showTotal: (total) => `${total} ${t("dependencyCount")}`,
          }}
          locale={{emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("dependencyEmpty")} />}}
        />
      </div>
    </section>
  );
}
