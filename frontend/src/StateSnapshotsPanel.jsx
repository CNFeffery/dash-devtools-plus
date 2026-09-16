import React, {useEffect, useMemo, useState} from "react";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Popconfirm,
  Progress,
  Table,
  Tag,
  Tree,
  Tooltip,
} from "antd";
import {
  CameraOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  createStateSnapshot,
  filterSnapshotComponents,
  formatBytes,
  loadStoredSnapshots,
  restoreStateSnapshot,
  scanDashComponents,
  storeSnapshots,
} from "./stateSnapshots";

function formatTime(timestamp, locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function componentTitle(component, t) {
  return (
    <span className="ddp-snapshot-tree-leaf">
      <span className="ddp-snapshot-type">{component.type}</span>
      <code>{component.idText || t("noComponentId")}</code>
      <small>{component.propCount} {t("propsUnit")}</small>
    </span>
  );
}

function buildTree(components, query, onlyWithId, t) {
  const groups = new Map();
  filterSnapshotComponents(components, query, onlyWithId).forEach((component) => {
    if (!groups.has(component.namespace)) groups.set(component.namespace, []);
    groups.get(component.namespace).push(component);
  });
  return [...groups.entries()].map(([namespace, items]) => ({
    key: `library:${namespace}`,
    title: (
      <span className="ddp-snapshot-tree-group">
        <FolderOpenOutlined />
        <strong>{namespace}</strong>
        <Tag bordered={false}>{items.length}</Tag>
      </span>
    ),
    children: items.map((component) => ({
      key: component.key,
      title: componentTitle(component, t),
      isLeaf: true,
    })),
  }));
}

function EmptySnapshots({t}) {
  return (
    <div className="ddp-snapshot-empty">
      <div className="ddp-snapshot-empty-icon"><CameraOutlined /></div>
      <div>
        <h3>{t("noSnapshotsTitle")}</h3>
        <p>{t("noSnapshotsDescription")}</p>
      </div>
    </div>
  );
}

export default function StateSnapshotsPanel({locale, t}) {
  const [api, contextHolder] = message.useMessage();
  const [snapshots, setSnapshots] = useState(loadStoredSnapshots);
  const [mode, setMode] = useState("list");
  const [components, setComponents] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [query, setQuery] = useState("");
  const [onlyWithId, setOnlyWithId] = useState(true);
  const [name, setName] = useState("");
  const [scanError, setScanError] = useState(false);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState(null);

  useEffect(() => {
    if (!storeSnapshots(snapshots)) api.warning(t("snapshotStorageWarning"));
  }, [api, snapshots, t]);

  const treeData = useMemo(
    () => buildTree(components, query, onlyWithId, t),
    [components, onlyWithId, query, t],
  );
  const visibleComponentKeys = useMemo(() => new Set(
    treeData.flatMap((group) => group.children.map((item) => item.key)),
  ), [treeData]);
  const selected = useMemo(() => {
    const checked = new Set(checkedKeys);
    return components.filter((component) => checked.has(component.key));
  }, [checkedKeys, components]);
  const selectedPropCount = selected.reduce((total, item) => total + item.propCount, 0);
  const selectionPercent = components.length ? Math.round(selected.length / components.length * 100) : 0;

  const scan = () => {
    try {
      const next = scanDashComponents();
      setComponents(next);
      setCheckedKeys(next.map((item) => item.key));
      setScanError(false);
      setQuery("");
      setName(t("snapshotDefaultName").replace("{time}", formatTime(Date.now(), locale)));
      return next;
    } catch {
      setComponents([]);
      setCheckedKeys([]);
      setScanError(true);
      return [];
    }
  };

  const beginCapture = () => {
    setOnlyWithId(true);
    scan();
    setMode("capture");
  };

  const updateCheckedKeys = (nextKeys) => {
    const visibleChecked = (Array.isArray(nextKeys) ? nextKeys : nextKeys.checked)
      .filter((key) => visibleComponentKeys.has(key));
    setCheckedKeys((current) => [
      ...current.filter((key) => !visibleComponentKeys.has(key)),
      ...visibleChecked,
    ]);
  };

  const save = () => {
    if (!selected.length) {
      api.warning(t("selectAtLeastOneComponent"));
      return;
    }
    try {
      const snapshot = createStateSnapshot(name || t("unnamedSnapshot"), selected.map((item) => item.key));
      if (!snapshot.components.length) {
        api.warning(t("selectedComponentsMissing"));
        return;
      }
      setSnapshots((current) => [snapshot, ...current].slice(0, 12));
      setMode("list");
      api.success(t("snapshotSaved"));
    } catch {
      api.error(t("snapshotSaveFailed"));
    }
  };

  const restore = (snapshot) => {
    try {
      const result = restoreStateSnapshot(snapshot);
      if (result.failed) {
        api.warning(t("snapshotRestoredPartial")
          .replace("{restored}", result.restored)
          .replace("{skipped}", result.skipped + result.failed));
      } else if (result.skipped) {
        api.warning(t("snapshotRestoredPartial")
          .replace("{restored}", result.restored)
          .replace("{skipped}", result.skipped));
      } else if (!result.restored) {
        api.info(t("snapshotAlreadyCurrent"));
      } else {
        api.success(t("snapshotRestored").replace("{count}", result.restored));
      }
    } catch {
      api.error(t("snapshotRestoreFailed"));
    }
  };

  const columns = [
    {
      title: t("snapshotName"),
      dataIndex: "name",
      render: (value, snapshot) => (
        <div className="ddp-snapshot-name-cell">
          <span><CameraOutlined /></span>
          <div><strong>{value}</strong><small>{snapshot.route}</small></div>
        </div>
      ),
    },
    {
      title: t("snapshotCreatedAt"),
      dataIndex: "createdAt",
      width: 150,
      render: (value) => <span className="ddp-snapshot-time"><ClockCircleOutlined />{formatTime(value, locale)}</span>,
    },
    {
      title: t("snapshotContents"),
      key: "contents",
      width: 210,
      render: (_, snapshot) => (
        <div className="ddp-snapshot-counts">
          <strong>{snapshot.components.length}</strong><span>{t("componentsUnit")}</span>
          <i />
          <strong>{snapshot.propCount}</strong><span>{t("propsUnit")}</span>
          <Tag bordered={false}>{formatBytes(snapshot.sizeBytes || 0)}</Tag>
        </div>
      ),
    },
    {
      title: t("columnActions"),
      key: "actions",
      width: 158,
      align: "right",
      render: (_, snapshot) => (
        <div className="ddp-snapshot-actions">
          <Popconfirm
            title={t("restoreSnapshotConfirm")}
            description={t("restoreSnapshotHint")}
            okText={t("restore")}
            cancelText={t("cancel")}
            onConfirm={() => restore(snapshot)}
          >
            <Button size="small" type="primary" ghost icon={<UndoOutlined />}>{t("restore")}</Button>
          </Popconfirm>
          <Popconfirm
            title={t("deleteSnapshotConfirm")}
            description={t("deleteSnapshotHint")}
            okText={t("delete")}
            cancelText={t("cancel")}
            okButtonProps={{danger: true}}
            onOpenChange={(open) => setDeletingSnapshotId(open ? snapshot.id : null)}
            onConfirm={() => {
              setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
              setDeletingSnapshotId(null);
            }}
            onCancel={() => setDeletingSnapshotId(null)}
          >
            <Tooltip
              title={t("deleteSnapshot")}
              open={deletingSnapshotId === snapshot.id ? false : undefined}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("deleteSnapshot")}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <section className="ddp-panel ddp-snapshots-panel" aria-label={t("stateSnapshotsTitle")}>
      {contextHolder}
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon ddp-snapshot-workspace-icon"><CameraOutlined /></span>
          <div><div className="ddp-eyebrow">{t("stateSnapshotsEyebrow")}</div><h2>{t("stateSnapshotsTitle")}</h2></div>
        </div>
        {mode === "list" && (
          <Button type="primary" icon={<CameraOutlined />} onClick={beginCapture}>{t("createSnapshot")}</Button>
        )}
      </div>

      {mode === "capture" ? (
        <div className="ddp-snapshot-capture">
          <div className="ddp-snapshot-capture-hero">
            <div>
              <span><DatabaseOutlined /></span>
              <div><small>{t("captureScopeEyebrow")}</small><h3>{t("selectSnapshotComponents")}</h3><p>{t("selectSnapshotComponentsHint")}</p></div>
            </div>
            <Tooltip title={t("rescanComponents")}>
              <Button icon={<ReloadOutlined />} onClick={scan} aria-label={t("rescanComponents")} />
            </Tooltip>
          </div>

          {scanError ? (
            <Empty description={t("snapshotScanFailed")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              <div className="ddp-snapshot-selection-summary">
                <div className="ddp-snapshot-progress">
                  <Progress
                    type="circle"
                    size={52}
                    percent={selectionPercent}
                    strokeWidth={9}
                    strokeColor="var(--ddp-primary)"
                    trailColor="#e8eff3"
                    format={() => selected.length}
                  />
                  <div><strong>{selected.length} / {components.length}</strong><span>{t("componentsSelected")}</span></div>
                </div>
                <div className="ddp-snapshot-summary-stat"><CheckCircleFilled /><span>{selectedPropCount}</span><small>{t("propsReady")}</small></div>
                <div className="ddp-snapshot-session-note"><ClockCircleOutlined /><span>{t("sessionStorageHint")}</span></div>
              </div>

              <div className="ddp-snapshot-filters">
                <Input
                  className="ddp-snapshot-search"
                  prefix={<SearchOutlined />}
                  allowClear
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("searchComponentsForSnapshot")}
                />
                <Checkbox
                  checked={onlyWithId}
                  onChange={(event) => setOnlyWithId(event.target.checked)}
                >
                  {t("onlyComponentsWithId")}
                </Checkbox>
              </div>
              <div className="ddp-snapshot-tree-shell">
                <Tree
                  blockNode
                  checkable
                  selectable={false}
                  virtual
                  height={350}
                  checkedKeys={checkedKeys}
                  defaultExpandAll
                  treeData={treeData}
                  onCheck={updateCheckedKeys}
                />
              </div>
              <div className="ddp-snapshot-capture-footer">
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("snapshotNamePlaceholder")}
                />
                <Button onClick={() => setMode("list")}>{t("cancel")}</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={save}>{t("saveSnapshot")}</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ddp-snapshot-list">
          <div className="ddp-snapshot-list-intro">
            <div><DatabaseOutlined /><span>{t("snapshotListHint")}</span></div>
            <Tag bordered={false}>{snapshots.length} {t("snapshotsUnit")}</Tag>
          </div>
          {snapshots.length ? (
            <Table
              className="ddp-snapshot-table"
              size="small"
              rowKey="id"
              columns={columns}
              dataSource={snapshots}
              pagination={{pageSize: 7, hideOnSinglePage: true, showSizeChanger: false}}
              scroll={{x: 760}}
            />
          ) : <EmptySnapshots t={t} />}
        </div>
      )}
    </section>
  );
}
