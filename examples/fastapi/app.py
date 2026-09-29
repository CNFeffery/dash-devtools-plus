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
from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402

configure_devtools_plus(
    default_locale="en",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

server = FastAPI(docs_url="/api/docs", redoc_url="/api/redoc")
app = Dash(__name__, server=server, websocket_callbacks=True)
app.title = "FastAPI Example · Dash Devtools Plus"


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


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80, examples=["Review API docs"])
    priority: int = Field(default=2, ge=1, le=5, description="1 is the highest priority")


class Task(TaskCreate):
    id: int
    completed: bool = False


demo_tasks: dict[int, Task] = {
    1: Task(id=1, title="Explore Swagger UI", priority=1),
    2: Task(id=2, title="Compare the ReDoc view", priority=2, completed=True),
}


@server.get("/api/tasks", response_model=list[Task], tags=["Demo tasks"])
async def list_tasks(completed: bool | None = None) -> list[Task]:
    """Filter the example tasks by completion status."""

    return [
        task for task in demo_tasks.values()
        if completed is None or task.completed == completed
    ]


@server.get("/api/tasks/{task_id}", response_model=Task, tags=["Demo tasks"])
async def get_task(task_id: int) -> Task:
    """Look up one example task by its path parameter."""

    if task_id not in demo_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return demo_tasks[task_id]


@server.post("/api/tasks", response_model=Task, status_code=201, tags=["Demo tasks"])
async def create_task(task: TaskCreate) -> Task:
    """Create an in-memory task from a validated JSON request body."""

    task_id = max(demo_tasks, default=0) + 1
    created = Task(id=task_id, title=task.title, priority=task.priority)
    demo_tasks[task_id] = created
    return created


app.layout = html.Div(
    html.Main(
        [
            html.Header(
                [
                    html.P("FASTAPI + WEBSOCKET", className="eyebrow"),
                    html.H1("A live heartbeat without polling."),
                    html.P(
                        "This page is served by FastAPI. A persistent WebSocket "
                        "callback reads the slider value and pushes server time "
                        "updates to the browser.",
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
                                    html.Label("Push interval", htmlFor="refresh-rate"),
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
                    "Persistent callback: ctx.websocket.get_prop → set_props · ",
                    html.A(
                        "View FastAPI health check", href="/api/health", target="_blank"
                    ),
                    " · ",
                    html.A("Browse API docs", href="/api/docs", target="_blank"),
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
            {"children": f"WebSocket update received · Update interval: {seconds:g} s"},
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
