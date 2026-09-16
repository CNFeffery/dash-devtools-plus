import assert from "node:assert/strict";
import test from "node:test";

import {
  NATIVE_DEVTOOLS_THEME_ATTRIBUTE,
  NATIVE_DEVTOOLS_THEME_IDS,
  NATIVE_DEVTOOLS_THEME_STORAGE_KEY,
  applyNativeDevtoolsTheme,
  normalizeNativeDevtoolsTheme,
  readNativeDevtoolsTheme,
  writeNativeDevtoolsTheme,
} from "../src/nativeDevtoolsTheme.js";

function createRoot() {
  const attributes = new Map();
  const properties = new Map();
  return {
    attributes,
    properties,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name),
    },
  };
}

test("native is the safe default for missing or unsupported themes", () => {
  assert.equal(normalizeNativeDevtoolsTheme(undefined), NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(normalizeNativeDevtoolsTheme("unknown"), NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(readNativeDevtoolsTheme({getItem: () => null}), NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(readNativeDevtoolsTheme({getItem: () => "unknown"}), NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(
    readNativeDevtoolsTheme({getItem: () => NATIVE_DEVTOOLS_THEME_IDS.luminousDock}),
    NATIVE_DEVTOOLS_THEME_IDS.luminousDock,
  );
});

test("the luminous theme is reversible and only marks the document root", () => {
  const root = createRoot();
  const theme = applyNativeDevtoolsTheme(root, NATIVE_DEVTOOLS_THEME_IDS.luminousDock, "#238bde");
  assert.equal(theme, NATIVE_DEVTOOLS_THEME_IDS.luminousDock);
  assert.equal(root.attributes.get(NATIVE_DEVTOOLS_THEME_ATTRIBUTE), theme);
  assert.equal(root.properties.get("--ddp-native-toolbar-accent"), "#238bde");

  applyNativeDevtoolsTheme(root, NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(root.attributes.has(NATIVE_DEVTOOLS_THEME_ATTRIBUTE), false);
  assert.equal(root.properties.has("--ddp-native-toolbar-accent"), false);
});

test("three light skins use distinct accents and remain reversible", () => {
  const root = createRoot();
  const accents = new Map([
    [NATIVE_DEVTOOLS_THEME_IDS.paperAtelier, "#B87942"],
    [NATIVE_DEVTOOLS_THEME_IDS.mintCircuit, "#168E81"],
    [NATIVE_DEVTOOLS_THEME_IDS.coralStudio, "#D66D63"],
  ]);
  for (const [themeId, accent] of accents) {
    assert.equal(normalizeNativeDevtoolsTheme(themeId), themeId);
    assert.equal(applyNativeDevtoolsTheme(root, themeId), themeId);
    assert.equal(root.attributes.get(NATIVE_DEVTOOLS_THEME_ATTRIBUTE), themeId);
    assert.equal(root.properties.get("--ddp-native-toolbar-accent"), accent);
  }
  applyNativeDevtoolsTheme(root, NATIVE_DEVTOOLS_THEME_IDS.native);
  assert.equal(root.attributes.has(NATIVE_DEVTOOLS_THEME_ATTRIBUTE), false);
  assert.equal(root.properties.has("--ddp-native-toolbar-accent"), false);
});

test("the selected theme is persisted without requiring browser storage", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  writeNativeDevtoolsTheme(storage, NATIVE_DEVTOOLS_THEME_IDS.luminousDock);
  assert.equal(
    values.get(NATIVE_DEVTOOLS_THEME_STORAGE_KEY),
    NATIVE_DEVTOOLS_THEME_IDS.luminousDock,
  );
  assert.equal(readNativeDevtoolsTheme(storage), NATIVE_DEVTOOLS_THEME_IDS.luminousDock);
  writeNativeDevtoolsTheme(storage, NATIVE_DEVTOOLS_THEME_IDS.mintCircuit);
  assert.equal(readNativeDevtoolsTheme(storage), NATIVE_DEVTOOLS_THEME_IDS.mintCircuit);
  assert.equal(readNativeDevtoolsTheme({getItem: () => { throw new Error("blocked"); }}), "native");
  assert.doesNotThrow(() => writeNativeDevtoolsTheme({setItem: () => { throw new Error("blocked"); }}, "native"));
});
