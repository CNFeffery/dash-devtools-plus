import assert from "node:assert/strict";
import test from "node:test";

import {
  createNestedInspection,
  findInspectableDashComponents,
  findClosestDashComponent,
  formatInspectorPropValue,
  sortInspectorPropEntries,
} from "../src/componentInspector.js";
import {
  filterSnapshotComponents,
  restoreStateSnapshot,
  scanDashComponents,
} from "../src/stateSnapshots.js";

class FakeElement {
  constructor({id = "", parentElement = null, tagName = "DIV"} = {}) {
    this.className = "";
    this.id = id;
    this.parentElement = parentElement;
    this.tagName = tagName;
    this.textContent = "";
  }

  closest() {
    return null;
  }

  getBoundingClientRect() {
    return {x: 0, y: 0, width: 120, height: 36};
  }
}

globalThis.Element = FakeElement;

test("inspector props keep id first and children second", () => {
  const props = {
    className: "card",
    children: "Content",
    title: "Example",
    id: "card-1",
    hidden: false,
  };

  assert.deepEqual(
    sortInspectorPropEntries(props).map(([name]) => name),
    ["id", "children", "className", "title", "hidden"],
  );
});

test("inspector prop priority only applies to props that exist", () => {
  assert.deepEqual(
    sortInspectorPropEntries({title: "Example", children: "Content", hidden: false})
      .map(([name]) => name),
    ["children", "title", "hidden"],
  );
  assert.deepEqual(
    sortInspectorPropEntries({title: "Example", id: "card-1", hidden: false})
      .map(([name]) => name),
    ["id", "title", "hidden"],
  );
  assert.deepEqual(
    sortInspectorPropEntries({title: "Example", hidden: false}).map(([name]) => name),
    ["title", "hidden"],
  );
});

test("inspector prop values use copy-safe display formatting", () => {
  assert.equal(formatInspectorPropValue(true), "True");
  assert.equal(formatInspectorPropValue(false), "False");
  assert.equal(formatInspectorPropValue("plain text"), "plain text");
  assert.equal(formatInspectorPropValue(42), "42");
  assert.equal(formatInspectorPropValue(null), "null");
  assert.equal(
    formatInspectorPropValue({enabled: true, count: 2}),
    '{\n  "enabled": true,\n  "count": 2\n}',
  );
});

function component(namespace, type, id, children) {
  const props = {id};
  if (children !== undefined) props.children = children;
  return {namespace, type, props};
}

test("component-valued props expose registered Dash components as drill-down targets", () => {
  const title = component("dash_html_components", "Span", "title-content", "Title");
  const firstChild = component("dash_html_components", "Div", "first-child", "First");
  const nestedChild = component("dash_html_components", "Span", "nested-child", "Nested");
  globalThis.window = {
    dash_html_components: {Div: {}, Span: {}},
    DashDevtoolsPlus: {DevtoolsPlus: {}},
  };

  const targets = findInspectableDashComponents({
    title,
    children: [firstChild, "plain text", [nestedChild]],
    ignored: component("missing_library", "Unknown", "unknown"),
    special: component("DashDevtoolsPlus", "DevtoolsPlus", "devtools"),
  });

  assert.deepEqual(
    targets.map(({component: target, path}) => ({id: target.props.id, path})),
    [
      {id: "title-content", path: ["title"]},
      {id: "first-child", path: ["children", 0]},
      {id: "nested-child", path: ["children", 2, 0]},
    ],
  );
});

test("nested inspection derives the child props and layout path", () => {
  globalThis.window = {dash_html_components: {Div: {}, Span: {}}};
  const parent = {
    namespace: "dash_html_components",
    type: "Div",
    path: ["root"],
  };
  const child = component("dash_html_components", "Span", "nested-child", "Nested");

  const inspection = createNestedInspection(parent, child, "children", [2, 0]);

  assert.equal(inspection.namespace, "dash_html_components");
  assert.equal(inspection.type, "Span");
  assert.equal(inspection.id, "nested-child");
  assert.deepEqual(inspection.path, ["root", "props", "children", 2, 0]);
  assert.deepEqual(inspection.props, {id: "nested-child", children: "Nested"});
  assert.deepEqual(inspection.propTypes, {id: "string", children: "string"});
  assert.deepEqual(inspection.source, {
    parentNamespace: "dash_html_components",
    parentType: "Div",
    propName: "children",
    valuePath: [2, 0],
  });
  assert.equal(inspection.bounds, null);
});

test("snapshot tree filtering shows only components with IDs by default", () => {
  const components = [
    {id: "save", idText: "save", namespace: "dash_html_components", type: "Button"},
    {id: {type: "row", index: 1}, idText: "{\"index\":1,\"type\":\"row\"}", namespace: "dcc", type: "Input"},
    {id: null, idText: null, namespace: "dash_html_components", type: "Div"},
  ];

  assert.deepEqual(
    filterSnapshotComponents(components, "").map((item) => item.type),
    ["Button", "Input"],
  );
  assert.deepEqual(
    filterSnapshotComponents(components, "", false).map((item) => item.type),
    ["Button", "Input", "Div"],
  );
  assert.deepEqual(
    filterSnapshotComponents(components, "button", true).map((item) => item.idText),
    ["save"],
  );
});

test("inspection skips a special namespace and resolves a regular Dash parent", () => {
  const target = new FakeElement();
  const parent = new FakeElement({id: "regular-parent"});
  const layouts = new Map([
    ["special", component("DashDevtoolsPlus", "DevtoolsPlus", "special")],
    ["regular", component("dash_html_components", "Div", "regular-parent")],
  ]);
  globalThis.window = {
    dash_component_api: {
      getLayout: (path) => layouts.get(path[0]),
      stringifyId: String,
    },
    dash_html_components: {Div: {propTypes: {id: true, children: true}}},
  };
  const parentFiber = {
    memoizedProps: {componentPath: ["regular"]},
    return: null,
    stateNode: parent,
  };
  target["__reactFiber$test"] = {
    memoizedProps: {componentPath: ["special"]},
    return: parentFiber,
    stateNode: target,
  };

  const result = findClosestDashComponent(target);

  assert.equal(result.namespace, "dash_html_components");
  assert.equal(result.type, "Div");
  assert.equal(result.id, "regular-parent");
});

test("inspection keeps component props isolated from hydrated Fiber owners", () => {
  const target = new FakeElement();
  const root = new FakeElement({id: "component-prop-target"});
  const expectedSlot = component(
    "dash_html_components",
    "Span",
    "expected-slot",
    "Expected",
  );
  const unrelatedChildren = Array.from({length: 12}, (_, index) => (
    component("dash_html_components", "Article", `unrelated-${index}`, "Unrelated")
  ));
  const layout = {
    namespace: "test_components",
    type: "ComponentPropCarrier",
    props: {
      id: "component-prop-target",
      children: unrelatedChildren,
      slot: expectedSlot,
    },
  };
  const hydratedSlot = {
    "$$typeof": Symbol.for("react.element"),
    props: {children: expectedSlot},
    _owner: {memoizedProps: {children: unrelatedChildren}},
  };
  globalThis.window = {
    dash_component_api: {
      getLayout: () => layout,
    },
    dash_html_components: {Article: {}, Span: {}},
    test_components: {ComponentPropCarrier: {}},
  };
  target["__reactFiber$test"] = {
    memoizedProps: {},
    return: {
      memoizedProps: {
        id: "component-prop-target",
        setProps: () => {},
        slot: hydratedSlot,
      },
      return: {
        memoizedProps: {componentPath: ["target"]},
        return: null,
        stateNode: root,
      },
      stateNode: null,
    },
    stateNode: target,
  };

  const result = findClosestDashComponent(target);
  const slotTargets = findInspectableDashComponents(result.props.slot);

  assert.equal(result.namespace, "test_components");
  assert.equal(result.type, "ComponentPropCarrier");
  assert.deepEqual(result.props.slot, expectedSlot);
  assert.deepEqual(
    slotTargets.map(({component: item}) => item.props.id),
    ["expected-slot"],
  );
  assert.equal("setProps" in result.props, false);
});

test("snapshot scanning excludes special namespaces and their subtrees", () => {
  const hiddenChild = component("dash_html_components", "Button", "hidden-child");
  const special = component(
    "plotly_cloud_publish_component",
    "PlotlyCloud",
    "plotly-cloud",
    hiddenChild,
  );
  const visible = component("dash_html_components", "Button", "visible-button");
  const root = component("dash_html_components", "Div", "app-root", [special, visible]);
  globalThis.window = {
    dash_component_api: {getLayout: () => root, stringifyId: String},
    dash_clientside: {set_props: () => assert.fail("excluded snapshots must not restore")},
    dash_html_components: {Button: {}, Div: {}},
  };

  const scanned = scanDashComponents();
  const restored = restoreStateSnapshot({
    components: [{
      id: "plotly-cloud",
      namespace: "plotly_cloud_publish_component",
      path: [],
      props: {enabled: true},
      type: "PlotlyCloud",
    }],
  });

  assert.deepEqual(scanned.map((item) => item.idText).sort(), ["app-root", "visible-button"]);
  assert.deepEqual(restored, {restored: 0, unchanged: 0, skipped: 1, failed: 0, props: 0});
});
