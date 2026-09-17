"""Compatibility checks for Dash's FastAPI backend."""

# pytest.importorskip must run before importing FastAPI-dependent modules.
# ruff: noqa: E402
from __future__ import annotations

import inspect

import pytest

fastapi = pytest.importorskip("fastapi")
from dash import Dash, Input, Output, html
from fastapi.testclient import TestClient

import dash_devtools_plus  # noqa: F401


DEVTOOLS_ENDPOINTS = (
    "/_dash-devtools-plus/callbacks",
    "/_dash-devtools-plus/dependencies",
    "/_dash-devtools-plus/component-libraries",
    "/_dash-devtools-plus/hook-libraries",
    "/_dash-devtools-plus/server-metrics",
)


def enable_dev_tools(app: Dash) -> None:
    app.enable_dev_tools(
        debug=True,
        dev_tools_ui=True,
        dev_tools_disable_version_check=True,
        dev_tools_hot_reload=False,
    )


def test_fastapi_backend_serves_devtools_endpoints_and_callbacks():
    app = Dash(__name__, backend="fastapi")
    app.layout = html.Div([html.Button("Run", id="run"), html.Div(id="result")])

    @app.callback(Output("result", "children"), Input("run", "n_clicks"))
    def show_run_count(n_clicks: int | None) -> str:
        return f"runs: {n_clicks or 0}"

    enable_dev_tools(app)
    client = TestClient(app.server)

    for endpoint in DEVTOOLS_ENDPOINTS:
        response = client.get(endpoint)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store, max-age=0"
        assert response.headers["x-content-type-options"] == "nosniff"

    callback_response = client.post(
        "/_dash-update-component",
        json={
            "output": "result.children",
            "outputs": {"id": "result", "property": "children"},
            "inputs": [{"id": "run", "property": "n_clicks", "value": 1}],
            "changedPropIds": ["run.n_clicks"],
            "state": [],
        },
    )
    metadata_response = client.get("/_dash-devtools-plus/callbacks")

    assert callback_response.status_code == 200
    assert callback_response.json()["response"]["result"]["children"] == "runs: 1"
    assert metadata_response.json()[0]["output"] == "result.children"


def test_fastapi_server_and_prefixed_devtools_routes_coexist():
    server = fastapi.FastAPI()

    @server.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app = Dash(__name__, server=server, routes_pathname_prefix="/dashboard/")
    app.layout = html.Div("FastAPI server")
    enable_dev_tools(app)
    client = TestClient(server)

    health_response = client.get("/api/health")
    route_response = client.get("/dashboard/_dash-devtools-plus/server-metrics")
    unprefixed_response = client.get("/_dash-devtools-plus/server-metrics")

    assert health_response.json() == {"status": "ok"}
    assert route_response.status_code == 200
    assert unprefixed_response.status_code == 404


def test_fastapi_example_serves_dash_and_its_async_api():
    from examples.fastapi.app import app, server, stream_server_time

    enable_dev_tools(app)
    client = TestClient(server)

    assert client.get("/").status_code == 200
    assert client.get("/_dash-layout").status_code == 200
    assert client.get("/api/health").json() == {
        "status": "ok",
        "backend": "fastapi",
    }
    assert client.get("/api/capabilities").json()["persistentCallback"] is True
    callback_metadata = client.get("/_dash-devtools-plus/callbacks")

    assert callback_metadata.status_code == 200
    source = callback_metadata.json()[0]["source"]
    assert source["function"] == "stream_server_time"
    assert source["path"] == "examples/fastapi/app.py"
    assert source["line"] == inspect.getsourcelines(stream_server_time)[1]
    assert source["editorUri"].endswith(
        f"/examples/fastapi/app.py:{source['line']}:1"
    )
    assert app._websocket_callbacks is True
    assert any(
        callback.get("websocket") and callback.get("persistent")
        for callback in app._callback_list
    )


@pytest.mark.parametrize("endpoint", DEVTOOLS_ENDPOINTS)
def test_fastapi_routes_remain_hidden_without_debug(endpoint: str):
    app = Dash(__name__, backend="fastapi")
    app.layout = html.Div("FastAPI server")

    response = TestClient(app.server).get(endpoint)

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store, max-age=0"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_comprehensive_demo_hook_is_backend_agnostic():
    from examples.comprehensive import demo_hooks

    app = type("App", (), {"server": fastapi.FastAPI()})()
    demo_hooks.annotate_demo_app(app)

    assert app._devtools_plus_demo_hooks is True
