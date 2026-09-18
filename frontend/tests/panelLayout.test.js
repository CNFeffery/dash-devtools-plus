import assert from "node:assert/strict";
import test from "node:test";

import {usesInternalTabScroll} from "../src/utils.js";

test("component inspector uses the bounded internal scroll container", () => {
  assert.equal(usesInternalTabScroll("inspector"), true);
  assert.equal(usesInternalTabScroll("callbacks"), true);
  assert.equal(usesInternalTabScroll("appearance"), true);
  assert.equal(usesInternalTabScroll("environment"), true);
  assert.equal(usesInternalTabScroll("snapshots"), false);
});
