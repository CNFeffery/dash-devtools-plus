import React, {useEffect, useMemo, useState} from "react";
import {Breadcrumb, Button, Empty, Input, Tag, Tooltip} from "antd";
import {
  AimOutlined,
  ArrowLeftOutlined,
  BorderOutlined,
  BranchesOutlined,
  CheckOutlined,
  CodeOutlined,
  CopyOutlined,
  DownOutlined,
  RedoOutlined,
  RightOutlined,
  ScanOutlined,
  SearchOutlined,
  UpOutlined,
} from "@ant-design/icons";
import {
  findInspectableDashComponents,
  formatInspectorId,
  formatInspectorPropValue,
  sortInspectorPropEntries,
} from "./componentInspector";

function valuePreview(value) {
  if (typeof value === "string") return value;
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function DashComponentTarget({candidate, onInspect, t}) {
  const {component, path} = candidate;
  const id = component.props?.id;
  return (
    <button
      className="ddp-inspector-component-target"
      type="button"
      onClick={() => onInspect(component, path)}
    >
      <span className="ddp-inspector-component-target-icon"><BranchesOutlined /></span>
      <span className="ddp-inspector-component-target-name">
        <small>{component.namespace}</small>
        <strong>{component.type}</strong>
      </span>
      {id != null && <code title={formatInspectorId(id)}>{formatInspectorId(id)}</code>}
      <span className="ddp-inspector-component-target-action">
        {t("inspectNestedComponent")}<RightOutlined />
      </span>
    </button>
  );
}

function CopyablePropValue({children, copied, onCopy, t}) {
  return (
    <div className="ddp-inspector-copyable-value">
      <div className="ddp-inspector-copyable-content">{children}</div>
      <Tooltip title={copied ? t("propValueCopied") : t("copyPropValue")}>
        <Button
          className={`ddp-inspector-copy-value${copied ? " is-copied" : ""}`}
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          aria-label={copied ? t("propValueCopied") : t("copyPropValue")}
          onClick={onCopy}
        />
      </Tooltip>
    </div>
  );
}

function JsonValue({copied, expanded, onCopy, onInspect, onToggle, t, value}) {
  if (typeof value === "boolean") {
    return (
      <CopyablePropValue copied={copied} onCopy={onCopy} t={t}>
        <Tag color={value ? "cyan" : "default"}>{formatInspectorPropValue(value)}</Tag>
      </CopyablePropValue>
    );
  }
  if (value == null || typeof value === "number") {
    return (
      <CopyablePropValue copied={copied} onCopy={onCopy} t={t}>
        <code className="ddp-inspector-primitive">{formatInspectorPropValue(value)}</code>
      </CopyablePropValue>
    );
  }
  if (typeof value === "string") {
    return (
      <CopyablePropValue copied={copied} onCopy={onCopy} t={t}>
        <span className="ddp-inspector-string">{value}</span>
      </CopyablePropValue>
    );
  }
  const json = formatInspectorPropValue(value);
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  const componentTargets = findInspectableDashComponents(value);
  const structuredValue = !expanded ? (
      <button className="ddp-inspector-value-toggle" type="button" onClick={onToggle}>
        <code>{Array.isArray(value) ? `Array(${count})` : `Object(${count})`}</code>
        <span>{t("expandPropValue")}</span><DownOutlined />
      </button>
  ) : (
    <div className="ddp-inspector-expanded-value">
      <pre>{json}</pre>
      <Button type="link" size="small" icon={<UpOutlined />} onClick={onToggle}>{t("collapsePropValue")}</Button>
    </div>
  );
  if (!componentTargets.length) {
    return (
      <CopyablePropValue copied={copied} onCopy={onCopy} t={t}>
        {structuredValue}
      </CopyablePropValue>
    );
  }
  return (
    <div className="ddp-inspector-component-value">
      <div className="ddp-inspector-component-targets">
        {componentTargets.map((candidate) => (
          <DashComponentTarget
            candidate={candidate}
            key={JSON.stringify(candidate.path)}
            onInspect={onInspect}
            t={t}
          />
        ))}
      </div>
      <small className="ddp-inspector-component-hint">{t("inspectNestedComponentHint")}</small>
      {structuredValue}
    </div>
  );
}

function DomToken({descriptor}) {
  if (!descriptor) return <code>—</code>;
  return (
    <code className="ddp-inspector-dom-token">
      &lt;{descriptor.tag}{descriptor.id ? `#${descriptor.id}` : ""}
      {descriptor.classes?.map((name) => `.${name}`).join("") || ""}&gt;
    </code>
  );
}

function LayoutPath({path, t}) {
  const [copied, setCopied] = useState(false);
  const serialized = formatInspectorId(path);
  const segments = Array.isArray(path) ? path : [];

  useEffect(() => setCopied(false), [path]);

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(serialized);
      setCopied(true);
    } catch {
      // Clipboard access may be unavailable outside a secure browser context.
    }
  };

  return (
    <div className="ddp-inspector-fact-path">
      <div className="ddp-inspector-path-heading">
        <span>{t("layoutPath")}</span>
        <Tooltip title={copied ? t("layoutPathCopied") : t("copyLayoutPath")}>
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            aria-label={copied ? t("layoutPathCopied") : t("copyLayoutPath")}
            disabled={path == null}
            onClick={copyPath}
          />
        </Tooltip>
      </div>
      {segments.length ? (
        <div className="ddp-inspector-path-tokens" aria-label={serialized}>
          {segments.map((segment, index) => {
            const isIndex = typeof segment === "number";
            const isStructural = segment === "props";
            const text = typeof segment === "string" ? segment : JSON.stringify(segment);
            return (
              <React.Fragment key={`${index}-${text}`}>
                {index > 0 && <span className="ddp-inspector-path-separator">›</span>}
                <code className={`${isIndex ? "is-index" : ""} ${isStructural ? "is-structural" : ""}`.trim()}>
                  {isIndex ? `[${text}]` : text}
                </code>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <code className="ddp-inspector-path-root">{path == null ? "—" : t("layoutRoot")}</code>
      )}
      <small>{t("layoutPathHint")}</small>
    </div>
  );
}

function EmptyInspector({onStart, t}) {
  return (
    <div className="ddp-inspector-empty">
      <div className="ddp-inspector-orbit" aria-hidden="true">
        <i /><i /><i />
        <span><ScanOutlined /></span>
      </div>
      <div className="ddp-eyebrow">{t("componentInspectorEyebrow")}</div>
      <h2>{t("componentInspectorEmptyTitle")}</h2>
      <p>{t("componentInspectorEmptyDescription")}</p>
      <Button
        className="ddp-inspector-start"
        type="primary"
        size="large"
        icon={<AimOutlined />}
        onClick={onStart}
      >
        {t("startComponentInspection")}
      </Button>
      <small>{t("inspectionHint")}</small>
    </div>
  );
}

export default function ComponentInspectorPanel({
  inspection,
  inspectionTrail = [],
  onInspectComponent,
  onNavigate,
  onStart,
  t,
}) {
  const [query, setQuery] = useState("");
  const [expandedProps, setExpandedProps] = useState(() => new Set());
  const [copiedProp, setCopiedProp] = useState(null);
  const props = useMemo(() => sortInspectorPropEntries(inspection?.props)
    .filter(([name, value]) => {
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) return true;
      return `${name} ${valuePreview(value)}`.toLocaleLowerCase().includes(needle);
    }), [inspection, query]);

  useEffect(() => {
    setQuery("");
    setExpandedProps(new Set());
    setCopiedProp(null);
  }, [inspection]);

  if (!inspection) return <EmptyInspector onStart={onStart} t={t} />;

  const toggleProp = (name) => setExpandedProps((current) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  const copyPropValue = async (name, value) => {
    try {
      await navigator.clipboard.writeText(formatInspectorPropValue(value));
      setCopiedProp(name);
    } catch {
      // Clipboard access may be unavailable outside a secure browser context.
    }
  };

  return (
    <section className="ddp-panel ddp-inspector-panel" aria-label={t("componentInspectorTitle")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon ddp-inspector-workspace-icon"><ScanOutlined /></span>
          <div>
            <div className="ddp-eyebrow">{t("componentMatched")}</div>
            <h2>{inspection.namespace}.{inspection.type}</h2>
          </div>
        </div>
        <div className="ddp-inspector-header-actions">
          {inspectionTrail.length > 1 && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => onNavigate(inspectionTrail.length - 2)}
            >
              {t("backToParentComponent")}
            </Button>
          )}
          <Button icon={<RedoOutlined />} onClick={onStart}>{t("inspectAgain")}</Button>
        </div>
      </div>

      <div className="ddp-inspector-scroll">
        {inspectionTrail.length > 1 && (
          <div className="ddp-inspector-trail" aria-label={t("inspectionTrail")}>
            <Breadcrumb
              items={inspectionTrail.map((item, index) => ({
                key: `${index}-${item.source?.propName || "root"}-${item.type}`,
                title: index === inspectionTrail.length - 1 ? (
                  <span>{item.source ? `${item.source.propName}: ${item.type}` : item.type}</span>
                ) : (
                  <button type="button" onClick={() => onNavigate(index)}>
                    {item.source ? `${item.source.propName}: ${item.type}` : item.type}
                  </button>
                ),
              }))}
            />
          </div>
        )}
        <div className="ddp-inspector-identity-card">
          <div className="ddp-inspector-component-mark"><BorderOutlined /></div>
          <div className="ddp-inspector-component-name">
            <span>{inspection.namespace}</span>
            <strong>{inspection.type}</strong>
            <code>{formatInspectorId(inspection.id)}</code>
          </div>
          <Tag color="processing" bordered={false}>{inspection.type}</Tag>
        </div>

        {inspection.source ? (
          <div className="ddp-inspector-mapping is-nested">
            <div>
              <span>{t("parentComponent")}</span>
              <strong>{inspection.source.parentNamespace}.{inspection.source.parentType}</strong>
            </div>
            <b aria-hidden="true">→</b>
            <div>
              <span>{t("componentProp")}</span>
              <strong>{inspection.source.propName}</strong>
            </div>
            <small>{t("nestedMappingHint")}</small>
          </div>
        ) : (
          <div className="ddp-inspector-mapping">
            <div>
              <span>{t("selectedElement")}</span>
              <DomToken descriptor={inspection.target} />
            </div>
            <b aria-hidden="true">→</b>
            <div>
              <span>{t("mappedComponent")}</span>
              <strong>{inspection.namespace}.{inspection.type}</strong>
            </div>
            <small>{t("mappingHint")}</small>
          </div>
        )}

        <div className="ddp-inspector-facts">
          <div><span>{t("inspectorNamespace")}</span><code>{inspection.namespace}</code></div>
          <div><span>{t("componentId")}</span><code title={formatInspectorId(inspection.id)}>{formatInspectorId(inspection.id)}</code></div>
          <div><span>{t("propCount")}</span><strong>{Object.keys(inspection.props || {}).length}</strong></div>
          <div className="ddp-inspector-fact-root"><span>{t("componentRoot")}</span><DomToken descriptor={inspection.root} /></div>
          <div className="ddp-inspector-fact-bounds"><span>{t("componentBounds")}</span><code>{inspection.bounds ? `${inspection.bounds.width} × ${inspection.bounds.height}` : t("notApplicable")}</code></div>
          <LayoutPath path={inspection.path} t={t} />
        </div>

        <div className="ddp-inspector-props-card">
          <div className="ddp-inspector-props-heading">
            <div>
              <CodeOutlined />
              <span><small>{t("runtimeProps")}</small><strong>{t("currentProps")}</strong></span>
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchProps")}
            />
          </div>
          <div className="ddp-inspector-props-header">
            <span>{t("propName")}</span><span>{t("propType")}</span><span>{t("propValue")}</span>
          </div>
          <div className="ddp-inspector-props-list">
            {props.map(([name, value]) => (
              <div className="ddp-inspector-prop-row" key={name}>
                <Tooltip title={name}><code className="ddp-inspector-prop-name">{name}</code></Tooltip>
                <Tag bordered={false}>{inspection.propTypes?.[name] || typeof value}</Tag>
                <div className="ddp-inspector-prop-value">
                  <JsonValue
                    copied={copiedProp === name}
                    expanded={expandedProps.has(name)}
                    onCopy={() => copyPropValue(name, value)}
                    onInspect={(component, path) => onInspectComponent?.(component, name, path)}
                    onToggle={() => toggleProp(name)}
                    t={t}
                    value={value}
                  />
                </div>
              </div>
            ))}
            {!props.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noPropsMatched")} />}
          </div>
        </div>
      </div>
    </section>
  );
}
