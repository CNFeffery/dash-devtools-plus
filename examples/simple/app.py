"""Minimal Dash Devtools Plus example with one server and one client callback."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dash import Dash, Input, Output, dcc, html  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402

configure_devtools_plus(
    default_locale="en",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__, assets_folder=str(Path(__file__).parent / "assets"))
app.title = "Simple Example · Dash Devtools Plus"

app.layout = html.Main(
    [
        html.Header(
            [
                html.P("SIMPLE CALLBACK SAMPLE", className="eyebrow"),
                html.H1("Two callbacks at a glance."),
                html.P(
                    "A Python server-side callback generates a greeting, while a "
                    "clientside callback updates the signal strength.",
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
                                html.Label("Your name", htmlFor="name-input"),
                                dcc.Input(
                                    id="name-input",
                                    value="Dash developer",
                                    placeholder="Enter your name",
                                    debounce=True,
                                ),
                            ],
                        ),
                    ],
                    className="control-row",
                ),
                html.Div(id="server-greeting", className="result-card"),
            ],
            className="demo-card server-card",
        ),
        html.Section(
            [
                html.Div(
                    [
                        html.Span("02", className="step-number"),
                        html.Div(
                            [
                                html.Label("Browser signal", htmlFor="signal-slider"),
                                dcc.Slider(
                                    id="signal-slider",
                                    min=0,
                                    max=100,
                                    step=10,
                                    value=60,
                                    marks={0: "0", 50: "50", 100: "100"},
                                ),
                            ],
                        ),
                    ],
                    className="control-row slider-row",
                ),
                html.Div(
                    [
                        html.Div(id="signal-fill", className="signal-fill"),
                        html.Strong(id="signal-label"),
                    ],
                    className="signal-track",
                ),
            ],
            className="demo-card client-card",
        ),
        html.Footer(
            "Open Devtools Plus in Dash Dev Tools to explore these two callbacks."
        ),
    ],
    className="simple-shell",
)


@app.callback(Output("server-greeting", "children"), Input("name-input", "value"))
def create_greeting(name: str | None) -> str:
    """Create a server-rendered greeting for the supplied name."""

    return (
        f"Hello, {(name or 'friend').strip() or 'friend'}! This message is from Python."
    )


app.clientside_callback(
    """
    function (value) {
        const level = Number(value || 0);
        const label = level >= 80 ? "Strong" : level >= 40 ? "Steady" : "Weak";
        return [
            {width: `${level}%`},
            `${level}% · ${label}`
        ];
    }
    """,
    Output("signal-fill", "style"),
    Output("signal-label", "children"),
    Input("signal-slider", "value"),
)


if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False,
        dev_tools_disable_version_check=True,
        port=8050,
    )
