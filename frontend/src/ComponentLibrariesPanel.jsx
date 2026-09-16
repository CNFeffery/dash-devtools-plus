import React, {useEffect, useMemo, useState} from "react";
import {Alert, Button, Card, Empty, Input, Spin, Tag, Tooltip} from "antd";
import {
  AppstoreOutlined,
  CodeOutlined,
  JavaScriptOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {endpointUrl} from "./utils";

function LibraryCard({library, t}) {
  return (
    <Card className="ddp-library-card" size="small">
      <div className="ddp-library-card-topline">
        <span className="ddp-library-mark" aria-hidden="true">
          <AppstoreOutlined />
        </span>
        <Tag className="ddp-version-tag" bordered={false}>
          {library.version ? `v${library.version}` : t("unknownVersion")}
        </Tag>
      </div>

      <div className="ddp-library-identity">
        <h3 title={library.name}>{library.name}</h3>
        <code title={library.module}>{library.module}</code>
        {library.aliases?.length > 0 && (
          <div className="ddp-library-aliases">
            <span>{t("libraryAliases")}</span>
            {library.aliases.map((alias) => <code key={alias}>{alias}</code>)}
          </div>
        )}
      </div>

      <div className="ddp-library-card-footer">
        <Tag bordered={false} color={library.scope === "core" ? "blue" : "cyan"}>
          {t(library.scope === "core" ? "dashCore" : "thirdParty")}
        </Tag>
        <div className="ddp-library-metrics">
          <Tooltip title={t("libraryExports")}>
            <span><CodeOutlined /> {library.exports ?? "—"}</span>
          </Tooltip>
          <Tooltip title={t("libraryAssets")}>
            <span><JavaScriptOutlined /> {library.jsAssets ?? "—"}</span>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

export default function ComponentLibrariesPanel({endpoint, isActive, t}) {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(endpointUrl(endpoint), {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setLibraries(await response.json());
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Component library request failed", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive && libraries.length === 0 && !loading) load();
  }, [isActive]);

  const filteredLibraries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return libraries;
    return libraries.filter((library) =>
      `${library.name} ${library.module} ${library.version || ""} ${(library.aliases || []).join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [libraries, query]);

  return (
    <section className="ddp-panel ddp-libraries-panel" aria-label={t("componentLibrariesTab")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon" aria-hidden="true">
            <AppstoreOutlined />
          </span>
          <div>
            <div className="ddp-eyebrow">{t("componentLibrariesEyebrow")}</div>
            <h2>{t("componentLibrariesTab")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <div className="ddp-count-line">
            <span><strong>{libraries.length}</strong> {t("libraryCount")}</span>
            {query && (
              <>
                <i />
                <span><strong>{filteredLibraries.length}</strong> {t("visibleCount")}</span>
              </>
            )}
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

      <div className="ddp-library-toolbar">
        <Input
          aria-label={t("librarySearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("librarySearchPlaceholder")}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>

      {error && (
        <Alert
          className="ddp-inline-alert"
          type="error"
          showIcon
          message={t("libraryError")}
          action={<Button size="small" onClick={load}>{t("refresh")}</Button>}
        />
      )}

      <div className="ddp-library-scroll">
        <Spin spinning={loading}>
          {filteredLibraries.length > 0 ? (
            <div className="ddp-library-grid">
              {filteredLibraries.map((library) => (
                <LibraryCard key={library.module} library={library} t={t} />
              ))}
            </div>
          ) : (
            <div className="ddp-library-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("libraryEmpty")} />
            </div>
          )}
        </Spin>
      </div>
    </section>
  );
}
