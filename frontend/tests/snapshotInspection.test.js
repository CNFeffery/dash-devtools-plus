import assert from "node:assert/strict";
import test from "node:test";
import {inspectDashComponentReference} from "../src/componentInspector.js";
import {scanDashComponents} from "../src/stateSnapshots.js";

class FakeElement {
  constructor() {
    this.id = "target";
    this.tagName = "DIV";
    this.className = "card";
  }
  closest() { return null; }
  getBoundingClientRect() { return {x: 10, y: 20, width: 120, height: 40}; }
}
globalThis.Element = FakeElement;

const component = (props, type = "Div") => ({namespace: "dash_html_components", type, props});
const reference = (layout, path = []) => ({
  namespace: layout.namespace, type: layout.type, id: layout.props.id ?? null, path,
  props: {children: "stale snapshot value"},
});

function setup(root, byId = () => undefined, element = null) {
  const reads = [];
  globalThis.window = {
    dash_html_components: {Div: {}, Span: {}},
    dash_component_api: {
      getLayout: value => {
        reads.push(value);
        return Array.isArray(value)
          ? value.reduce((current, key) => current?.[key], root)
          : byId(value);
      },
    },
  };
  globalThis.document = {getElementById: () => element};
  return reads;
}

test("snapshot inspection reads complete live props without a layout scan or DOM requirement", () => {
  const nested = component({children: "Nested"}, "Span");
  const live = component({id: "target", children: [nested], hidden: false});
  const root = component({children: live});
  const reads = setup(root);
  const result = inspectDashComponentReference(reference(live, ["props", "children"]));
  assert.deepEqual(result.props, live.props);
  assert.notEqual(result.props, live.props);
  assert.deepEqual(result.propTypes, {id: "string", children: "array", hidden: "boolean"});
  assert.equal(result.root, null);
  assert.equal(result.bounds, null);
  assert.deepEqual(reads, [["props", "children"]]);
});

test("snapshot inspection supports anonymous components and the root path", () => {
  const live = component({children: "Anonymous"});
  setup(live);
  const result = inspectDashComponentReference(reference(live));
  assert.equal(result.id, null);
  assert.deepEqual(result.path, []);
  assert.equal(result.props.children, "Anonymous");
});

test("scanned paths distinguish anonymous siblings and read their latest props", () => {
  const first = component({children: "First"}, "Span");
  const second = component({children: "Second"}, "Span");
  const root = {components: component({children: [first, second]})};
  const reads = setup(root);
  const scanned = scanDashComponents().filter(item => item.type === "Span");
  assert.equal(scanned.length, 2);
  assert.notEqual(scanned[0].key, scanned[1].key);
  second.props.children = "Updated after scanning";
  reads.length = 0;
  const results = scanned.map(inspectDashComponentReference);
  assert.deepEqual(results.map(item => item.props.children), ["First", "Updated after scanning"]);
  assert.deepEqual(results.map(item => item.path), [
    ["components", "props", "children", 0],
    ["components", "props", "children", 1],
  ]);
  assert.deepEqual(reads, scanned.map(item => item.path));
});

test("moved components resolve by ID and report their current path", () => {
  const live = component({id: "target", children: "Updated"});
  const other = component({id: "replacement"});
  const root = component({children: [other, live]});
  setup(root, id => id === "target" ? live : undefined);
  const result = inspectDashComponentReference(reference(live, ["props", "children", 0]));
  assert.deepEqual(result.path, ["props", "children", 1]);
  assert.equal(result.id, "target");
});

test("pattern matching IDs compare independently of key order", () => {
  const live = component({id: {index: 2, type: "row"}});
  const reads = setup(live);
  const result = inspectDashComponentReference({...reference(live), id: {type: "row", index: 2}});
  assert.deepEqual(result.id, live.props.id);
  assert.equal(reads.length, 1);
});

test("removed or replaced targets do not inspect another component at the old path", () => {
  const original = component({id: "target"});
  setup(component({id: "other"}));
  assert.equal(inspectDashComponentReference(reference(original)), null);
  setup(component({id: "target"}, "Span"));
  assert.equal(inspectDashComponentReference(reference(original)), null);
  setup(component({id: "new-id"}));
  assert.equal(inspectDashComponentReference(reference(component({}))), null);
});

test("an unavailable renderer or an excluded namespace returns no inspection", () => {
  const live = component({id: "target"});
  setup(live);
  window.dash_component_api.getLayout = () => { throw new Error("unavailable"); };
  assert.equal(inspectDashComponentReference(reference(live)), null);
  const excluded = {...live, namespace: "DashDevtoolsPlus"};
  setup(excluded);
  assert.equal(inspectDashComponentReference(reference(excluded)), null);
});

test("DOM-backed targets retain existing inspector mapping and bounds", () => {
  const live = component({id: "target", children: "Live"});
  const element = new FakeElement();
  element.__reactFiber$test = {memoizedProps: {componentPath: []}, stateNode: element};
  setup(live, () => live, element);
  const result = inspectDashComponentReference(reference(live));
  assert.equal(result.root.id, "target");
  assert.equal(result.target.tag, "div");
  assert.deepEqual(result.bounds, {x: 10, y: 20, width: 120, height: 40});
});
