import {inspectDashComponentReference, resolveDashComponentReference} from "./componentInspector.js";
import {containsDashComponent} from "./stateSnapshots.js";
import JSON5 from "json5";

function hasOnlyFiniteNumbers(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return !value || typeof value !== "object" || Object.values(value).every(hasOnlyFiniteNumbers);
}

export function formatPropEditorText(mode, text) {
  if (mode !== "string" && mode !== "json") return text;
  const plainText = () => text.replace(/\r\n?/g, "\n").replace(/[\t ]+$/gm, "");
  // Ordinary strings are prose, IDs, class names, etc. Do not rewrite their
  // punctuation or interpret escapes. Only structured string contents use JSON.
  if (mode === "string" && !/^[\s]*[\[{]/.test(text)) {
    return plainText();
  }
  let value;
  try { value = JSON5.parse(text); }
  catch (error) {
    // Brackets can also begin ordinary text, such as Markdown links or log
    // prefixes. Only recognize structured strings when the whole value parses.
    if (mode === "string") return plainText();
    const failure = new Error("propEditorFormatInvalidJson");
    failure.lineNumber = error.lineNumber;
    failure.columnNumber = error.columnNumber;
    throw failure;
  }
  if (!hasOnlyFiniteNumbers(value)) throw new Error("propEditorInvalidNumber");
  // JSON5 is only accepted by this explicit normalization action. Applying a
  // JSON draft still requires strict JSON; string mode continues to save text.
  return JSON.stringify(value, null, 2);
}

export function getPropEditorDiagnostic(mode, text) {
  if (!text.trim() || (mode !== "number" && mode !== "json")) return null;
  try { parsePropEditorValue(mode, text); return null; }
  catch (error) {
    // The JSON language service supplies precise syntax ranges and hover text.
    return error.message === "propEditorInvalidJson" ? null : error.message;
  }
}

export function inferPropEditorMode(value) {
  if (value == null) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return typeof value;
  return "json";
}

export function propEditorText(value, mode) {
  if (value == null) return mode === "json" ? "null" : "";
  return mode === "json" ? JSON.stringify(value, null, 2) : String(value);
}

export function parsePropEditorValue(mode, text) {
  if (mode === "string") return text;
  if (mode === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
    throw new Error("propEditorInvalidBoolean");
  }
  if (mode === "number") {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text.trim())
      || !Number.isFinite(Number(text))) throw new Error("propEditorInvalidNumber");
    return Number(text);
  }
  if (mode !== "json") throw new Error("propEditorChooseType");
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("propEditorInvalidJson"); }
  // JSON.parse accepts overflowing exponents as Infinity, which cannot be
  // represented by Dash's JSON transport. Reject them at any nesting depth.
  if (!hasOnlyFiniteNumbers(value)) throw new Error("propEditorInvalidNumber");
  if (containsDashComponent(value)) throw new Error("propEditorComponentValue");
  return value;
}

export function readEditableProp(inspection, name) {
  const resolved = resolveDashComponentReference(inspection);
  if (!resolved) throw new Error("propEditorTargetMissing");
  const value = resolved.layout.props[name];
  if (containsDashComponent(value)) throw new Error("propEditorComponentValue");
  // Always edit the complete live value, never the inspector's truncated preview.
  const mode = inferPropEditorMode(value);
  let text;
  try {
    text = mode ? propEditorText(value, mode) : "";
    if (mode) parsePropEditorValue(mode, text);
  } catch { throw new Error("propEditorUnsupportedValue"); }
  return {mode, text, reference: {...inspection, path: resolved.path}};
}

export function updateComponentProp(inspection, name, mode, text) {
  const value = parsePropEditorValue(mode, text);
  const resolved = resolveDashComponentReference(inspection);
  if (!resolved) throw new Error("propEditorTargetMissing");
  if (containsDashComponent(resolved.layout.props[name])) throw new Error("propEditorComponentValue");
  const setProps = globalThis.window?.dash_clientside?.set_props;
  if (typeof setProps !== "function") throw new Error("propEditorApiUnavailable");
  try {
    // IDs notify dependent callbacks; paths also support components without IDs.
    setProps(resolved.layout.props.id ?? resolved.path, {[name]: value});
  } catch { throw new Error("propEditorUpdateFailed"); }
  return inspectDashComponentReference({
    ...inspection,
    path: resolved.path,
    id: name === "id" ? value : inspection.id,
  });
}
