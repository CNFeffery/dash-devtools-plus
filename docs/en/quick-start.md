# ⚡ Quick start

Dash Devtools Plus is a Dash application development and debugging enhancement plugin ✨, powered by Dash Hooks. It adds a workspace to Dash's native Dev Tools toolbar; it does not replace the toolbar or modify production behavior.

## ✅ Requirements

- Python 3.9 or later
- Dash 3.4.0 or later
- A Dash app started with both debug mode and the native Dev Tools UI enabled

## 📦 Install

```bash
pip install dash-devtools-plus -U
```

The package exposes a `dash_hooks` entry point. Dash discovers it when the package is installed, so importing the package is enough to register the integration.

## 🪄 Minimal application

Call `configure_devtools_plus` before constructing `Dash` when you want to set options. The call is optional if the defaults work for your project.

```python
from dash import Dash, html
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(default_locale="en")

app = Dash(__name__)
app.layout = html.Div("Hello, Dash Devtools Plus")

if __name__ == "__main__":
    app.run(debug=True)
```

Open the application, then select **Devtools Plus** in Dash's native bottom-right toolbar.

## 🧯 When the panel is unavailable

The integration intentionally stays hidden unless both conditions are true:

1. Dash is running in debug mode.
2. Dash's native Dev Tools UI is enabled.

This keeps callback source locations, runtime inventories, and server telemetry out of a normal production session. See [Configuration](configuration.md) for source-root and editor settings.
