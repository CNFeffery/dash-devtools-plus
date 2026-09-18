import {isExcludedComponentNamespace} from "./componentNamespaces.js";

const REACT_FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"];
const MAX_VALUE_DEPTH = 12;
const MAX_COLLECTION_ITEMS = 500;
const INSPECTOR_PROP_PRIORITY = new Map([
  ["id", 0],
  ["children", 1],
]);

export function sortInspectorPropEntries(props) {
  return Object.entries(props || {})
    .map((entry, index) => ({entry, index}))
    .sort((left, right) => {
      const leftPriority = INSPECTOR_PROP_PRIORITY.get(left.entry[0]) ?? 2;
      const rightPriority = INSPECTOR_PROP_PRIORITY.get(right.entry[0]) ?? 2;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({entry}) => entry);
}

function isDashComponentDefinition(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.namespace === "string" &&
      !isExcludedComponentNamespace(value.namespace) &&
      typeof value.type === "string" &&
      value.props &&
      typeof value.props === "object",
  );
}

export function isInspectableDashComponent(value) {
  if (!isDashComponentDefinition(value)) return false;
  const namespace = globalThis.window?.[value.namespace];
  return Boolean(namespace && namespace[value.type]);
}

export function findInspectableDashComponents(value) {
  const components = [];
  const ancestors = new Set();

  function visit(current, path) {
    if (isInspectableDashComponent(current)) {
      components.push({component: current, path});
      return;
    }
    if (!current || typeof current !== "object" || ancestors.has(current)) return;

    ancestors.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, [...path, index]));
    } else {
      Object.entries(current).forEach(([key, item]) => visit(item, [...path, key]));
    }
    ancestors.delete(current);
  }

  visit(value, []);
  return components;
}

function findReactFiber(element) {
  for (let node = element; node instanceof Element; node = node.parentElement) {
    const key = Object.getOwnPropertyNames(node).find((name) =>
      REACT_FIBER_PREFIXES.some((prefix) => name.startsWith(prefix)),
    );
    if (key) return {fiber: node[key], host: node};
  }
  return null;
}

function getLayout(reference) {
  try {
    return window.dash_component_api?.getLayout?.(reference);
  } catch {
    return undefined;
  }
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function formatInspectorPropValue(value) {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return value;
  if (value == null || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function sanitizeValue(value, depth, ancestors, references, path) {
  if (value === undefined) return "[undefined]";
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Element) return `[DOM <${value.tagName.toLowerCase()}>]`;
  if (depth >= MAX_VALUE_DEPTH) return "[Maximum depth reached]";
  if (ancestors.has(value)) return `[Circular reference to ${references.get(value) || "$"}]`;

  ancestors.add(value);
  references.set(value, path);
  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item, index) => sanitizeValue(
        item,
        depth + 1,
        ancestors,
        references,
        `${path}.${index}`,
      ));
    if (value.length > MAX_COLLECTION_ITEMS) {
      result.push(`[${value.length - MAX_COLLECTION_ITEMS} more items]`);
    }
    ancestors.delete(value);
    references.delete(value);
    return result;
  }

  const result = {};
  const entries = Object.entries(value);
  entries.slice(0, MAX_COLLECTION_ITEMS).forEach(([key, item]) => {
    result[key] = sanitizeValue(item, depth + 1, ancestors, references, `${path}.${key}`);
  });
  if (entries.length > MAX_COLLECTION_ITEMS) {
    result.__truncated__ = `${entries.length - MAX_COLLECTION_ITEMS} more properties`;
  }
  ancestors.delete(value);
  references.delete(value);
  return result;
}

export function sanitizeInspectorValue(value) {
  return sanitizeValue(value, 0, new WeakSet(), new WeakMap(), "$");
}

export function createNestedInspection(parent, component, propName, valuePath = []) {
  if (!parent || !isInspectableDashComponent(component)) return null;
  const rawProps = component.props || {};
  const path = [
    ...(Array.isArray(parent.path) ? parent.path : []),
    "props",
    propName,
    ...valuePath,
  ];
  return {
    namespace: component.namespace,
    type: component.type,
    id: sanitizeInspectorValue(rawProps.id ?? null),
    path: sanitizeInspectorValue(path),
    props: sanitizeInspectorValue(rawProps),
    propTypes: Object.fromEntries(
      Object.entries(rawProps).map(([key, value]) => [key, valueType(value)]),
    ),
    target: null,
    root: null,
    bounds: null,
    source: {
      parentNamespace: parent.namespace,
      parentType: parent.type,
      propName,
      valuePath: sanitizeInspectorValue(valuePath),
    },
    inspectedAt: Date.now(),
  };
}

function buildDomDescriptor(element) {
  if (!(element instanceof Element)) return null;
  const className = typeof element.className === "string"
    ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 4)
    : [];
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: className,
    text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

function inspectionResult(layout, path, target, root) {
  // getLayout reads the current Dash store, including callback and setProps
  // updates. Fiber props are already hydrated for React rendering: component-
  // valued props become React elements whose owner links can expose unrelated
  // ancestors and siblings. Keep Fiber traversal exclusively for locating the
  // Dash layout path and never use it as inspector data.
  const rawProps = layout.props || {};
  const props = sanitizeInspectorValue(rawProps);
  const rect = root.getBoundingClientRect();
  return {
    namespace: layout.namespace,
    type: layout.type,
    id: sanitizeInspectorValue(layout.props?.id ?? rawProps.id ?? null),
    path: Array.isArray(path) ? sanitizeInspectorValue(path) : null,
    props,
    propTypes: Object.fromEntries(
      Object.entries(rawProps).map(([key, value]) => [key, valueType(value)]),
    ),
    target: buildDomDescriptor(target),
    root: buildDomDescriptor(root),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    inspectedAt: Date.now(),
  };
}

export function findClosestDashComponent(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest(".ddp-ant-root, .ddp-probe-layer, .dash-debug-menu")) return null;

  const react = findReactFiber(target);
  if (react?.fiber) {
    let root = react.host;
    let legacyCandidate = null;
    for (let fiber = react.fiber; fiber; fiber = fiber.return) {
      if (fiber.stateNode instanceof Element) root = fiber.stateNode;
      const props = fiber.memoizedProps || fiber.pendingProps || {};
      const path = Array.isArray(props.componentPath) ? props.componentPath : null;
      const layout = path ? getLayout(path) : null;
      if (isDashComponentDefinition(layout)) {
        return inspectionResult(layout, path, target, root);
      }

      const legacyLayout = props._dashprivate_layout || props.component;
      if (isDashComponentDefinition(legacyLayout) && !legacyCandidate) {
        legacyCandidate = {layout: legacyLayout, root};
      }
    }
    if (legacyCandidate) {
      return inspectionResult(
        legacyCandidate.layout,
        null,
        target,
        legacyCandidate.root,
      );
    }
  }

  for (let element = target; element; element = element.parentElement) {
    if (!element.id) continue;
    const layout = getLayout(element.id);
    if (isDashComponentDefinition(layout)) {
      return inspectionResult(layout, null, target, element);
    }
  }
  return null;
}

export function formatInspectorId(id) {
  if (id == null) return "—";
  return typeof id === "string" ? id : JSON.stringify(id);
}
