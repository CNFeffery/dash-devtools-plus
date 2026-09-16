import assert from "node:assert/strict";
import test from "node:test";

import {normalizeCallbacks} from "../src/utils.js";

test("callback normalization preserves Docstring formatting and registration sources", () => {
  const [callback] = normalizeCallbacks([
    {
      output: "result.children",
      inputs: [{id: "trigger", property: "n_clicks"}],
      state: [],
      clientside_function: null,
      source: {
        kind: "python",
        function: "render_result",
        path: "app.py",
        line: 42,
        docstring: "Render a result.\n\nFields:\n    value: Preserved indentation.",
        editorUris: [],
      },
    },
  ]);

  assert.equal(
    callback.docstring,
    "Render a result.\n\nFields:\n    value: Preserved indentation.",
  );
  assert.match(callback.sourceText, /Preserved indentation/);
  assert.equal(callback.sourceKind, "python");
});

test("callback normalization exposes clientside Python registration locations", () => {
  const [callback] = normalizeCallbacks([
    {
      output: "client-result.data",
      inputs: [],
      state: [],
      clientside_function: {namespace: "demo", function_name: "render"},
      source: {
        kind: "clientside-registration",
        function: "app.clientside_callback",
        path: "callbacks/client.py",
        line: 18,
        docstring: null,
        editorUris: [],
      },
    },
  ]);

  assert.equal(callback.mode, "client");
  assert.equal(callback.sourceKind, "clientside-registration");
  assert.equal(callback.sourcePath, "callbacks/client.py");
  assert.equal(callback.sourceLine, 18);
  assert.equal(callback.docstring, "");
});
