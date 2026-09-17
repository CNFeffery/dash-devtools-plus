import assert from "node:assert/strict";
import test from "node:test";

import {
  blockProbedInteraction,
  selectProbedComponent,
} from "../src/componentProbeEvents.js";

test("component probing blocks the event before it reaches the inspected control", () => {
  const calls = [];
  const event = {
    preventDefault: () => calls.push("preventDefault"),
    stopPropagation: () => calls.push("stopPropagation"),
    stopImmediatePropagation: () => calls.push("stopImmediatePropagation"),
  };

  blockProbedInteraction(event);

  assert.deepEqual(calls, [
    "preventDefault",
    "stopPropagation",
    "stopImmediatePropagation",
  ]);
});

test("component probing selects from pointer down while suppressing the control action", () => {
  const calls = [];
  const target = {id: "refresh-rate"};
  const event = {
    target,
    preventDefault: () => calls.push("preventDefault"),
    stopPropagation: () => calls.push("stopPropagation"),
    stopImmediatePropagation: () => calls.push("stopImmediatePropagation"),
  };
  const component = {type: "Slider"};

  const result = selectProbedComponent(
    event,
    (receivedTarget) => {
      calls.push(receivedTarget === target ? "find" : "wrong-target");
      return component;
    },
    (receivedComponent) => calls.push(receivedComponent === component ? "select" : "wrong-component"),
  );

  assert.equal(result, component);
  assert.deepEqual(calls, [
    "find",
    "preventDefault",
    "stopPropagation",
    "stopImmediatePropagation",
    "select",
  ]);
});
