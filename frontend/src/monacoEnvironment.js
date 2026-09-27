import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker&inline";

// Private to the bundled editor; do not replace a Dash application's own
// MonacoEnvironment or send its editors to a different version of the workers.
export default {
  getWorker(_moduleId, label) {
    return label === "json" ? new JsonWorker() : new EditorWorker();
  },
};
