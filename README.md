<p align="center">
  <img src="./imgs/devtools-plus-logo.svg" width="104" alt="Dash Devtools Plus logo">
</p>

<h1 align="center">Dash Devtools Plus</h1>

<p align="center">
  A development-only workspace for inspecting and understanding Dash applications, powered by Dash Hooks.
</p>

<p align="center">
  English | <a href="./README-zh_CN.md">简体中文</a>
</p>

Dash Devtools Plus extends Dash's native Dev Tools with a focused drawer for callback relationships, component inspection, state snapshots, direct imports, server resources, and toolbar appearance. It is available only in an explicitly debug-enabled Dash session, so development metadata stays out of ordinary production use.

## Open Devtools Plus

Start a Dash application in debug mode, then select **Devtools Plus** from the native toolbar in the lower-right corner.

![Open Dash Devtools Plus from the native toolbar](./imgs/docs/entry-point.png)

The drawer keeps the running application visible while you inspect it.

![Dash Devtools Plus main panel](./imgs/docs/main-panel.png)

## Quick start

```bash
pip install dash-devtools-plus
```

```python
from dash import Dash, html
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(default_locale="en")

app = Dash(__name__)
app.layout = html.Div("Hello, Dash Devtools Plus")

if __name__ == "__main__":
    app.run(debug=True)
```

The package is discovered through Dash Hooks after installation. When configuration is needed, call `configure_devtools_plus` before creating the `Dash` instance. The panel appears only when debug mode and Dash's native Dev Tools UI are both enabled.

For full installation notes, see [Quick start](./docs/en/quick-start.md).

## Workspaces

| Workspace | What it provides | Documentation |
| --- | --- | --- |
| Server resource monitor | Live CPU, memory, disk, and host/runtime information. | [Open guide](./docs/en/features/server-metrics.md) |
| Callback relationships | Searchable callback graph data, source locations, role lists, docstrings, and execution metadata. | [Open guide](./docs/en/features/callbacks.md) |
| Component inspector | Click a rendered page element and map it to its Dash component, layout path, and current props. | [Open guide](./docs/en/features/component-inspector.md) |
| State snapshots | Capture selected component props and restore them within the current browser tab. | [Open guide](./docs/en/features/state-snapshots.md) |
| Imported dependencies | Direct project imports grouped as standard library, Dash components, Dash Hooks, or other libraries. | [Open guide](./docs/en/features/dependencies.md) |
| Toolbar skins | Preview and apply native Dash Dev Tools toolbar and error-display themes. | [Open guide](./docs/en/features/toolbar-skins.md) |

## Configuration

```python
from pathlib import Path
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(
    default_locale="en",
    accent_color="#119DFF",
    editor="vscode",
    project_root=Path(__file__).resolve().parent,
)
```

| Parameter | Default | Summary |
| --- | --- | --- |
| `default_locale` | `"en"` | Initial interface language: `"en"` or `"zh-CN"`. |
| `accent_color` | `"#119DFF"` | Primary UI accent color. |
| `editor` | `"vscode"` | Preferred source editor: `"vscode"`, `"cursor"`, `"pycharm"`, or `None`. |
| `project_root` | `None` | Existing project directory used as the server-side source and direct-import boundary. |
| `editor_project_root` | `None` | Editor-visible root when the browser/IDE and Dash server use different paths. |

See [Configuration](./docs/en/configuration.md) for behavior, validation rules, and container-to-local editor examples.

## Example applications

Three applications in [`examples/`](./examples/) cover increasingly complex use cases:

| Example | Focus | Run |
| --- | --- | --- |
| `simple` | One server callback and one clientside callback. | `python examples/simple/app.py` |
| `intermediate` | A travel-budget planner built with Dash core components. | `python examples/intermediate/app.py` |
| `comprehensive` | A large callback laboratory for acceptance testing all workspaces. | `python examples/comprehensive/app.py` |

They share port `8050`; run one at a time. Read [Example applications](./docs/en/examples.md) before using the comprehensive callback laboratory.

## Development

Use the project environments described by the repository setup, then run:

```bash
python -m pytest
npm run test:frontend
npm run build
```

Python code is checked with Ruff:

```bash
ruff check .
ruff format --check .
```

The frontend build writes distributable assets to `dash_devtools_plus/assets/`; commit those generated files whenever frontend source changes.

## Documentation map

- [English documentation index](./docs/en/README.md)
- [Quick start](./docs/en/quick-start.md)
- [Configuration](./docs/en/configuration.md)
- [Example applications](./docs/en/examples.md)
- [中文文档中心](./docs/zh-CN/README.md)

## License

Released under the [MIT License](./LICENSE).
