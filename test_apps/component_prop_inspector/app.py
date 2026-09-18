"""Reproduce component-inspector leaks from component-valued props."""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from dash import Dash, Input, Output, dcc, html  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402
from test_components import ComponentPropCarrier  # noqa: E402

configure_devtools_plus(
    default_locale="zh-CN",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__)
app.title = "Component prop inspector regression"


def bulk_cards(
    count: int = 180,
    *,
    prefix: str = "bulk",
    description: str = "Unrelated Tab children",
) -> list:
    """Create enough unrelated components to make a hierarchy leak obvious."""

    return [
        html.Article(
            [
                html.Strong(
                    f"{prefix.title()} card {index:03d}",
                    id=f"{prefix}-title-{index}",
                ),
                html.Span(description, id=f"{prefix}-copy-{index}"),
            ],
            id=f"{prefix}-card-{index}",
            style={
                "border": "1px solid #dbe4ee",
                "borderRadius": "8px",
                "padding": "8px 10px",
                "background": "white",
            },
        )
        for index in range(count)
    ]


app.layout = html.Main(
    [
        html.Header(
            [
                html.P("COMPONENT INSPECTOR REGRESSION", style={"letterSpacing": "0.12em"}),
                html.H1("Component-valued prop hierarchy isolation"),
                html.P(
                    "Inspect the first Tab itself. Its label contains one component; "
                    "the large card collection belongs to the separate children prop."
                ),
            ],
            style={"marginBottom": "24px"},
        ),
        html.Div(
            [
                html.Span(f"Outer decoy {index}", id=f"outer-decoy-{index}")
                for index in range(24)
            ],
            id="outer-decoy-region",
            style={"display": "none"},
        ),
        dcc.Tabs(
            [
                dcc.Tab(
                    html.Div(
                        bulk_cards(),
                        id="bulk-card-region",
                        style={
                            "display": "grid",
                            "gridTemplateColumns": "repeat(3, minmax(0, 1fr))",
                            "gap": "8px",
                            "padding": "16px 0",
                        },
                    ),
                    id="component-prop-target-tab",
                    label=html.Span(
                        "Expected label component",
                        id="expected-label-component",
                        style={
                            "display": "inline-block",
                            "padding": "2px 8px",
                            "border": "1px solid currentColor",
                            "borderRadius": "999px",
                        },
                    ),
                    value="target",
                ),
                dcc.Tab(
                    html.Div("Control tab content", id="control-tab-content"),
                    id="control-tab",
                    label="Control tab",
                    value="control",
                ),
            ],
            id="component-prop-tabs",
            value="target",
        ),
        html.Section(
            [
                html.H2("Forwarded component prop"),
                html.P(
                    "Inspect the bordered carrier. Its slot contains one component; "
                    "the 72 cards belong only to children."
                ),
                ComponentPropCarrier(
                    bulk_cards(
                        72,
                        prefix="forwarded-noise",
                        description="Unrelated forwarded children",
                    ),
                    id="forwarded-component-prop-target",
                    slot=html.Span(
                        "Expected forwarded slot",
                        id="expected-forwarded-slot-component",
                    ),
                ),
            ],
            style={"marginTop": "28px"},
        ),
        html.Section(
            [
                html.H2("Secondary component prop"),
                html.Button("Trigger loading", id="loading-trigger", n_clicks=0),
                dcc.Loading(
                    html.Div("Idle", id="loading-output"),
                    id="component-prop-loading",
                    custom_spinner=html.Div(
                        "Expected custom spinner",
                        id="expected-spinner-component",
                    ),
                    delay_show=0,
                ),
            ],
            style={"marginTop": "28px"},
        ),
    ],
    id="test-app-root",
    style={
        "fontFamily": "Arial, sans-serif",
        "maxWidth": "1180px",
        "margin": "0 auto",
        "padding": "32px 24px",
        "color": "#183247",
    },
)


@app.callback(Output("loading-output", "children"), Input("loading-trigger", "n_clicks"))
def update_loading_output(n_clicks: int) -> str:
    """Keep the loading target connected to a real callback."""

    return f"Callback completed {n_clicks} time(s)"


if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False,
        dev_tools_disable_version_check=True,
        port=int(os.getenv("DASH_TEST_PORT", "8061")),
    )
