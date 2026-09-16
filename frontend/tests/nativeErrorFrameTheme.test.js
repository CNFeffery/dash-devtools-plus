import assert from "node:assert/strict";
import test from "node:test";

import {
  LUMINOUS_ERROR_FRAME_CSS,
  NATIVE_ERROR_FRAME_STYLE_ID,
  syncNativeErrorFrameTheme,
} from "../src/nativeErrorFrameTheme.js";
import {
  NATIVE_DEVTOOLS_THEME_ATTRIBUTE,
  NATIVE_DEVTOOLS_THEME_IDS,
} from "../src/nativeDevtoolsTheme.js";

test("the Python traceback iframe skin is added and removed with the toolbar theme", () => {
  const hostAttributes = new Map();
  const hostProperties = new Map();
  const innerProperties = new Map();
  let injectedStyle = null;
  let heightUpdates = 0;

  const innerDocument = {
    head: {appendChild: (element) => { injectedStyle = element; }},
    getElementById: (id) => injectedStyle?.id === id ? injectedStyle : null,
    createElement: () => ({
      id: "",
      textContent: "",
      remove: () => { injectedStyle = null; },
    }),
    documentElement: {
      style: {
        getPropertyValue: (name) => innerProperties.get(name) || "",
        setProperty: (name, value) => innerProperties.set(name, value),
        removeProperty: (name) => innerProperties.delete(name),
      },
    },
  };
  const frame = {
    contentDocument: innerDocument,
    contentWindow: {sendHeight: () => { heightUpdates += 1; }},
  };
  const hostDocument = {
    documentElement: {
      getAttribute: (name) => hostAttributes.get(name) || null,
      style: {getPropertyValue: (name) => hostProperties.get(name) || ""},
    },
    querySelectorAll: (selector) => {
      assert.equal(selector, ".dash-error-card .dash-backend-error iframe");
      return [frame];
    },
  };

  hostAttributes.set(NATIVE_DEVTOOLS_THEME_ATTRIBUTE, NATIVE_DEVTOOLS_THEME_IDS.luminousDock);
  hostProperties.set("--ddp-native-toolbar-accent", "#258fe2");
  syncNativeErrorFrameTheme(hostDocument);
  assert.equal(injectedStyle.id, NATIVE_ERROR_FRAME_STYLE_ID);
  assert.equal(injectedStyle.textContent, LUMINOUS_ERROR_FRAME_CSS);
  assert.equal(innerProperties.get("--ddp-native-toolbar-accent"), "#258fe2");
  assert.equal(heightUpdates, 1);

  syncNativeErrorFrameTheme(hostDocument);
  assert.equal(heightUpdates, 1, "unchanged styles should not resize the iframe again");

  for (const [themeId, color] of [
    [NATIVE_DEVTOOLS_THEME_IDS.paperAtelier, "#fffdf8"],
    [NATIVE_DEVTOOLS_THEME_IDS.mintCircuit, "#f8fefa"],
    [NATIVE_DEVTOOLS_THEME_IDS.coralStudio, "#fffbf9"],
  ]) {
    hostAttributes.set(NATIVE_DEVTOOLS_THEME_ATTRIBUTE, themeId);
    syncNativeErrorFrameTheme(hostDocument);
    assert.match(injectedStyle.textContent, new RegExp(color, "i"));
  }
  assert.equal(heightUpdates, 4, "each skin change remeasures the traceback");

  hostAttributes.delete(NATIVE_DEVTOOLS_THEME_ATTRIBUTE);
  syncNativeErrorFrameTheme(hostDocument);
  assert.equal(injectedStyle, null);
  assert.equal(innerProperties.has("--ddp-native-toolbar-accent"), false);
  assert.equal(heightUpdates, 5);
});

test("unavailable or cross-origin traceback frames do not break the toolbar", () => {
  const hostDocument = {
    documentElement: {
      getAttribute: () => NATIVE_DEVTOOLS_THEME_IDS.luminousDock,
      style: {getPropertyValue: () => ""},
    },
    querySelectorAll: () => [{
      get contentDocument() { throw new Error("cross-origin"); },
    }],
  };
  assert.doesNotThrow(() => syncNativeErrorFrameTheme(hostDocument));
});
