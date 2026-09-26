"""Focused callback performance example for Dash Devtools Plus."""

from __future__ import annotations

import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dash import Dash, Input, Output, dcc, html  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402

SERVER_DELAY_STEP_SECONDS = 0.5
SERVER_DELAY_LIMIT_SECONDS = 4.0
POLL_INTERVAL_MILLISECONDS = 2_000
POLL_DELAY_SECONDS = 0.35

configure_devtools_plus(
    default_locale="zh-CN",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__, assets_folder=str(Path(__file__).parent / "assets"))
app.title = "回调性能监控 · Dash Devtools Plus"


def callback_card(
    number: str,
    callback_type: str,
    title: str,
    description: str,
    control,
    result_id: str,
    initial_result: str,
    accent: str,
):
    """Build one compact callback demonstration card."""

    return html.Section(
        [
            html.Div(
                [
                    html.Span(number, className="card-number"),
                    html.Span(callback_type, className="callback-type"),
                ],
                className="card-meta",
            ),
            html.H2(title),
            html.P(description, className="card-description"),
            control,
            html.Div(
                [
                    html.Span("最近结果", className="result-label"),
                    html.Strong(initial_result, id=result_id),
                ],
                className="callback-result",
            ),
        ],
        className="callback-card",
        style={"--accent": accent},
    )


app.layout = html.Main(
    [
        dcc.Interval(
            id="poll-interval",
            interval=POLL_INTERVAL_MILLISECONDS,
            n_intervals=0,
        ),
        html.Header(
            [
                html.Div(
                    [
                        html.P("CALLBACK PERFORMANCE LAB", className="eyebrow"),
                        html.H1("三条回调，三种耗时特征。"),
                    ]
                ),
                html.P(
                    "依次触发下方回调，再打开 Dash Dev Tools 中的 Devtools Plus → "
                    "回调关系，对比执行次数、平均耗时、最近耗时与传输量。",
                    className="intro",
                ),
            ],
            className="page-header",
        ),
        html.Div(
            [
                callback_card(
                    "01",
                    "服务端 · 递增耗时",
                    "点击越多，等待越久",
                    "每次点击增加 0.5 秒后端等待，最高 4 秒，用于观察耗时趋势。",
                    html.Button(
                        "触发服务端回调",
                        id="server-delay-button",
                        n_clicks=0,
                        className="action-button",
                    ),
                    "server-delay-result",
                    "等待点击",
                    "#e05d3f",
                ),
                callback_card(
                    "02",
                    "服务端 · 自动轮询",
                    "固定节奏，固定等待",
                    "每 2 秒自动触发一次，后端固定等待 0.35 秒，用于累积稳定样本。",
                    html.Div(
                        [html.Span(className="pulse-dot"), "轮询运行中"],
                        className="poll-status",
                    ),
                    "poll-result",
                    "等待第一次轮询",
                    "#16876f",
                ),
                callback_card(
                    "03",
                    "浏览器端 · 即时响应",
                    "只计数，不等待",
                    "逻辑在浏览器中执行，不经过后端 sleep，可与服务端耗时直接对比。",
                    html.Button(
                        "触发浏览器端回调",
                        id="client-button",
                        n_clicks=0,
                        className="action-button",
                    ),
                    "client-result",
                    "等待点击",
                    "#2f65b8",
                ),
            ],
            className="callback-grid",
        ),
        html.Footer(
            [
                html.Span("观察建议"),
                html.P(
                    "先连续点击两侧按钮数次，再在回调详情底部查看最近 30 次执行的"
                    "服务端与网络耗时。"
                ),
            ]
        ),
    ],
    className="performance-shell",
)


@app.callback(
    Output("server-delay-result", "children"),
    Input("server-delay-button", "n_clicks"),
    prevent_initial_call=True,
)
def handle_server_click(n_clicks: int | None) -> str:
    """Wait longer as the cumulative server-button click count increases."""

    click_count = int(n_clicks or 0)
    delay = min(
        click_count * SERVER_DELAY_STEP_SECONDS,
        SERVER_DELAY_LIMIT_SECONDS,
    )
    time.sleep(delay)
    return f"已完成第 {click_count} 次点击 · 本次等待 {delay:.1f} 秒"


@app.callback(
    Output("poll-result", "children"),
    Input("poll-interval", "n_intervals"),
    prevent_initial_call=True,
)
def handle_poll(n_intervals: int | None) -> str:
    """Apply a fixed server delay to every interval-triggered poll."""

    poll_count = int(n_intervals or 0)
    time.sleep(POLL_DELAY_SECONDS)
    return f"已完成第 {poll_count} 次轮询 · 固定等待 {POLL_DELAY_SECONDS:.2f} 秒"


app.clientside_callback(
    """
    function (nClicks) {
        const clickCount = Number(nClicks || 0);
        return `已完成第 ${clickCount} 次点击 · 浏览器端即时更新`;
    }
    """,
    Output("client-result", "children"),
    Input("client-button", "n_clicks"),
    prevent_initial_call=True,
)


if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False,
        dev_tools_disable_version_check=True,
        port=8050,
    )
