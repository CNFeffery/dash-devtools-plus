<img src="./branding/devtools-plus-logo.svg" alt="Dash Devtools Plus logo" width="88" />

# Dash Devtools Plus

A focused developer console for Dash applications, powered by the Dash Hooks API.

English | [简体中文](./README-zh_CN.md)

Dash Devtools Plus adds an Ant Design-based workspace to Dash's native developer toolbar without changing the application layout. It provides callback diagnostics, component inspection, state snapshots, runtime library inventories, and server resource monitoring during development.

> [!IMPORTANT]
> Dash Devtools Plus is a development tool. Its UI and metadata endpoints are available only when both Dash debug mode and the native Dev Tools UI are enabled. Do not expose a debug server to an untrusted network.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Devtools Plus Panels](#devtools-plus-panels)
  - [Server Resources](#server-resources)
  - [Callbacks](#callbacks)
  - [Component Inspector](#component-inspector)
  - [State Snapshots](#state-snapshots)
  - [Component Libraries](#component-libraries)
  - [Dash Hooks](#dash-hooks)
  - [Toolbar Skins](#toolbar-skins)
- [Security and Usage Boundary](#security-and-usage-boundary)
- [Development](#development)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Features

- Native integration with `hooks.devtool` and Dash's shared Dev Tools popup state.
- English and Simplified Chinese user interfaces.
- Searchable callback relationships with source locations and IDE navigation.
- Point-and-click inspection of rendered Dash components and their current props.
- Selective, session-scoped state snapshots and prop restoration.
- Runtime inventories for component libraries and Dash Hooks plugins.
- Live CPU, memory, disk, operating-system, and Python runtime information.
- A browser-local Dash Dev Tools skin chooser covering the native toolbar and in-app error display.
- Locally built frontend assets with no CDN dependency at runtime.
- Debug-only metadata endpoints with non-cacheable responses.

## Requirements

| Dependency | Version | Purpose |
| --- | --- | --- |
| Python | 3.9 or later | Package and Dash application runtime |
| Dash | 3.3 or later | Dash Hooks and Dev Tools APIs |
| Node.js | 20.19 or later, or 22.12 or later | Frontend development only |
| npm | Bundled with Node.js | Frontend dependency management and builds |

End users installing the Python package do not need Node.js. The distributable JavaScript and CSS files are included in the package.

## Installation

Install from PyPI:

```bash
pip install dash-devtools-plus
```

For local development, follow the [Development](#development) guide instead.

## Quick Start

Installed packages are discovered automatically through Dash's `dash_hooks` entry-point group. Import the configuration helper before constructing the Dash application when customization is required:

```python
from dash import Dash, html
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(
    default_locale="en",
    accent_color="#119DFF",
    editor="vscode",
)

app = Dash(__name__)
app.layout = html.Div("Hello Dash")

if __name__ == "__main__":
    app.run(debug=True)
```

Open the application and select **Devtools Plus** from the native Dash developer toolbar.

## Configuration

Call `configure_devtools_plus` before creating the `Dash` instance.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `default_locale` | `"en" \| "zh-CN"` | `"en"` | Initial interface language. A browser-local preference takes precedence after the user switches languages. |
| `accent_color` | `str` | `"#119DFF"` | Accent color used by the Devtools Plus interface. |
| `editor` | `"vscode" \| "cursor" \| "pycharm" \| None` | `"vscode"` | Preferred editor for callback source navigation. Set to `None` to disable editor links. |
| `project_root` | `str \| Path \| None` | `None` | Explicit server-side project boundary used when resolving callback source files. |
| `editor_project_root` | `str \| Path \| None` | `None` | Client-side checkout root used when the browser and Dash server see different filesystem paths. |

For Docker, WSL, remote workspaces, or other split filesystem layouts, map the server checkout to the path visible to the local editor:

```python
configure_devtools_plus(
    project_root="/app",
    editor_project_root=r"C:\projects\my-dash-app",
)
```

Only callback files contained by the resolved project root receive editor links. The server does not launch an editor process or accept browser-provided file paths.

## Devtools Plus Panels

| Panel | Summary | Details |
| --- | --- | --- |
| Server Resources | Live server utilization and runtime environment overview | [View details](#server-resources) |
| Callbacks | Searchable callback dependencies, behavior, and source metadata | [View details](#callbacks) |
| Component Inspector | Point-and-click DOM-to-Dash component inspection | [View details](#component-inspector) |
| State Snapshots | Selective component prop capture and restoration | [View details](#state-snapshots) |
| Component Libraries | Loaded Dash component packages, versions, and aliases | [View details](#component-libraries) |
| Dash Hooks | Hook plugin discovery, registration order, and diagnostics | [View details](#dash-hooks) |
| Toolbar Skins | Native Dash toolbar and error-display appearance presets | [View details](#toolbar-skins) |

### Server Resources

### Callbacks

### Component Inspector

### State Snapshots

### Component Libraries

### Dash Hooks

### Toolbar Skins

The **工具条换肤 / Toolbar skins** tab offers two vertically stacked, full-width choices: Dash's original style (the default) and **浮光工具岛 / Luminous Dock**, a floating translucent blue dock. Selection applies immediately to the native bottom-right debug toolbar (including its collapsed handle), error count, error list, expanded details, and Python traceback iframe. It is saved in this browser's `localStorage`. Switching back to the original style removes all theme overrides. Callback graphs and devtool behavior are unchanged.

## Security and Usage Boundary

The toolbar component and all Devtools Plus metadata routes require both Dash debug mode and the native Dev Tools UI. Requests made while this condition is not satisfied receive a generic, non-cacheable `404` response.

The development endpoints may expose callback names, project-relative source paths, installed package versions, Hook registrations, and server runtime information. They do not provide an authentication boundary of their own. Keep debug applications on a trusted machine or protected development network.

State snapshots and component inspection run in the browser. Snapshots are stored in the current tab's `sessionStorage`, and restoring props may trigger related Dash callbacks.

## Development

### Create a Conda or Mamba Environment

The simplest setup uses one Conda environment for both Python and Node.js. Installing Node.js from `conda-forge` avoids a separate system-level Node.js installation.

Using Mamba:

```bash
mamba create -n dash-devtools-plus-dev -c conda-forge python=3.12 "nodejs>=22.12,<23"
conda activate dash-devtools-plus-dev
```

Using Conda:

```bash
conda create -n dash-devtools-plus-dev -c conda-forge python=3.12 "nodejs>=22.12,<23"
conda activate dash-devtools-plus-dev
```

Verify the toolchain:

```bash
python --version
node --version
npm --version
```

### Install Development Dependencies

From the repository root:

```bash
python -m pip install -e ".[dev]"
npm ci
```

`npm ci` installs the exact frontend dependency versions recorded in `package-lock.json`.

### Build the Frontend

```bash
npm run build
```

Vite writes the distributable assets to `dash_devtools_plus/assets/`. These generated JavaScript and CSS files are part of the Python package and must be committed when frontend source code changes.

For continuous frontend rebuilding:

```bash
npm run dev
```

### Test the Project

```bash
python -m pytest
npm run test:frontend
```

### Lint and Format with Ruff

Check the Python code:

```bash
ruff check .
ruff format --check .
```

Apply safe lint fixes and formatting:

```bash
ruff check . --fix
ruff format .
```

Ruff settings, including the supported Python target and line length, are defined in `pyproject.toml`.

### Run the Demo Application

```bash
python examples/app.py
```

Open <http://127.0.0.1:8050> and select **Devtools Plus** from the Dash developer toolbar.

The demo's **ERROR REPORTING TEST** controls can deliberately raise a Python `ZeroDivisionError` (`1 / 0`) or a clientside JavaScript `Error`. Both start dormant and require a click, making it easy to inspect the native error UI with either toolbar skin.

### Build the Python Package

Build the source distribution and wheel after rebuilding the frontend assets:

```bash
python -m build
```

Generated package archives are written to `dist/`.

## Project Structure

```text
dash_devtools_plus/
  assets/                 Built JavaScript and CSS distributed with Python
  hook_inventory.py       Dash Hooks discovery and runtime inventory
  plugin.py               Hook, route, configuration, and Dev Tools registration
  server_metrics.py       Server resource sampling
frontend/
  src/                    React interface and browser-side diagnostics
  tests/                  Node-based frontend tests
examples/                 Development and acceptance demo application
tests/                    Python tests
package.json              Frontend dependencies and scripts
pyproject.toml            Python package and tool configuration
vite.config.js            Frontend library build configuration
```

## Architecture

- Importing the package registers its assets, metadata routes, setup hook, and Dev Tools component through the Dash Hooks registry.
- The setup hook binds the Dev Tools component to the owning Dash application and tracks Dash's resolved debug state.
- Callback, component-library, Hook-library, and server-resource data are exposed through debug-gated application routes.
- The React interface is compiled as an IIFE bundle and uses the React and ReactDOM instances supplied by Dash.
- Component inspection reads the active Dash layout through the browser component API and resolves rendered elements through their React tree.
- State snapshots serialize JSON-safe component props in the browser and restore them with `dash_clientside.set_props`.

## Contributing

Contributions are welcome. Before opening a pull request:

1. Update source files and rebuild frontend assets when necessary.
2. Run the Python and frontend test suites.
3. Run Ruff linting and formatting checks.
4. Keep generated caches, local environments, and build archives out of the commit.

## License

[MIT](./LICENSE)
