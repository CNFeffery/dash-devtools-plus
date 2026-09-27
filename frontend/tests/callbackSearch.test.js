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
  const matches = createCallbackQueryMatcher(componentCallbackQuery({type: "row", index: 2}), "exact-id");
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
  assert.equal(createCallbackQueryMatcher('{"type": "row", "index": 2}', "exact-id")({inputs: ['{"index":2,"type":"row"}.value']}), true);
  assert.equal(createCallbackQueryMatcher(componentCallbackQuery({type: "a.b", index: 2}), "exact-id")({outputs: ['{"index":2,"type":"a.b"}.children']}), true);
});

test("exact ID matches dependencies only, with complete case-sensitive IDs", () => {
  const rows = normalizeCallbacks([
    {output: "poll-interval.disabled@duplicate-hash"},
    {output: "label.children", inputs: [{id: "poll-interval", property: "n_intervals"}]},
    {output: "result.children", state: [{id: "poll-interval", property: "interval"}]},
    {no_output: true, callback_id: "hash", inputs: [{id: "poll-interval", property: "n_intervals"}]},
    {output: "poll-interval-extra.children"},
    {output: "other.children", source: {function: "poll-interval", docstring: "poll-interval"}},
    {output: "Poll-interval.children"},
    {output: "xpoll-interval.children"},
    {output: "other.poll-interval"},
  ]);
  assert.deepEqual(rows.map(createCallbackQueryMatcher("poll-interval", "exact-id")),
    [true, true, true, true, false, false, false, false, false]);
  assert.ok(rows.every(createCallbackQueryMatcher("poll-interval")));
  assert.equal(createCallbackQueryMatcher("interval", "exact-id")(rows[0]), false);
  assert.equal(createCallbackQueryMatcher(" poll-interval ", "exact-id")({inputs: [" poll-interval .value"]}), true);
});

test("exact prop matches complete property names across components and dependency roles", () => {
  const rows = normalizeCallbacks([
    {output: "poll-interval.n_intervals@hash"},
    {output: "other.children", inputs: [{id: "poll-interval", property: "n_intervals"}]},
    {no_output: true, state: [{id: "poll-interval", property: "n_intervals"}]},
    {output: "poll-interval.disabled", inputs: [{id: "other", property: "n_intervals"}]},
    {output: "poll-interval.n_intervals_extra"},
    {output: "poll-interval.N_intervals"},
    {output: "poll-interval-extra.n_intervals"},
    {output: "n_intervals.children", source: {docstring: "n_intervals"}},
  ]);
  assert.deepEqual(rows.map(createCallbackQueryMatcher("n_intervals", "exact-property")),
    [true, true, true, true, false, false, true, false]);
  assert.equal(createCallbackQueryMatcher("intervals", "exact-property")(rows[0]), false);
  assert.equal(createCallbackQueryMatcher(" n_intervals ", "exact-property")(rows[0]), true);
  assert.equal(createCallbackQueryMatcher("poll-interval.n_intervals", "exact-property")(rows[0]), false);
  const matches = createCallbackQueryMatcher('value', "exact-property");
  assert.equal(matches({outputs: ['{"index":2,"type":"a.b"}.value']}), true);
  assert.equal(matches({inputs: ['{"index":["MATCH"],"type":"a.b"}.value']}), true);
  assert.equal(matches({state: ['{"index":2,"type":"a.b"}.children']}), false);
});

test("empty queries show all rows and incomplete exact queries never fall back to fuzzy matching", () => {
  const row = normalizeCallbacks([{output: "poll-interval.children", source: {docstring: '{"type":"row"}'}}])[0];
  for (const mode of ["fuzzy", "exact-id", "exact-property"]) {
    assert.equal(createCallbackQueryMatcher("  ", mode)(row), true);
  }
  for (const query of ['{"type":', '{"type":null}', '[1]', 'poll-interval.children']) {
    assert.equal(createCallbackQueryMatcher(query, "exact-id")(row), false);
  }
  for (const query of ['poll-interval', 'poll-interval.', '.children', '{"type":.children']) {
    assert.equal(createCallbackQueryMatcher(query, "exact-property")(row), false);
  }
  // Full JSON in fuzzy mode remains a text query across all searchable fields.
  assert.equal(createCallbackQueryMatcher('{"type":"row"}')(row), true);
  assert.equal(createCallbackQueryMatcher('{"type":"row"}', "exact-id")(row), false);
});
