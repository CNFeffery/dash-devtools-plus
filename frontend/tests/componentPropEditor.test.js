import assert from "node:assert/strict";
import test from "node:test";
import {
  inferPropEditorMode, parsePropEditorValue, readEditableProp,
  updateComponentProp,
  formatPropEditorText, getPropEditorDiagnostic,
} from "../src/componentPropEditor.js";

globalThis.Element = class {};
const component = props => ({namespace: "test_components", type: "Control", props});
const reference = (layout, path = []) => ({
  namespace: layout.namespace, type: layout.type, id: layout.props.id ?? null,
  path, props: {value: "truncated preview"},
});

function setup(root) {
  const calls = [];
  const find = value => {
    if (!value || typeof value !== "object") return undefined;
    if (value.namespace && JSON.stringify(value.props.id) === JSON.stringify(targetId)) return value;
    return Object.values(value).map(find).find(Boolean);
  };
  let targetId;
  const getLayout = ref => {
    if (Array.isArray(ref)) return ref.reduce((node, key) => node?.[key], root);
    targetId = ref;
    return find(root);
  };
  globalThis.window = {
    test_components: {Control: {}},
    dash_component_api: {getLayout},
    dash_clientside: {set_props(ref, props) {
      calls.push({ref, props});
      Object.assign(getLayout(ref).props, props);
    }},
  };
  globalThis.document = {getElementById: () => null};
  return calls;
}

test("infer modes without treating false, zero, or an empty string as missing", () => {
  for (const [value, mode] of [
    [null, null], [undefined, null], [false, "boolean"], [0, "number"],
    ["", "string"], [[], "json"], [{}, "json"],
  ]) assert.equal(inferPropEditorMode(value), mode);
});

test("parse typed values and reject invalid or non-finite JSON values", () => {
  assert.equal(parsePropEditorValue("string", ""), "");
  assert.equal(parsePropEditorValue("string", "false"), "false");
  assert.equal(parsePropEditorValue("number", " -1.25e2 "), -125);
  assert.equal(parsePropEditorValue("boolean", "false"), false);
  assert.deepEqual(parsePropEditorValue("json", '[1, true, {"label":"中文"}]'), [1, true, {label: "中文"}]);
  assert.equal(parsePropEditorValue("json", "null"), null);
  for (const value of ["", " ", "NaN", "Infinity", "1e999", "12px", "0x10", "01"]) {
    assert.throws(() => parsePropEditorValue("number", value), /propEditorInvalidNumber/);
  }
  for (const value of ['{"x":}', "[1,]", "//comment\n{}", "undefined"]) {
    assert.throws(() => parsePropEditorValue("json", value), /propEditorInvalidJson/);
  }
  assert.throws(() => parsePropEditorValue("json", '{"x":[1e999]}'), /propEditorInvalidNumber/);
  assert.throws(() => parsePropEditorValue("boolean", "False"), /propEditorInvalidBoolean/);
  assert.throws(() => parsePropEditorValue(null, ""), /propEditorChooseType/);
  assert.throws(() => parsePropEditorValue("json", JSON.stringify([component({})])), /propEditorComponentValue/);
});

test("read the complete live value, not a truncated inspection or old snapshot", () => {
  const live = component({id: "target", value: Array.from({length: 700}, (_, i) => i)});
  setup(live);
  const edit = readEditableProp(reference(live), "value");
  assert.equal(edit.mode, "json");
  assert.equal(JSON.parse(edit.text).length, 700);
  live.props.value = null;
  assert.equal(readEditableProp(reference(live), "value").mode, null);
  assert.equal(readEditableProp(reference(live), "value").text, "");
});

test("format normalizes JSON-like syntax and preserves the selected value type", () => {
  const source = "{label:'Hello, world', values:[1,2,true,], nested:{enabled:false}}";
  const formatted = formatPropEditorText("json", source);
  assert.equal(formatted, '{\n  "label": "Hello, world",\n  "values": [\n    1,\n    2,\n    true\n  ],\n  "nested": {\n    "enabled": false\n  }\n}');
  assert.throws(() => parsePropEditorValue("json", source), /propEditorInvalidJson/);
  assert.deepEqual(parsePropEditorValue("json", formatted), {label: "Hello, world", values: [1, 2, true], nested: {enabled: false}});
  assert.equal(parsePropEditorValue("string", formatPropEditorText("string", source)), formatted);
  assert.equal(formatPropEditorText("json", "'hello'"), '"hello"');
  assert.equal(formatPropEditorText("json", "null"), "null");
  assert.equal(formatPropEditorText("json", formatted), formatted);
});

test("format plain strings without rewriting quotes, commas, escapes or leading indentation", () => {
  assert.equal(formatPropEditorText("string", "  It's 'quoted',verbatim.  \r\n  next\\nline\t"), "  It's 'quoted',verbatim.\n  next\\nline");
  assert.equal(formatPropEditorText("string", ""), "");
  assert.equal(formatPropEditorText("string", '"hello"'), '"hello"');
  assert.equal(formatPropEditorText("string", "01"), "01");
  assert.equal(formatPropEditorText("string", "[ERROR] message  "), "[ERROR] message");
});

test("format failures retain the draft and expose syntax positions without accepting non-finite values", () => {
  assert.throws(() => formatPropEditorText("json", '{\n "x": }'), error => (
    error.message === "propEditorFormatInvalidJson" && error.lineNumber === 2 && error.columnNumber > 1
  ));
  for (const text of ["[NaN]", "{x:Infinity}", "[1e999]"]) {
    assert.throws(() => formatPropEditorText("json", text), /propEditorInvalidNumber/);
  }
  assert.equal(formatPropEditorText("string", "{unfinished"), "{unfinished");
});

test("inline diagnostics leave empty drafts quiet and delegate JSON syntax to Monaco", () => {
  assert.equal(getPropEditorDiagnostic("number", ""), null);
  assert.equal(getPropEditorDiagnostic("number", " \n"), null);
  assert.equal(getPropEditorDiagnostic("number", "-"), "propEditorInvalidNumber");
  assert.equal(getPropEditorDiagnostic("number", "1e999"), "propEditorInvalidNumber");
  assert.equal(getPropEditorDiagnostic("number", "12.5"), null);
  assert.equal(getPropEditorDiagnostic("json", '{"x":}'), null);
  assert.equal(getPropEditorDiagnostic("json", "[1e999]"), "propEditorInvalidNumber");
  assert.equal(getPropEditorDiagnostic("string", "not a number"), null);
});

test("updates only the chosen prop and uses an ID to notify callbacks", () => {
  const live = component({id: "target", value: 1, disabled: false});
  const calls = setup(live);
  const updated = updateComponentProp(reference(live), "value", "number", "2");
  assert.deepEqual(calls, [{ref: "target", props: {value: 2}}]);
  assert.equal(updated.props.value, 2);
  assert.equal(live.props.disabled, false);
});

test("support pattern IDs, moved targets, ID edits, and components without IDs", () => {
  const live = component({id: {type: "row", index: 2}, value: 1});
  const root = component({children: [component({id: "other"}), live]});
  const calls = setup(root);
  updateComponentProp(reference(live, ["props", "children", 0]), "value", "boolean", "false");
  assert.deepEqual(calls[0], {ref: live.props.id, props: {value: false}});
  const updated = updateComponentProp(reference(live, ["props", "children", 1]), "id", "string", "new-id");
  assert.equal(updated.id, "new-id");
  const anonymous = component({value: 0});
  root.props.children.push(anonymous);
  const path = ["props", "children", 2];
  updateComponentProp(reference(anonymous, path), "value", "json", '{"ready":true}');
  assert.deepEqual(calls[2], {ref: path, props: {value: {ready: true}}});
});

test("reject removed targets, structural values, missing API and dispatch failures", () => {
  const live = component({id: "target", value: 1});
  const ref = reference(live);
  const calls = setup(component({id: "replacement", value: 0}));
  assert.throws(() => updateComponentProp(ref, "value", "number", "2"), /propEditorTargetMissing/);
  assert.equal(calls.length, 0);
  setup(live);
  live.props.value = [component({})];
  assert.throws(() => readEditableProp(ref, "value"), /propEditorComponentValue/);
  assert.throws(() => updateComponentProp(ref, "value", "string", "oops"), /propEditorComponentValue/);
  live.props.value = 1;
  window.dash_clientside = {};
  assert.throws(() => updateComponentProp(ref, "value", "number", "2"), /propEditorApiUnavailable/);
  window.dash_clientside.set_props = () => {throw new Error("dispatch failed");};
  assert.throws(() => updateComponentProp(ref, "value", "number", "2"), /propEditorUpdateFailed/);
});
