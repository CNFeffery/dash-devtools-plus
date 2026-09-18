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

The package exposes a `dash_hooks` entry point. Once installed, Dash automatically discovers and registers the integration. You do not need to import `dash_devtools_plus` or call `configure_devtools_plus()` for the default setup.

## 🪄 Minimal application (default setup)

Create and run your Dash application normally:

```python
from dash import Dash, html

app = Dash(__name__)
app.layout = html.Div("Hello, Dash Devtools Plus")

if __name__ == "__main__":
    app.run(debug=True)
```

Open the application, then select **Devtools Plus** in Dash's native bottom-right toolbar.

To override a default setting, call `configure_devtools_plus()` before constructing `Dash`; see [Configuration](configuration.md).

## FastAPI backend

FastAPI backends require Dash 4.2 or later. Install the optional dependency
set, then either use `backend="fastapi"` or pass an existing `FastAPI` server
to `Dash`:

```bash
pip install "dash-devtools-plus[fastapi]"
```

```python
from fastapi import FastAPI
from dash import Dash, html

server = FastAPI()
app = Dash(__name__, server=server)
app.layout = html.Div("Dash with FastAPI")
```

Run an application that supplies its own FastAPI server with Uvicorn. The
repository's [`fastapi` example](../../examples/fastapi/app.py) includes a
Dash callback and an asynchronous `/api/health` endpoint.

### Streaming with WebSocket callbacks

The FastAPI example also demonstrates Dash 4.2's WebSocket callbacks. It
enables `websocket_callbacks=True`, starts an `async def` persistent callback
for each browser session, reads the current controls with
`await ctx.websocket.get_prop(...)`, and streams component updates with
`set_props(...)`. The optional FastAPI dependency installs `uvicorn[standard]`,
which provides the WebSocket implementation needed by Uvicorn.

## 🧯 When the panel is unavailable

The integration intentionally stays hidden unless both conditions are true:

1. Dash is running in debug mode.
2. Dash's native Dev Tools UI is enabled.

This keeps callback source locations, runtime inventories, and server telemetry out of a normal production session. See [Configuration](configuration.md) for source-root and editor settings.
