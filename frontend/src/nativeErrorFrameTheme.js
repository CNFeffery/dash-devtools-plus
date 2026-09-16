import {
  NATIVE_DEVTOOLS_THEME_ATTRIBUTE,
  NATIVE_DEVTOOLS_THEME_IDS,
} from "./nativeDevtoolsTheme.js";

export const NATIVE_ERROR_FRAME_STYLE_ID = "dash-devtools-plus-native-error-frame-theme";

// Dash renders Python tracebacks in a same-origin srcdoc iframe. Parent CSS
// cannot reach it, so inject one reversible skin into each live frame.
const FRAME_PALETTES = Object.freeze({
  [NATIVE_DEVTOOLS_THEME_IDS.luminousDock]: {
    page: "#f8fbfe", ink: "#405c73", muted: "#6d8ba2",
    panel: "#ffffff", panelBorder: "#d6e8f5", heading: "#edf7ff",
    headingInk: "#2f5776", code: "#f5faff", codeInk: "#415e76",
    error: "#fff2f3", errorBorder: "#ecc6cb", danger: "#ac414e",
    current: "#fff0f2", currentBorder: "#d96876", radius: "8px",
  },
  [NATIVE_DEVTOOLS_THEME_IDS.paperAtelier]: {
    page: "#fffdf8", ink: "#594d3c", muted: "#8b7b67",
    panel: "#fffefb", panelBorder: "#dfd0bb", heading: "#f7f0e5",
    headingInk: "#6e5940", code: "#fcf5e9", codeInk: "#665845",
    error: "#fff1eb", errorBorder: "#edc9bc", danger: "#b85751",
    current: "#fff0e9", currentBorder: "#b87942", radius: "6px",
  },
  [NATIVE_DEVTOOLS_THEME_IDS.mintCircuit]: {
    page: "#f8fefa", ink: "#3d665d", muted: "#71948b",
    panel: "#ffffff", panelBorder: "#bfe2d6", heading: "#eaf7f1",
    headingInk: "#326f61", code: "#f1faf6", codeInk: "#476f63",
    error: "#fff1ed", errorBorder: "#f0c9bf", danger: "#bb5f57",
    current: "#fff1ed", currentBorder: "#d7766a", radius: "11px",
  },
  [NATIVE_DEVTOOLS_THEME_IDS.coralStudio]: {
    page: "#fffbf9", ink: "#68554d", muted: "#987f75",
    panel: "#fffefd", panelBorder: "#efd5cb", heading: "#fbf0eb",
    headingInk: "#79594f", code: "#fff5f0", codeInk: "#765d54",
    error: "#fff0ed", errorBorder: "#efc5bc", danger: "#bb5956",
    current: "#fff0ed", currentBorder: "#d66d63", radius: "12px",
  },
});

function frameCss(palette) {
  return `
  body, .debugger {
    background: ${palette.page} !important;
    color: ${palette.ink} !important;
    font-family: "Aptos", "Noto Sans SC", "Segoe UI", sans-serif !important;
  }
  .debugger .errormsg {
    background: ${palette.error} !important;
    border: 1px solid ${palette.errorBorder} !important;
    border-radius: ${palette.radius} !important;
    color: ${palette.danger} !important;
    font-family: "Cascadia Code", Consolas, monospace !important;
    font-size: 14px !important;
    font-weight: 700 !important;
  }
  h2.traceback {
    background: ${palette.heading} !important;
    border: 1px solid ${palette.panelBorder} !important;
    border-bottom: 0 !important;
    border-radius: ${palette.radius} ${palette.radius} 0 0 !important;
    color: ${palette.headingInk} !important;
  }
  h2.traceback em {color: ${palette.muted} !important;}
  div.traceback {
    background: ${palette.panel} !important;
    border: 1px solid ${palette.panelBorder} !important;
    border-radius: 0 0 ${palette.radius} ${palette.radius} !important;
    color: ${palette.ink} !important;
  }
  .traceback pre, .debugger textarea {
    background: ${palette.code} !important;
    color: ${palette.codeInk} !important;
    font-family: "Cascadia Code", Consolas, monospace !important;
  }
  .traceback pre.line.current {
    background: ${palette.current} !important;
    border-left: 3px solid ${palette.currentBorder} !important;
    color: ${palette.danger} !important;
  }
  .traceback cite.filename, .traceback code.function {
    color: var(--ddp-native-toolbar-accent, #119dff) !important;
  }
  .traceback blockquote {color: ${palette.danger} !important;}
  .debugger div.plain {
    background: ${palette.panel} !important;
    border: 1px solid ${palette.panelBorder} !important;
    border-radius: ${palette.radius} !important;
    color: ${palette.ink} !important;
  }
  .debugger .plain pre {background: ${palette.code} !important;}
`;
}

export const LUMINOUS_ERROR_FRAME_CSS = frameCss(
  FRAME_PALETTES[NATIVE_DEVTOOLS_THEME_IDS.luminousDock],
);

const FRAME_CSS_BY_THEME = Object.freeze(
  Object.fromEntries(
    Object.entries(FRAME_PALETTES).map(([themeId, palette]) => [themeId, frameCss(palette)]),
  ),
);

function frameDocument(frame) {
  try {
    return frame.contentDocument;
  } catch {
    // A future Dash release may use a cross-origin or sandboxed iframe.
    return null;
  }
}

export function syncNativeErrorFrameTheme(hostDocument) {
  const hostRoot = hostDocument?.documentElement;
  if (!hostRoot?.getAttribute || !hostDocument?.querySelectorAll) return;

  const themeId = hostRoot.getAttribute(NATIVE_DEVTOOLS_THEME_ATTRIBUTE);
  const css = FRAME_CSS_BY_THEME[themeId];
  const accentColor = hostRoot.style?.getPropertyValue?.("--ddp-native-toolbar-accent") || "#119DFF";

  for (const frame of hostDocument.querySelectorAll(".dash-error-card .dash-backend-error iframe")) {
    const innerDocument = frameDocument(frame);
    if (!innerDocument?.head) continue;

    let style = innerDocument.getElementById(NATIVE_ERROR_FRAME_STYLE_ID);
    let changed = false;
    if (css) {
      if (!style) {
        style = innerDocument.createElement("style");
        style.id = NATIVE_ERROR_FRAME_STYLE_ID;
        innerDocument.head.appendChild(style);
        changed = true;
      }
      if (style.textContent !== css) {
        style.textContent = css;
        changed = true;
      }
      const innerStyle = innerDocument.documentElement?.style;
      if (innerStyle?.getPropertyValue?.("--ddp-native-toolbar-accent") !== accentColor) {
        innerStyle?.setProperty?.("--ddp-native-toolbar-accent", accentColor);
        changed = true;
      }
    } else {
      if (style) {
        style.remove();
        changed = true;
      }
      const innerStyle = innerDocument.documentElement?.style;
      if (innerStyle?.getPropertyValue?.("--ddp-native-toolbar-accent")) {
        innerStyle.removeProperty("--ddp-native-toolbar-accent");
        changed = true;
      }
    }

    // Dash measures the iframe on load/click; a style swap can change wrapping.
    if (changed) {
      try {
        frame.contentWindow?.sendHeight?.();
      } catch {
        // Styling is still safe if Dash no longer exposes its height helper.
      }
    }
  }
}

export function observeNativeErrorFrames(hostDocument, Observer = globalThis.MutationObserver) {
  if (!hostDocument?.documentElement || !Observer) return null;

  let queued = false;
  const scheduleSync = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      syncNativeErrorFrameTheme(hostDocument);
    });
  };
  const observer = new Observer(scheduleSync);
  observer.observe(hostDocument.documentElement, {childList: true, subtree: true});
  hostDocument.addEventListener?.("load", scheduleSync, true);
  scheduleSync();

  return () => {
    observer.disconnect();
    hostDocument.removeEventListener?.("load", scheduleSync, true);
  };
}
