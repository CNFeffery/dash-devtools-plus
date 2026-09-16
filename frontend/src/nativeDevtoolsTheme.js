export const NATIVE_DEVTOOLS_THEME_STORAGE_KEY = "dash_devtools_plus_native_toolbar_theme";
export const NATIVE_DEVTOOLS_THEME_ATTRIBUTE = "data-ddp-native-toolbar-theme";

export const NATIVE_DEVTOOLS_THEME_IDS = Object.freeze({
  native: "native",
  luminousDock: "luminous-dock",
  paperAtelier: "paper-atelier",
  mintCircuit: "mint-circuit",
  coralStudio: "coral-studio",
});

const THEME_ACCENTS = Object.freeze({
  [NATIVE_DEVTOOLS_THEME_IDS.paperAtelier]: "#B87942",
  [NATIVE_DEVTOOLS_THEME_IDS.mintCircuit]: "#168E81",
  [NATIVE_DEVTOOLS_THEME_IDS.coralStudio]: "#D66D63",
});

const SUPPORTED_THEME_IDS = new Set(Object.values(NATIVE_DEVTOOLS_THEME_IDS));

export function normalizeNativeDevtoolsTheme(themeId) {
  return SUPPORTED_THEME_IDS.has(themeId)
    ? themeId
    : NATIVE_DEVTOOLS_THEME_IDS.native;
}

export function readNativeDevtoolsTheme(storage) {
  try {
    return normalizeNativeDevtoolsTheme(
      storage?.getItem?.(NATIVE_DEVTOOLS_THEME_STORAGE_KEY),
    );
  } catch {
    return NATIVE_DEVTOOLS_THEME_IDS.native;
  }
}

export function writeNativeDevtoolsTheme(storage, themeId) {
  try {
    storage?.setItem?.(
      NATIVE_DEVTOOLS_THEME_STORAGE_KEY,
      normalizeNativeDevtoolsTheme(themeId),
    );
  } catch {
    // Persistence is optional; the live theme still works for this session.
  }
}

export function applyNativeDevtoolsTheme(root, themeId, accentColor = "#119DFF") {
  if (!root) return NATIVE_DEVTOOLS_THEME_IDS.native;

  const normalizedTheme = normalizeNativeDevtoolsTheme(themeId);
  if (normalizedTheme === NATIVE_DEVTOOLS_THEME_IDS.native) {
    root.removeAttribute(NATIVE_DEVTOOLS_THEME_ATTRIBUTE);
    root.style?.removeProperty?.("--ddp-native-toolbar-accent");
  } else {
    root.setAttribute(NATIVE_DEVTOOLS_THEME_ATTRIBUTE, normalizedTheme);
    root.style?.setProperty?.(
      "--ddp-native-toolbar-accent",
      THEME_ACCENTS[normalizedTheme] || accentColor,
    );
  }
  return normalizedTheme;
}
