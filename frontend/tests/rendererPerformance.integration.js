// Run by pytest against the Renderer shipped with the selected Python env.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createCallbackPerformanceMonitor} from "../src/callbackPerformance.js";

const source = fs.readFileSync(process.argv[2], "utf8");
function moduleBody(id) {
  const start = source.indexOf(`/***/ "${id}"`);
  assert.ok(start >= 0, `Renderer module not found: ${id}`);
  const endings = ["\n/***/ }),", "\n/***/ },"].map((marker) => source.indexOf(marker, start)).filter((end) => end >= 0);
  return source.slice(source.indexOf('"use strict";', start), Math.min(...endings));
}
const constants = {STATUS: {OK: 200, PREVENT_UPDATE: 204, NO_RESPONSE: "NO_RESPONSE"}, STATUSMAP: {200: "SUCCESS", 204: "NO_UPDATE"}};
const requireModule = (id) => {
  if (id.endsWith("/clone.js")) return {default: structuredClone};
  if (id.endsWith("/constants/constants.js")) return constants;
  if (/\/merge(DeepRight|Right)?\.js$/.test(id)) return {default: Object.assign};
  if (id === "./src/actions/index.js") return {getCSRFHeader: () => ({})};
  if (id === "./src/actions/utils.js") return {urlBase: () => "/"};
  return {};
};
requireModule.r = () => {};
requireModule.d = () => {};
const context = vm.createContext({__webpack_require__: requireModule, __webpack_exports__: {}});
vm.runInContext(moduleBody("./src/reducers/profile.js"), context);
const reducer = context.__webpack_exports__.default;
assert.equal(typeof reducer, "function");
let state = {profile: reducer(undefined, {}), callbacks: {}};
const listeners = new Set();
const store = {getState: () => state, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }};
const monitor = createCallbackPerformanceMonitor(); monitor.install({dash_stores: [store]});
const dispatch = (action) => {
  state = {...state, profile: reducer(state.profile, action)};
  listeners.forEach((fn) => fn());
};
const usage = (total) => ({__dash_client: total, __dash_server: total / 2, __dash_upload: 10, __dash_download: 20, database: 5});
for (const total of [100, 20]) dispatch({type: "UPDATE_RESOURCE_USAGE", payload: {id: "out.children", status: 200, usage: usage(total)}});
assert.equal(monitor.getCallback("out.children").latestMs, 20);
assert.equal(monitor.getCallback("out.children").averageMs, 60);

// Execute Dash's real HTTP handler with a synthetic 500 response. This verifies
// the upstream blind spot rather than merely assuming the mock profile shape.
const body = moduleBody("./src/actions/callbacks.ts");
const imports = [...body.matchAll(/var (\w+) = __webpack_require__\([^;]+;/g)].map(([line]) => line).join("\n");
const start = body.indexOf("function handleServerside(");
assert.ok(start >= 0, "Renderer HTTP handler not found");
const end = body.indexOf("\n/**", start);
let actions = 0;
const http = vm.createContext({
  __webpack_require__: requireModule, Date, JSON, Promise, Number, setTimeout,
  fetch: async () => ({status: 500}), updateResourceUsage: (payload) => ({type: "UPDATE_RESOURCE_USAGE", payload}),
});
vm.runInContext(imports + "\n" + body.slice(start, end), http);
let failure;
try {
  await http.handleServerside((action) => { actions++; dispatch(action); }, {}, {ui: true, fetch: {}}, {output: "out.children", inputs: []}, false, [], () => state);
} catch (error) { failure = error; }
assert.equal(failure?.status, 500, String(failure));
assert.equal(actions, 0);
const result = {error: failure, payload: null};
state = {...state, callbacks: {executed: [{callback: {output: "out.children"}, executionResult: result}]}};
listeners.forEach((fn) => fn());
assert.equal(monitor.getCallback("out.children").executionCount, 3);
assert.equal(monitor.getCallback("out.children").latestStatus, "HTTP_ERROR");
assert.equal(monitor.getCallback("out.children").averageMs, 60);
assert.equal(monitor.getCallback("out.children").history.at(-1).httpStatus, 500);
console.log("Installed Dash Renderer contract verified.");
