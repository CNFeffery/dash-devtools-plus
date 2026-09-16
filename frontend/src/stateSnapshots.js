import {isExcludedComponentNamespace} from "./componentNamespaces.js";

const MAX_SNAPSHOTS = 12;

function isDashComponentShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.namespace !== "string" || typeof value.type !== "string") return false;
  if (!value.props || typeof value.props !== "object") return false;
  return true;
}

function isDashComponent(value) {
  if (!isDashComponentShape(value)) return false;
  if (isExcludedComponentNamespace(value.namespace)) return false;
  return Boolean(window[value.namespace]?.[value.type]);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function stringifyId(id) {
  if (id == null) return null;
  if (typeof id === "string") return id;
  try {
    return window.dash_component_api?.stringifyId?.(id) || JSON.stringify(id);
  } catch {
    return String(id);
  }
}

function containsDashComponent(value, ancestors = new WeakSet()) {
  if (!value || typeof value !== "object") return false;
  if (isDashComponentShape(value)) return true;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const result = values.some((item) => containsDashComponent(item, ancestors));
  ancestors.delete(value);
  return result;
}

function snapshotProps(props) {
  const restorable = {};
  const structural = [];
  const unsupported = [];

  Object.entries(props || {}).forEach(([name, value]) => {
    if (name === "id") return;
    if (containsDashComponent(value)) {
      structural.push(name);
      return;
    }
    try {
      restorable[name] = cloneJson(value);
    } catch {
      unsupported.push(name);
    }
  });

  return {props: restorable, structural, unsupported};
}

function componentKey(layout, path) {
  const id = stringifyId(layout.props?.id);
  return id ? `id:${id}` : `path:${JSON.stringify(path)}`;
}

function walkLayout(value, path, components, seen) {
  if (!value || typeof value !== "object") return;

  if (isDashComponentShape(value)) {
    if (isExcludedComponentNamespace(value.namespace)) return;
    if (!isDashComponent(value)) return;
    const key = componentKey(value, path);
    if (!seen.has(key)) {
      seen.add(key);
      const captured = snapshotProps(value.props);
      components.push({
        key,
        namespace: value.namespace,
        type: value.type,
        id: value.props?.id == null ? null : cloneJson(value.props.id),
        idText: stringifyId(value.props?.id),
        path: cloneJson(path),
        props: captured.props,
        propCount: Object.keys(captured.props).length,
        structuralProps: captured.structural,
        unsupportedProps: captured.unsupported,
      });
    }

    Object.entries(value.props || {}).forEach(([name, child]) => {
      walkLayout(child, [...path, "props", name], components, seen);
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkLayout(item, [...path, index], components, seen));
    return;
  }

  Object.entries(value).forEach(([name, child]) => {
    walkLayout(child, [...path, name], components, seen);
  });
}

export function scanDashComponents() {
  const getLayout = window.dash_component_api?.getLayout;
  if (typeof getLayout !== "function") {
    throw new Error("Dash getLayout API is unavailable");
  }
  const root = getLayout([]);
  if (root === undefined) {
    throw new Error("Dash layout is unavailable");
  }

  const components = [];
  walkLayout(root, [], components, new Set());
  components.sort((left, right) => (
    left.namespace.localeCompare(right.namespace) ||
    left.type.localeCompare(right.type) ||
    (left.idText || left.key).localeCompare(right.idText || right.key)
  ));
  return components;
}

export function filterSnapshotComponents(components, query, onlyWithId = true) {
  const needle = query.trim().toLocaleLowerCase();
  return components.filter((component) => {
    if (onlyWithId && component.id == null) return false;
    if (!needle) return true;
    const searchable = `${component.namespace} ${component.type} ${component.idText || ""}`
      .toLocaleLowerCase();
    return searchable.includes(needle);
  });
}

export function createStateSnapshot(name, selectedKeys) {
  const selected = new Set(selectedKeys);
  const components = scanDashComponents().filter((item) => selected.has(item.key));
  const now = Date.now();
  const snapshot = {
    id: `snapshot-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    createdAt: now,
    route: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    components,
    propCount: components.reduce((total, item) => total + item.propCount, 0),
  };
  snapshot.sizeBytes = new Blob([JSON.stringify(snapshot)]).size;
  return snapshot;
}

function getCurrentLayout(component) {
  const getLayout = window.dash_component_api?.getLayout;
  if (typeof getLayout !== "function") return undefined;
  if (component.id != null) {
    const byId = getLayout(component.id);
    if (byId !== undefined) return byId;
  }
  return getLayout(component.path);
}

export function restoreStateSnapshot(snapshot) {
  const setProps = window.dash_clientside?.set_props;
  if (typeof setProps !== "function") {
    throw new Error("Dash set_props API is unavailable");
  }

  const result = {restored: 0, unchanged: 0, skipped: 0, failed: 0, props: 0};
  snapshot.components.forEach((component) => {
    try {
      const current = getCurrentLayout(component);
      if (
        !isDashComponent(current) ||
        current.namespace !== component.namespace ||
        current.type !== component.type
      ) {
        result.skipped += 1;
        return;
      }
      const changedProps = Object.fromEntries(
        Object.entries(component.props).filter(([name, value]) => (
          !valuesEqual(current.props?.[name], value)
        )),
      );
      const changedCount = Object.keys(changedProps).length;
      if (!changedCount) {
        result.unchanged += 1;
        return;
      }
      const reference = component.id != null ? component.id : component.path;
      setProps(reference, cloneJson(changedProps));
      result.restored += 1;
      result.props += changedCount;
    } catch {
      result.failed += 1;
    }
  });
  return result;
}

function storageKey() {
  return `dash-devtools-plus:snapshots:${window.location.origin}${window.location.pathname}`;
}

export function loadStoredSnapshots() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey()) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SNAPSHOTS) : [];
  } catch {
    return [];
  }
}

export function storeSnapshots(snapshots) {
  const limited = snapshots.slice(0, MAX_SNAPSHOTS);
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify(limited));
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
