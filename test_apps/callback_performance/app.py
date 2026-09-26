"""Manual/browser regression fixture for callback profiling (port 8057)."""

import time
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dash import Dash, Input, Output, ctx, html  # noqa: E402
from dash.exceptions import PreventUpdate  # noqa: E402
from dash_devtools_plus import configure_devtools_plus  # noqa: E402

configure_devtools_plus(default_locale="zh-CN", project_root=ROOT)
app = Dash(__name__)
app.layout = html.Div(
    [
        html.Button("成功回调", id="success"),
        html.Button("失败回调", id="failure"),
        html.Button("无更新回调", id="no-update"),
        html.Button("客户端回调", id="client"),
        html.Div(id="result"),
        html.Div(id="client-result"),
    ],
    style={"padding": "40px"},
)


@app.callback(
    Output("result", "children"),
    Input("success", "n_clicks"),
    Input("failure", "n_clicks"),
    Input("no-update", "n_clicks"),
    prevent_initial_call=True,
)
def monitored_callback(success, _failure, _no_update):
    """Exercise success, custom timing, HTTP 500 and PreventUpdate."""
    if ctx.triggered_id == "failure":
        raise ValueError("Intentional performance regression fixture failure")
    if ctx.triggered_id == "no-update":
        raise PreventUpdate
    started = time.perf_counter()
    time.sleep(0.02)
    ctx.record_timing("work", time.perf_counter() - started)
    return f"Success {success}"


app.clientside_callback(
    "async function(n) { await new Promise(r => setTimeout(r, 25)); return n; }",
    Output("client-result", "children"),
    Input("client", "n_clicks"),
    prevent_initial_call=True,
)

if __name__ == "__main__":
    app.run(
        debug=True, use_reloader=False, dev_tools_disable_version_check=True, port=8057
    )
