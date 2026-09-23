export const CALLBACK_PERFORMANCE_COLUMNS_STORAGE_KEY =
  "dash_devtools_plus_callback_performance_columns";

export function readCallbackPerformanceColumns(storage) {
  try {
    const value = storage?.getItem?.(CALLBACK_PERFORMANCE_COLUMNS_STORAGE_KEY);
    return value === null || value === undefined ? true : value !== "false";
  } catch {
    return true;
  }
}

export function writeCallbackPerformanceColumns(storage, visible) {
  try {
    storage?.setItem?.(
      CALLBACK_PERFORMANCE_COLUMNS_STORAGE_KEY,
      visible ? "true" : "false",
    );
  } catch {
    // Storage may be unavailable in privacy mode. The in-memory preference still works.
  }
}
