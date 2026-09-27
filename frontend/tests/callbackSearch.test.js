import assert from "node:assert/strict";
import test from "node:test";
import {componentCallbackQuery, createCallbackQueryMatcher} from "../src/callbackSearch.js";
import {normalizeCallbacks} from "../src/utils.js";

test("only usable Dash IDs produce a related-callback query", () => {
  assert.equal(componentCallbackQuery("poll-interval"), "poll-interval");
  assert.equal(componentCallbackQuery({type: "row", index: 0, active: false}), '{"active":false,"index":0,"type":"row"}');
  for (const id of [null, undefined, "", "  ", 0, false, [], "bad.id", "bad{id", {index: null}, {index: []}, {index: Infinity}, new Date()]) {
    assert.equal(componentCallbackQuery(id), null);
  }
});

test("component text finds input, output, state, and no-output callbacks without changing ordinary search", () => {
  const rows = normalizeCallbacks([
    {output: "poll-interval.disabled", inputs: [], state: []},
    {output: "label.children", inputs: [{id: "poll-interval", property: "n_intervals"}], state: []},
    {output: "result.children", inputs: [], state: [{id: "poll-interval", property: "interval"}]},
    {no_output: true, callback_id: "no-output", inputs: [{id: "poll-interval", property: "n_intervals"}]},
    {output: "unrelated.children", source: {function: "render_other", docstring: "Unique explanation"}},
  ]);
  assert.deepEqual(rows.map(createCallbackQueryMatcher("poll-interval")), [true, true, true, true, false]);
  assert.equal(createCallbackQueryMatcher("UNIQUE explanation")(rows[4]), true);
  assert.equal(createCallbackQueryMatcher("")(rows[4]), true);
});

test("dictionary searches match concrete and wildcard callback dependencies by ID keys and values", () => {
  const matches = createCallbackQueryMatcher(componentCallbackQuery({type: "row", index: 2}));
  for (const field of ["inputs", "outputs", "state"]) {
    assert.equal(matches({[field]: ['{"type": "row", "index": 2}.value']}), true);
    for (const wildcard of ["ALL", "MATCH", "ALLSMALLER"]) {
      assert.equal(matches({[field]: [`{"index":["${wildcard}"],"type":"row"}.value`]}), true);
    }
    assert.equal(matches({[field]: ['{"index":3,"type":"row"}.value']}), false);
    assert.equal(matches({[field]: ['{"index":2,"type":"Row"}.value']}), false);
    assert.equal(matches({[field]: ['{"index":2,"type":"row","extra":true}.value']}), false);
    assert.equal(matches({[field]: ['{"index":2,"other":"row"}.value']}), false);
    assert.equal(matches({[field]: ['{"index":["invalid"],"type":"row"}.value']}), false);
  }
  assert.equal(createCallbackQueryMatcher('{"type": "row", "index": 2}')({inputs: ['{"index":2,"type":"row"}.value']}), true);
  assert.equal(createCallbackQueryMatcher(componentCallbackQuery({type: "a.b", index: 2}))({outputs: ['{"index":2,"type":"a.b"}.children']}), true);
});
