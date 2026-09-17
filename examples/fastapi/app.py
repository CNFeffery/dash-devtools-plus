"""Small FastAPI and WebSocket callback example for Dash Devtools Plus."""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dash import Dash, ctx, dcc, html, set_props  # noqa: E402
from dash.exceptions import WebsocketDisconnected  # noqa: E402
from fastapi import FastAPI  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402

configure_devtools_plus(
    default_locale="zh-CN",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__, backend="fastapi", websocket_callbacks=True)
server: FastAPI = app.server
app.title = "FastAPI 示例 · Dash Devtools Plus"


@server.get("/api/health")
async def health() -> dict[str, str]:
    """Expose a native asynchronous FastAPI route beside Dash."""

    await asyncio.sleep(0)
    return {"status": "ok", "backend": "fastapi"}


@server.get("/api/capabilities")
async def capabilities() -> dict[str, Any]:
    """Expose the backend features used by this small example."""

    await asyncio.sleep(0)
    return {
        "streaming": True,
        "persistentCallback": True,
        "features": ["get_prop", "set_props", "asyncio", "FastAPI"],
    }


app.layout = html.Div(
    html.Main(
        [
            html.Header(
                [
                    html.P("FASTAPI + WEBSOCKET", className="eyebrow"),
                    html.H1("实时心跳，不需要轮询。"),
                    html.P(
                        "这个页面由 FastAPI 承载。持久 WebSocket 回调会读取滑块值，"
                        "并把服务器时间主动推送回来。",
                        className="lede",
                    ),
                ],
                className="hero",
            ),
            html.Section(
                [
                    html.Div(
                        [
                            html.Span("01", className="step-number"),
                            html.Div(
                                [
                                    html.P("SERVER PUSH", className="card-label"),
                                    html.Div(id="live-clock", className="live-clock"),
                                    html.P(
                                        id="stream-status", className="stream-status"
                                    ),
                                ]
                            ),
                        ],
                        className="control-row",
                    ),
                    html.Div(
                        [
                            html.Span("02", className="step-number"),
                            html.Div(
                                [
                                    html.Label("推送间隔", htmlFor="refresh-rate"),
                                    dcc.Slider(
                                        id="refresh-rate",
                                        min=0.5,
                                        max=2,
                                        step=0.5,
                                        value=1,
                                        marks={
                                            0.5: "0.5s",
                                            1: "1s",
                                            1.5: "1.5s",
                                            2: "2s",
                                        },
                                    ),
                                ],
                            ),
                        ],
                        className="control-row slider-row",
                    ),
                ],
                className="demo-card fastapi-card",
            ),
            html.Footer(
                [
                    "持久回调：ctx.websocket.get_prop → set_props · ",
                    html.A(
                        "查看 FastAPI 健康检查", href="/api/health", target="_blank"
                    ),
                ]
            ),
        ],
        className="fastapi-shell",
    ),
    className="fastapi-page",
)


@app.callback(websocket=True, persistent=True)
async def stream_server_time() -> None:
    """Push time updates and read the current browser-selected interval."""

    websocket = ctx.websocket
    if websocket is None:
        return

    while not websocket.is_shutdown:
        try:
            interval = await websocket.get_prop("refresh-rate", "value", timeout=4)
        except TimeoutError:
            continue
        except WebsocketDisconnected:
            break

        seconds = float(interval or 1)
        now = datetime.now().strftime("%H:%M:%S")
        set_props("live-clock", {"children": now})
        set_props(
            "stream-status",
            {"children": f"WebSocket 已推送 · 每 {seconds:g} 秒更新一次"},
        )
        await asyncio.sleep(seconds)


if __name__ == "__main__":
    app.run(
        debug=True,
        # Dash's FastAPI backend delegates code reloading to Uvicorn. Keeping it
        # enabled ensures callback metadata and the file open in the IDE refer
        # to the same version of this example after a source edit.
        reload=True,
        dev_tools_disable_version_check=True,
        port=8050,
    )
