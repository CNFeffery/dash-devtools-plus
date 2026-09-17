import assert from "node:assert/strict";
import test from "node:test";

import en from "../src/i18n/en.js";
import zhCN from "../src/i18n/zh-CN.js";

function placeholders(value) {
  return [...value.matchAll(/\{[^}]+\}/g)].map(([token]) => token).sort();
}

test("English and Simplified Chinese dictionaries expose the same translation keys", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zhCN).sort());
});

test("English keeps every placeholder used by the Chinese source text", () => {
  for (const key of Object.keys(zhCN)) {
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(zhCN[key]),
      `Placeholder mismatch for ${key}`,
    );
  }
});
