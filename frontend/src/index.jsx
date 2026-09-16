import React from "react";
import DevtoolsPlus from "./DevtoolsPlus";
import {applyNativeDevtoolsTheme, readNativeDevtoolsTheme} from "./nativeDevtoolsTheme";
import {observeNativeErrorFrames} from "./nativeErrorFrameTheme";
import "./styles.css";
import embeddedStyles from "./styles.css?inline";

const STYLE_ELEMENT_ID = "dash-devtools-plus-runtime-styles";
let styleElement = document.getElementById(STYLE_ELEMENT_ID);

if (!styleElement) {
  styleElement = document.createElement("style");
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.dataset.source = "dash-devtools-plus";
  document.head.appendChild(styleElement);
}

// Keep the standalone stylesheet for normal Dash resource loading, while also
// embedding it as a runtime fallback for environments that omit or cache the
// hook-provided CSS asset.
styleElement.textContent = embeddedStyles;

// Dash can restore its native toolbar in a collapsed state without mounting
// menu content. Restore the saved toolbar skin as the bundle initializes so
// even the collapsed handle is themed before Devtools Plus is opened.
let savedNativeToolbarTheme;
try {
  savedNativeToolbarTheme = readNativeDevtoolsTheme(window.localStorage);
} catch {
  savedNativeToolbarTheme = readNativeDevtoolsTheme();
}
applyNativeDevtoolsTheme(document.documentElement, savedNativeToolbarTheme);
observeNativeErrorFrames(document);

window.DashDevtoolsPlus = Object.assign(window.DashDevtoolsPlus || {}, {
  DevtoolsPlus,
});
