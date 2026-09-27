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
    default_locale="en",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__, assets_folder=str(Path(__file__).parent / "assets"))
app.title = "Callback Performance Monitor · Dash Devtools Plus"


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
                    html.Span("Latest result", className="result-label"),
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
                        html.H1("Three callbacks, three timing patterns."),
                    ]
                ),
                html.P(
                    "Trigger the callbacks below, then open Devtools Plus → "
                    "Callback relationships in Dash Dev Tools to compare execution "
                    "counts, average and latest durations, and transfer sizes.",
                    className="intro",
                ),
            ],
            className="page-header",
        ),
        html.Div(
            [
                callback_card(
                    "01",
                    "Server-side · Increasing delay",
                    "More clicks, longer waits",
                    "Each click adds 0.5 seconds of server delay, up to 4 seconds, "
                    "so you can observe timing trends.",
                    html.Button(
                        "Run server-side callback",
                        id="server-delay-button",
                        n_clicks=0,
                        className="action-button",
                    ),
                    "server-delay-result",
                    "Waiting for a click",
                    "#e05d3f",
                ),
                callback_card(
                    "02",
                    "Server-side · Automatic polling",
                    "Steady pace, fixed delay",
                    "Runs automatically every 2 seconds with a fixed 0.35-second "
                    "server delay to collect consistent samples.",
                    html.Div(
                        [html.Span(className="pulse-dot"), "Polling active"],
                        className="poll-status",
                    ),
                    "poll-result",
                    "Waiting for the first poll",
                    "#16876f",
                ),
                callback_card(
                    "03",
                    "Clientside · Instant response",
                    "Count clicks without waiting",
                    "Runs in the browser with no server delay, so you can compare "
                    "its timing directly with the server-side callbacks.",
                    html.Button(
                        "Run clientside callback",
                        id="client-button",
                        n_clicks=0,
                        className="action-button",
                    ),
                    "client-result",
                    "Waiting for a click",
                    "#2f65b8",
                ),
            ],
            className="callback-grid",
        ),
        html.Footer(
            [
                html.Span("What to look for"),
                html.P(
                    "Click both buttons several times, then check the server and "
                    "network durations for the last 30 executions at the bottom "
                    "of the callback details."
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
    return f"Click {click_count} completed · Delay: {delay:.1f} s"


@app.callback(
    Output("poll-result", "children"),
    Input("poll-interval", "n_intervals"),
    prevent_initial_call=True,
)
def handle_poll(n_intervals: int | None) -> str:
    """Apply a fixed server delay to every interval-triggered poll."""

    poll_count = int(n_intervals or 0)
    time.sleep(POLL_DELAY_SECONDS)
    return f"Poll {poll_count} completed · Fixed delay: {POLL_DELAY_SECONDS:.2f} s"


app.clientside_callback(
    """
    function (nClicks) {
        const clickCount = Number(nClicks || 0);
        return `Click ${clickCount} completed · Instant browser update`;
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
