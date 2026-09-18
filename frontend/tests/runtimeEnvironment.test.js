import assert from "node:assert/strict";
import test from "node:test";

import {buildEnvironmentReport, collectBrowserEnvironment, parseBrowser} from "../src/runtimeEnvironment.js";

test("browser parser recognizes current mainstream browser tokens", () => {
  assert.deepEqual(
    parseBrowser("Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"),
    {name: "Microsoft Edge", version: "140.0.0.0"},
  );
  assert.deepEqual(
    parseBrowser("Mozilla/5.0 Version/18.6 Safari/605.1.15"),
    {name: "Safari", version: "18.6"},
  );
});

test("browser environment keeps issue-relevant client information", () => {
  const browser = collectBrowserEnvironment({
    innerWidth: 1440,
    innerHeight: 900,
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
      platform: "Win32",
      language: "zh-CN",
    },
  });

  assert.equal(browser.name, "Chrome");
  assert.equal(browser.viewport, "1440 × 900");
  assert.deepEqual(Object.keys(browser).sort(), ["language", "name", "platform", "version", "viewport"]);
});

test("environment report includes app, system, browser, and dependency details", () => {
  const report = buildEnvironmentReport(
    {
      generatedAt: Date.UTC(2026, 8, 18),
      application: {dashVersion: "4.0.0", devtoolsPlusVersion: "0.1.3"},
      python: {version: "3.13.7", implementation: "CPython", compiler: "MSC"},
      server: {operatingSystem: "Windows", osRelease: "11", architecture: "AMD64"},
      dependencies: {libraries: [{name: "dash", version: "4.0.0"}]},
    },
    {name: "Chrome", version: "140", platform: "Windows", language: "zh-CN", viewport: "1440 × 900"},
  );

  assert.match(report, /Dash: 4\.0\.0/);
  assert.match(report, /Browser: Chrome 140/);
  assert.match(report, /```text\ndash==4\.0\.0\n```/);
  assert.doesNotMatch(report, /Hostname|User agent|Time zone|CPU threads/);
});
