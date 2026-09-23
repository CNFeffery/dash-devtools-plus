import test from "node:test";
import assert from "node:assert/strict";

import {
  CALLBACK_PERFORMANCE_COLUMNS_STORAGE_KEY,
  readCallbackPerformanceColumns,
  writeCallbackPerformanceColumns,
} from "../src/callbackTablePreferences.js";

function memoryStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) {
    values.set(CALLBACK_PERFORMANCE_COLUMNS_STORAGE_KEY, initialValue);
  }
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

test("performance columns are visible by default", () => {
  assert.equal(readCallbackPerformanceColumns(memoryStorage()), true);
});

test("performance column visibility round-trips through browser storage", () => {
  const storage = memoryStorage();

  writeCallbackPerformanceColumns(storage, false);
  assert.equal(readCallbackPerformanceColumns(storage), false);

  writeCallbackPerformanceColumns(storage, true);
  assert.equal(readCallbackPerformanceColumns(storage), true);
});

test("storage failures preserve a usable default", () => {
  const unavailableStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };

  assert.equal(readCallbackPerformanceColumns(unavailableStorage), true);
  assert.doesNotThrow(() => writeCallbackPerformanceColumns(unavailableStorage, false));
});
