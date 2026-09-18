function firstMatch(value, patterns) {
  for (const [name, pattern] of patterns) {
    const match = String(value || "").match(pattern);
    if (match) return {name, version: match[1]};
  }
  return {name: "Unknown", version: ""};
}

export function parseBrowser(userAgent = "") {
  return firstMatch(userAgent, [
    ["Microsoft Edge", /Edg\/([\d.]+)/],
    ["Opera", /OPR\/([\d.]+)/],
    ["Firefox", /Firefox\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ]);
}

export function collectBrowserEnvironment(win = window) {
  const nav = win.navigator || {};
  const browser = parseBrowser(nav.userAgent);

  return {
    ...browser,
    platform: nav.userAgentData?.platform || nav.platform || "Unknown",
    language: nav.language || "Unknown",
    viewport: `${Math.round(win.innerWidth || 0)} × ${Math.round(win.innerHeight || 0)}`,
  };
}

function valueOrUnknown(value) {
  return value === null || value === undefined || value === "" ? "Unknown" : value;
}

export function buildEnvironmentReport(environment, browser) {
  const app = environment?.application || {};
  const python = environment?.python || {};
  const server = environment?.server || {};
  const dependencies = environment?.dependencies?.libraries || [];
  const generatedAt = environment?.generatedAt
    ? new Date(environment.generatedAt).toISOString()
    : new Date().toISOString();
  const lines = [
    "# Dash application environment",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Application",
    `- Dash: ${valueOrUnknown(app.dashVersion)}`,
    `- Dash Devtools Plus: ${valueOrUnknown(app.devtoolsPlusVersion)}`,
    "",
    "## Python",
    `- Version: ${valueOrUnknown(python.version)}`,
    `- Implementation: ${valueOrUnknown(python.implementation)}`,
    "",
    "## Server",
    `- Operating system: ${[server.operatingSystem, server.osRelease].filter(Boolean).join(" ") || "Unknown"}`,
    `- Architecture: ${valueOrUnknown(server.architecture)}`,
    "",
    "## Browser",
    `- Browser: ${[browser?.name, browser?.version].filter(Boolean).join(" ") || "Unknown"}`,
    `- Platform: ${valueOrUnknown(browser?.platform)}`,
    `- Language: ${valueOrUnknown(browser?.language)}`,
    `- Viewport: ${valueOrUnknown(browser?.viewport)}`,
    "",
    `## Dependencies (${dependencies.length})`,
    "```text",
  ];

  if (!dependencies.length) lines.push("None detected");
  for (const dependency of dependencies) {
    lines.push(`${dependency.name}==${dependency.version}`);
  }
  lines.push("```");

  return `${lines.join("\n")}\n`;
}
