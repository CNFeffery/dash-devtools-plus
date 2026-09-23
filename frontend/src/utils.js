export function getDashPrefix() {
  try {
    const configNode = document.getElementById("_dash-config");
    const config = JSON.parse(configNode?.textContent || "{}");
    return config.requests_pathname_prefix || "/";
  } catch {
    return "/";
  }
}

export function endpointUrl(endpoint) {
  const prefix = getDashPrefix();
  return `${prefix.endsWith("/") ? prefix : `${prefix}/`}${String(endpoint).replace(/^\//, "")}`;
}

export function stableId(id) {
  if (typeof id === "string") return id;
  try {
    return window.dash_component_api?.stringifyId?.(id) || JSON.stringify(id);
  } catch {
    return String(id);
  }
}

export function flattenDependencies(items, result = []) {
  for (const item of items || []) {
    if (Array.isArray(item)) {
      flattenDependencies(item, result);
    } else if (item && typeof item === "object") {
      result.push(`${stableId(item.id)}.${item.property}`);
    }
  }
  return result;
}

export function splitOutputs(output) {
  const cleaned = String(output || "").replace(/^\.\.|\.\.$/g, "");
  return cleaned ? cleaned.split("...").map((part) => part.replace(/@[^.]+$/, "")) : [];
}

const INTERNALLY_SCROLLABLE_TABS = new Set(["appearance", "callbacks", "environment", "inspector"]);

export function usesInternalTabScroll(tabKey) {
  return INTERNALLY_SCROLLABLE_TABS.has(tabKey);
}

const EDITOR_TARGETS = [
  {id: "vscode", label: "VS Code"},
  {id: "cursor", label: "Cursor"},
  {id: "pycharm", label: "PyCharm"},
];

function parseEditorUri(editorUri) {
  const fileUri = editorUri.match(
    /^(vscode|cursor):\/\/file(.+):(\d+):(\d+)$/,
  );
  if (fileUri) {
    return {
      preferred: fileUri[1],
      path: fileUri[2],
      line: fileUri[3],
      column: fileUri[4],
    };
  }

  try {
    const uri = new URL(editorUri);
    if (uri.protocol !== "pycharm:") return null;
    const file = uri.searchParams.get("file");
    const line = uri.searchParams.get("line");
    if (!file || !line) return null;
    const encodedPath = file
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")
      .replace(/%3A/gi, ":");
    return {
      preferred: "pycharm",
      path: encodedPath.startsWith("/") ? encodedPath : `/${encodedPath}`,
      line,
      column: uri.searchParams.get("column") || "1",
    };
  } catch {
    return null;
  }
}

function buildEditorUri(editor, target) {
  if (editor === "pycharm") {
    const path = target.path.replace(/^\/(?=[A-Za-z]:\/)/, "");
    return `pycharm://open?file=${path}&line=${target.line}&column=${target.column}`;
  }
  const path = target.path.startsWith("/") ? target.path : `/${target.path}`;
  return `${editor}://file${path}:${target.line}:${target.column}`;
}

export function expandLegacyEditorUri(editorUri) {
  const target = parseEditorUri(editorUri);
  if (!target) return [];

  return [...EDITOR_TARGETS]
    .sort((left, right) => (
      Number(right.id === target.preferred) - Number(left.id === target.preferred)
    ))
    .map((editor) => ({
      ...editor,
      uri: buildEditorUri(editor.id, target),
      supported: editor.id === target.preferred,
    }));
}

function normalizeEditorTargets(source, editorUri) {
  if (!Array.isArray(source.editorUris)) {
    return editorUri ? expandLegacyEditorUri(editorUri) : [];
  }

  const catalog = new Map(EDITOR_TARGETS.map((target) => [target.id, target]));
  const provided = source.editorUris
    .filter((target) => (
      target &&
      catalog.has(target.id) &&
      typeof target.uri === "string"
    ))
    .map((target) => ({
      ...catalog.get(target.id),
      uri: target.uri,
      supported: target.supported !== false,
    }));

  if (!provided.length) return [];

  const providedIds = new Set(provided.map((target) => target.id));
  return [
    ...provided,
    ...EDITOR_TARGETS
      .filter((target) => !providedIds.has(target.id))
      .map((target) => ({...target, uri: "", supported: false})),
  ];
}

export function normalizeCallbacks(items) {
  return (items || []).map((item, index) => {
    const inputs = flattenDependencies(item.inputs);
    const state = flattenDependencies(item.state);
    const noOutput = Boolean(item.no_output);
    const outputs = noOutput ? [] : splitOutputs(item.output);
    const mode = item.clientside_function ? "client" : "server";
    const hidden = Boolean(item.hidden);
    const source = item.source || {};
    const sourcePath = source.path || "";
    const sourceLine = Number.isInteger(source.line) ? source.line : null;
    const sourceFunction = source.function || "";
    const docstring = typeof source.docstring === "string" ? source.docstring : "";
    const editorUri = typeof source.editorUri === "string" ? source.editorUri : "";
    const editorUris = normalizeEditorTargets(source, editorUri);
    const callbackId = String(item.callback_id || item.output || "");
    return {
      key: `${index}-${callbackId || "no-output"}`,
      index: index + 1,
      callbackId,
      mode,
      hidden,
      outputs,
      outputText: outputs.join(" "),
      inputs,
      inputText: inputs.join(" "),
      state,
      stateText: state.join(" "),
      sourceKind: source.kind || "unavailable",
      sourcePath,
      sourceLine,
      sourceFunction,
      docstring,
      editorUri,
      editorUris,
      sourceText: `${sourceFunction} ${sourcePath} ${sourceLine || ""} ${docstring}`.trim(),
      preventInitialCall: Boolean(item.prevent_initial_call),
      optional: Boolean(item.optional),
      background: Boolean(item.background),
      persistent: Boolean(item.persistent),
      websocket: Boolean(item.websocket),
      mcpEnabled: Boolean(item.mcp_enabled),
      dynamicCreator: Boolean(item.dynamic_creator),
      noOutput,
      running: item.running || null,
      clientsideFunction: item.clientside_function || null,
      rawOutput: noOutput ? "" : String(item.output || ""),
    };
  });
}
