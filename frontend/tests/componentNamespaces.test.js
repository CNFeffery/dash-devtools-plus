import assert from "node:assert/strict";
import test from "node:test";

import {
  EXCLUDED_COMPONENT_NAMESPACES,
  isExcludedComponentNamespace,
} from "../src/componentNamespaces.js";

test("special devtool namespaces are excluded from component inspection", () => {
  assert.deepEqual([...EXCLUDED_COMPONENT_NAMESPACES], [
    "DashDevtoolsPlus",
    "plotly_cloud_publish_component",
  ]);
  assert.equal(isExcludedComponentNamespace("DashDevtoolsPlus"), true);
  assert.equal(isExcludedComponentNamespace("plotly_cloud_publish_component"), true);
});

test("regular Dash component namespaces remain inspectable", () => {
  assert.equal(isExcludedComponentNamespace("dash_html_components"), false);
  assert.equal(isExcludedComponentNamespace("dash_core_components"), false);
  assert.equal(isExcludedComponentNamespace(null), false);
});
