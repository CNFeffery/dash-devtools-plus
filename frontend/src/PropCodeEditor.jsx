import React, {forwardRef, useEffect, useImperativeHandle, useRef} from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import editorStyles from "monaco-editor/min/vs/editor/editor.main.css?inline";
import {formatPropEditorText, getPropEditorDiagnostic} from "./componentPropEditor";

const MARKER_OWNER = "ddp-prop-validation";
const FORMAT_MARKER_OWNER = "ddp-prop-format";

const PropCodeEditor = forwardRef(function PropCodeEditor({value, mode, label, onChange, onError, t}, ref) {
  const container = useRef(null);
  const editor = useRef(null);
  const changeRef = useRef(onChange);
  const errorRef = useRef(onError);
  changeRef.current = onChange;
  errorRef.current = onError;

  useImperativeHandle(ref, () => ({
    format() {
      const instance = editor.current;
      const model = instance?.getModel();
      if (!model) return false;
      try {
        const formatted = formatPropEditorText(mode, model.getValue());
        monaco.editor.setModelMarkers(model, FORMAT_MARKER_OWNER, []);
        if (formatted !== model.getValue()) {
          instance.pushUndoStop();
          instance.executeEdits("ddp-format", [{range: model.getFullModelRange(), text: formatted}]);
          instance.pushUndoStop();
        }
        instance.focus();
        return true;
      } catch (error) {
        const start = model.validatePosition({lineNumber: error.lineNumber || 1, column: error.columnNumber || 1});
        monaco.editor.setModelMarkers(model, FORMAT_MARKER_OWNER, [{
          severity: monaco.MarkerSeverity.Error, message: t(error.message), source: t("propEditorFormat"),
          startLineNumber: start.lineNumber, endLineNumber: start.lineNumber,
          startColumn: start.column, endColumn: start.column + 1,
        }]);
        instance.revealPositionInCenterIfOutsideViewport(start);
        instance.focus();
        return false;
      }
    },
  }), [mode, t]);

  useEffect(() => {
    let instance;
    let model;
    let subscription;
    let overflowWidgets;
    try {
      // Match the devtools' runtime stylesheet fallback: some Dash hosts omit
      // hook stylesheets, so Monaco must not rely on the external CSS alone.
      if (!document.getElementById("ddp-monaco-styles")) {
        const style = document.createElement("style");
        style.id = "ddp-monaco-styles";
        style.textContent = editorStyles;
        document.head.appendChild(style);
      }
      model = monaco.editor.createModel(value, mode === "json" ? "json" : "plaintext");
      // Keep IDE hover/completion widgets outside the editor's rounded clipping
      // surface and the modal's scrolling body, but inside the modal focus trap.
      overflowWidgets = document.createElement("div");
      overflowWidgets.className = "ddp-prop-editor-overflow monaco-editor vs";
      (container.current.closest(".ant-modal-container, .ant-modal-content") || container.current).appendChild(overflowWidgets);
      instance = monaco.editor.create(container.current, {
        model,
        theme: "vs",
        ariaLabel: label,
        automaticLayout: true,
        editContext: false,
        minimap: {enabled: false},
        fontFamily: '"Cascadia Code", Consolas, monospace',
        fontSize: 13,
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        padding: {top: 14, bottom: 14},
        fixedOverflowWidgets: true,
        overflowWidgetsDomNode: overflowWidgets,
        hover: {above: false},
        contextmenu: false,
        // Prop values do not need cross-model symbol highlighting. Disabling
        // it also avoids pending highlight requests when a modal is closed.
        occurrencesHighlight: "off",
      });
      editor.current = instance;
      subscription = instance.onDidChangeModelContent(() => changeRef.current(instance.getValue()));
    } catch {
      errorRef.current();
    }
    return () => {
      subscription?.dispose();
      instance?.dispose();
      model?.dispose();
      overflowWidgets?.remove();
      editor.current = null;
    };
    // A mode change mounts a new editor; ordinary typing keeps its undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    editor.current?.updateOptions({ariaLabel: label});
  }, [label]);

  useEffect(() => {
    const model = editor.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    monaco.editor.setModelMarkers(model, FORMAT_MARKER_OWNER, []);
    const timer = setTimeout(() => {
      if (model.isDisposed()) return;
      const diagnostic = getPropEditorDiagnostic(mode, value);
      monaco.editor.setModelMarkers(model, MARKER_OWNER, diagnostic ? [{
        ...model.getFullModelRange(),
        severity: monaco.MarkerSeverity.Error,
        message: t(diagnostic), source: "Dash prop",
      }] : []);
    }, 450);
    return () => clearTimeout(timer);
  }, [mode, value, t]);

  return <div className="ddp-prop-code-editor" ref={container} />;
});

export default PropCodeEditor;
