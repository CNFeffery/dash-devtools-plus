import assert from "node:assert/strict";
import test from "node:test";

import {createLiveLegendChart, seriesGradient} from "../src/liveLegendChart.js";

function fakeChart() {
  const handlers = new Map();
  const calls = [];
  const legends = {color: {position: "top"}};
  return {
    calls,
    on(event, handler) { handlers.set(event, handler); },
    emit(event, payload) {
      calls.push([event, payload]);
      handlers.get(event)?.(payload);
    },
    legend(channel, options) {
      if (arguments.length === 0) return legends;
      legends[channel] = options;
      calls.push(["legend", channel, options]);
      return this;
    },
    render() { calls.push(["render"]); return Promise.resolve(); },
    changeData(data) {
      calls.push(["changeData", data, legends.color.defaultSelect]);
      return Promise.resolve();
    },
    destroy() { calls.push(["destroy"]); },
  };
}

test("live G2 charts apply native legend selection before every data refresh", async () => {
  const chart = fakeChart();
  const selection = {current: null};
  const first = [{value: 1}];
  const controller = createLiveLegendChart(chart, ["cpu", "memory"], first, selection);
  await controller.update(first);

  chart.emit("legend:filter", {
    nativeEvent: true,
    data: {channel: "color", values: ["memory"]},
  });
  assert.deepEqual(selection.current, ["memory"]);

  await controller.update([{value: 2}]);
  await controller.update([{value: 3}]);
  const updates = chart.calls.filter(([event]) => event === "changeData");
  assert.deepEqual(updates.map(([, , defaultSelect]) => defaultSelect), [
    ["memory"],
    ["memory"],
  ]);
  assert.equal(chart.calls.filter(([event, payload]) =>
    event === "legend:filter" && !payload.nativeEvent).length, 0);
  assert.equal(chart.calls.filter(([event]) => event === "render").length, 1);
  assert.equal(chart.calls.filter(([event]) => event === "changeData").length, 2);

  chart.emit("legend:reset", {nativeEvent: true});
  assert.equal(selection.current, null);
  await controller.update([{value: 4}]);
  assert.equal(chart.calls.filter(([event]) => event === "changeData").at(-1)[2], undefined);
  controller.destroy();
});

test("focus and empty selection survive new samples and a chart recreation", async () => {
  const selection = {current: null};
  const firstChart = fakeChart();
  const first = createLiveLegendChart(firstChart, ["server", "network"], [], selection);
  firstChart.emit("legend:focus", {
    nativeEvent: true,
    data: {channel: "color", value: "network"},
  });
  await first.update([{duration: 5}]);
  assert.deepEqual(selection.current, ["network"]);
  firstChart.emit("legend:filter", {
    nativeEvent: true,
    data: {channel: "color", values: []},
  });
  await first.update([{duration: 6}]);
  assert.deepEqual(firstChart.calls.filter(([event]) => event === "changeData").at(-1)[2], []);
  first.destroy();

  const secondChart = fakeChart();
  const second = createLiveLegendChart(secondChart, ["server", "network"], [], selection);
  await second.update([]);
  assert.deepEqual(secondChart.calls.filter(([event]) => event === "legend").at(-1)[2].defaultSelect, []);
  second.destroy();
});

test("series gradient resolves both point and grouped-area data", () => {
  const gradients = {cpu: "l(270) 0:#fff 1:#369"};
  assert.equal(seriesGradient({metric: "cpu"}, "metric", gradients), gradients.cpu);
  assert.equal(seriesGradient([{metric: "cpu"}], "metric", gradients), gradients.cpu);
});

test("queued updates read the latest user choice before each render", async () => {
  const chart = fakeChart();
  const selection = {current: null};
  const controller = createLiveLegendChart(chart, ["cpu", "memory"], [], selection);
  const first = controller.update([{value: 1}]);
  chart.emit("legend:filter", {
    nativeEvent: true,
    data: {channel: "color", values: ["cpu"]},
  });
  const second = controller.update([{value: 2}]);
  chart.emit("legend:focus", {
    nativeEvent: true,
    data: {channel: "color", value: "memory"},
  });
  await Promise.all([first, second]);
  const updates = chart.calls.filter(([event]) => event === "changeData");
  assert.equal(updates.length, 2);
  assert.ok(updates.every(([, , defaultSelect]) =>
    defaultSelect.length === 1 && defaultSelect[0] === "memory"));
  controller.destroy();
});
