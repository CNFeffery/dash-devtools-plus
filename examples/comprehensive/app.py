"""A callback laboratory for exercising Dash Devtools Plus."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from dash import (
    ALL,
    ALLSMALLER,
    MATCH,
    Dash,
    Input,
    Output,
    Patch,
    State,
    ctx,
    dash_table,
    dcc,
    html,
    set_props,
)

from dash_devtools_plus import configure_devtools_plus
import feffery_antd_components as fac
import dash_mantine_components as dmc  # noqa: F401 - loaded for library discovery

try:
    from . import demo_hooks as _demo_hooks  # noqa: F401
except ImportError:  # Support direct script execution during local development.
    example_dir = str(Path(__file__).resolve().parent)
    if example_dir not in sys.path:
        sys.path.insert(0, example_dir)
    import demo_hooks as _demo_hooks  # type: ignore[no-redef]  # noqa: F401

PROJECT_ROOT = Path(__file__).resolve().parents[2]

configure_devtools_plus(
    default_locale="en", project_root=PROJECT_ROOT, editor_project_root=PROJECT_ROOT
)

app = Dash(
    __name__,
    assets_folder=str(Path(__file__).parent / "assets"),
    suppress_callback_exceptions=True,
)
app.title = "Dash Devtools Plus Callback Laboratory"


CHAIN_COUNT = 42
FANOUT_COUNT = 24
MERGE_COUNT = 12
STATEFUL_COUNT = 10
MULTI_OUTPUT_COUNT = 6
CLIENTSIDE_COUNT = 10
HIDDEN_COUNT = 5
INITIAL_PATTERN_ROWS = 6
SIDE_EFFECT_EVENTS: list[str] = []
INSPECTION_ROWS = [
    {
        "service": f"worker-{index:02d}",
        "status": "healthy" if index % 4 else "watch",
        "latency": 18 + index * 3,
        "requests": 1240 + index * 137,
        "region": ["Hangzhou", "Shanghai", "Singapore"][index % 3],
    }
    for index in range(1, 14)
]


def numeric_value(payload: Any) -> float:
    """Extract a numeric value from a callback payload."""

    if isinstance(payload, dict):
        payload = payload.get("value", 0)
    try:
        return float(payload or 0)
    except (TypeError, ValueError):
        return 0


def pattern_row(index: int) -> html.Div:
    """Create one row used by the MATCH/ALL/ALLSMALLER examples."""

    return html.Div(
        [
            html.Span(f"Node {index + 1:02d}", className="pattern-node-label"),
            dcc.Input(
                id={"type": "pattern-input", "index": index},
                type="number",
                value=(index + 1) * 3,
                debounce=True,
            ),
            dcc.Dropdown(
                id={"type": "pattern-operation", "index": index},
                value="double",
                clearable=False,
                options=[
                    {"label": "Double", "value": "double"},
                    {"label": "Square", "value": "square"},
                ],
            ),
            html.Code(id={"type": "pattern-output", "index": index}),
            html.Span(
                id={"type": "pattern-prefix", "index": index}, className="prefix-value"
            ),
        ],
        className="pattern-row",
    )


# -- Control and status callbacks -------------------------------------------------


@app.callback(
    Output("seed-store", "data"),
    Input("run-pipeline", "n_clicks"),
    State("seed-slider", "value"),
    State("run-label", "value"),
    running=[(Output("run-pipeline", "disabled"), True, False)],
    prevent_initial_call=True,
)
def publish_seed(n_clicks: int, value: float, label: str) -> dict[str, Any]:
    """Publish a normalized seed payload to the callback laboratory.

    Payload fields:
        value: Numeric seed used by downstream callback families.
        run: Current pipeline execution counter.
        label: Human-readable label entered in the control panel.
        trigger: Component that initiated the current execution.
    """

    return {
        "value": numeric_value(value),
        "run": n_clicks,
        "label": label or "untitled",
        "trigger": ctx.triggered_id,
    }


@app.callback(
    Output("seed-preview", "children"),
    Input("seed-store", "data"),
)
def render_seed_preview(payload: dict[str, Any] | None) -> str:
    """Render the current seed payload as a compact pipeline status line.

    Missing payloads fall back to the baseline values used when the laboratory
    first loads.
    """

    payload = payload or {"value": 7, "run": 0, "label": "baseline"}
    return f"{payload.get('label', 'baseline')} / seed {numeric_value(payload):g} / run {payload.get('run', 0)}"


@app.callback(
    Output("debug-error-output", "children"),
    Input("trigger-debug-error", "n_clicks"),
    prevent_initial_call=True,
)
def trigger_debug_error(_n_clicks: int) -> float:
    """Intentionally divide by zero to exercise native Dash error reporting.

    This callback is dormant until the error-test button is clicked. Its
    unhandled ZeroDivisionError should appear in Dash Dev Tools when debug
    mode is enabled, making native error surfaces easy to inspect.
    """

    return 1 / 0


# -- A 42-stage linear chain ------------------------------------------------------


def register_chain_callback(index: int) -> None:
    source_id = "seed-store" if index == 0 else f"chain-{index - 1}"

    def chain_stage(payload: Any) -> dict[str, Any]:
        return {
            "value": numeric_value(payload) + index + 1,
            "stage": index,
            "family": "chain",
        }

    chain_stage.__name__ = f"chain_stage_{index:02d}"
    chain_stage.__doc__ = f"""Advance linear callback stage {index:02d}.

    Data flow:
        input: {source_id}.data
        output: chain-{index}.data
        transform: Add {index + 1} to the upstream numeric value.
    """
    app.callback(
        Output(f"chain-{index}", "data"),
        Input(source_id, "data"),
        prevent_initial_call=True,
    )(chain_stage)


for chain_index in range(CHAIN_COUNT):
    register_chain_callback(chain_index)


# -- Fan-out branches, half with multiple inputs ---------------------------------


def register_fanout_callback(index: int) -> None:
    dependencies = [Input("seed-store", "data")]
    if index >= FANOUT_COUNT // 2:
        dependencies.append(Input(f"chain-{(index * 3) % CHAIN_COUNT}", "data"))

    def fanout_branch(seed: Any, upstream: Any = None) -> dict[str, Any]:
        return {
            "value": numeric_value(seed) * (index + 1) + numeric_value(upstream),
            "branch": index,
            "family": "fan-out",
        }

    fanout_branch.__name__ = f"fanout_branch_{index:02d}"
    upstream_note = (
        f"seed-store.data + chain-{(index * 3) % CHAIN_COUNT}.data"
        if index >= FANOUT_COUNT // 2
        else "seed-store.data"
    )
    fanout_branch.__doc__ = f"""Compute fan-out branch {index:02d}.

    Branch contract:
        inputs: {upstream_note}
        output: fanout-{index}.data
        multiplier: {index + 1}
    """
    app.callback(
        Output(f"fanout-{index}", "data"),
        *dependencies,
        prevent_initial_call=True,
    )(fanout_branch)


for fanout_index in range(FANOUT_COUNT):
    register_fanout_callback(fanout_index)


# -- Fan-in callbacks with several Inputs and a State -----------------------------


def register_merge_callback(index: int) -> None:
    def merge_branch(
        left: Any, right: Any, chain_value: Any, scale: float
    ) -> dict[str, Any]:
        merged = numeric_value(left) + numeric_value(right) + numeric_value(chain_value)
        return {
            "value": merged * numeric_value(scale),
            "merge": index,
            "family": "fan-in",
        }

    merge_branch.__name__ = f"merge_branch_{index:02d}"
    merge_branch.__doc__ = f"""Aggregate fan-in lane {index:02d}.

    Inputs:
        left/right: Paired fan-out branch payloads.
        chain_value: Linear-chain checkpoint for this lane.
        scale: Shared multiplier selected in the control panel.

    Output:
        merge-{index}.data containing the scaled aggregate.
    """
    app.callback(
        Output(f"merge-{index}", "data"),
        Input(f"fanout-{index * 2}", "data"),
        Input(f"fanout-{index * 2 + 1}", "data"),
        Input(f"chain-{(index * 3) % CHAIN_COUNT}", "data"),
        State("merge-scale", "value"),
        prevent_initial_call=True,
    )(merge_branch)


for merge_index in range(MERGE_COUNT):
    register_merge_callback(merge_index)


# -- Shared trigger with distinct State relationships -----------------------------


def register_stateful_callback(index: int) -> None:
    def snapshot_state(n_clicks: int, seed: float, chain_value: Any) -> dict[str, Any]:
        return {
            "value": numeric_value(chain_value) + numeric_value(seed),
            "run": n_clicks,
            "snapshot": index,
            "family": "state",
        }

    snapshot_state.__name__ = f"state_snapshot_{index:02d}"
    snapshot_state.__doc__ = f"""Capture state snapshot lane {index:02d}.

    The run button is the trigger; the seed and chain-{index * 4}.data values
    are read as State so their changes do not independently execute the callback.
    """
    app.callback(
        Output(f"stateful-{index}", "data"),
        Input("run-pipeline", "n_clicks"),
        State("seed-slider", "value"),
        State(f"chain-{index * 4}", "data"),
        prevent_initial_call=True,
    )(snapshot_state)


for stateful_index in range(STATEFUL_COUNT):
    register_stateful_callback(stateful_index)


# -- Multi-output callbacks -------------------------------------------------------


def register_multi_output_callback(index: int) -> None:
    def split_result(payload: Any, label: str) -> tuple[dict[str, Any], dict[str, Any]]:
        value = numeric_value(payload)
        common = {
            "source": index,
            "label": label or "untitled",
            "family": "multi-output",
        }
        return ({**common, "value": value}, {**common, "value": -value})

    split_result.__name__ = f"multi_output_{index:02d}"
    split_result.__doc__ = f"""Split merge lane {index:02d} into paired outputs.

    Returns:
        positive: Original numeric merge value and shared metadata.
        negative: Negated numeric value with the same metadata.
    """
    app.callback(
        Output(f"multi-positive-{index}", "data"),
        Output(f"multi-negative-{index}", "data"),
        Input(f"merge-{index}", "data"),
        State("run-label", "value"),
        prevent_initial_call=True,
    )(split_result)


for multi_index in range(MULTI_OUTPUT_COUNT):
    register_multi_output_callback(multi_index)


# -- Browser-side callbacks -------------------------------------------------------


for client_index in range(CLIENTSIDE_COUNT):
    client_inputs = [Input("seed-store", "data")]
    if client_index >= CLIENTSIDE_COUNT // 2:
        client_inputs.append(Input(f"chain-{client_index}", "data"))
        client_function = f"""
            function(seed, chain) {{
                const base = Number(seed?.value ?? 0);
                const upstream = Number(chain?.value ?? 0);
                return {{value: base + upstream, lane: {client_index}, family: "client"}};
            }}
        """
    else:
        client_function = f"""
            function(seed) {{
                const base = Number(seed?.value ?? 0);
                return {{value: base * {client_index + 1}, lane: {client_index}, family: "client"}};
            }}
        """

    app.clientside_callback(
        client_function,
        Output(f"client-{client_index}", "data"),
        *client_inputs,
        prevent_initial_call=True,
    )


app.clientside_callback(
    """function(n_clicks) {
        throw new Error('Intentional clientside error for Dev Tools theme testing');
    }""",
    Output("debug-clientside-error-output", "children"),
    Input("trigger-clientside-error", "n_clicks"),
    prevent_initial_call=True,
)


# -- Hidden and optional dependency entries --------------------------------------


def register_hidden_callback(index: int) -> None:
    def hidden_probe(payload: Any) -> dict[str, Any]:
        return {"value": numeric_value(payload), "probe": index, "family": "hidden"}

    hidden_probe.__name__ = f"hidden_probe_{index:02d}"
    hidden_probe.__doc__ = f"""Mirror client lane {index:02d} into a hidden callback.

    This callback demonstrates Dash's hidden registration metadata while retaining
    a normal server-side payload transformation.
    """
    app.callback(
        Output(f"hidden-{index}", "data"),
        Input(f"client-{index}", "data"),
        prevent_initial_call=True,
        hidden=True,
    )(hidden_probe)


for hidden_index in range(HIDDEN_COUNT):
    register_hidden_callback(hidden_index)


@app.callback(
    Output("optional-result", "data"),
    Input("optional-probe", "value", allow_optional=True),
    prevent_initial_call=True,
)
def optional_dependency(value: Any) -> dict[str, Any]:
    """Expose an optional component dependency in the callback registry.

    The callback remains valid when ``optional-probe`` is absent from the active
    layout and records the received value for inspection.
    """

    return {"value": value, "family": "optional"}


# -- Wide fan-in summary ----------------------------------------------------------


@app.callback(
    Output("pipeline-result", "children"),
    *[Input(f"merge-{index}", "data") for index in range(MERGE_COUNT)],
    prevent_initial_call=True,
)
def summarize_pipeline(*payloads: Any) -> str:
    """Summarize completion and aggregate values across all merge lanes.

    Args:
        payloads: One payload from each registered fan-in callback.

    Returns:
        A compact status string containing completed lanes and their total.
    """

    completed = sum(payload is not None for payload in payloads)
    total = sum(numeric_value(payload) for payload in payloads)
    return f"{completed}/{MERGE_COUNT} merge lanes completed · aggregate {total:,.0f}"


# -- Pattern-matching and dynamic layout callbacks -------------------------------


@app.callback(
    Output("pattern-rows", "children"),
    Input("add-pattern-row", "n_clicks"),
    prevent_initial_call=True,
)
def add_pattern_row(n_clicks: int) -> Patch:
    """Append one dynamic pattern-matching row with a partial layout update.

    The returned ``Patch`` avoids rebuilding the existing row collection and
    gives the new row the next stable pattern index.
    """

    patched_rows = Patch()
    patched_rows.append(pattern_row(INITIAL_PATTERN_ROWS + n_clicks - 1))
    return patched_rows


@app.callback(
    Output({"type": "pattern-output", "index": MATCH}, "children"),
    Input({"type": "pattern-input", "index": MATCH}, "value"),
    State({"type": "pattern-operation", "index": MATCH}, "value"),
)
def transform_pattern_value(value: float, operation: str) -> str:
    """Apply the selected operation to one MATCH-scoped dynamic value.

    Operations:
        square: Raise the value to the second power.
        double: Multiply the value by two.
    """

    number = numeric_value(value)
    result = number**2 if operation == "square" else number * 2
    return f"{result:g}"


@app.callback(
    Output("pattern-all-summary", "children"),
    Input({"type": "pattern-input", "index": ALL}, "value"),
)
def summarize_all_pattern_values(values: list[Any]) -> str:
    """Aggregate every dynamic input selected by the ALL wildcard.

    The summary reports both the number of matching nodes and their normalized
    numeric total.
    """

    return f"ALL · {len(values)} nodes · sum {sum(numeric_value(value) for value in values):g}"


@app.callback(
    Output({"type": "pattern-prefix", "index": MATCH}, "children"),
    Input({"type": "pattern-input", "index": ALLSMALLER}, "value"),
    Input({"type": "pattern-input", "index": MATCH}, "value"),
)
def summarize_smaller_pattern_values(previous: list[Any], current: Any) -> str:
    """Calculate the prefix total for an ALLSMALLER/MATCH callback pair.

    Args:
        previous: Values from pattern indices smaller than the current row.
        current: Value belonging to the current MATCH index.
    """

    prefix_total = sum(numeric_value(value) for value in previous)
    return f"prefix {prefix_total:g} → {prefix_total + numeric_value(current):g}"


# -- Dash 4.x callback capabilities ---------------------------------------------


@app.callback(Input("run-pipeline", "n_clicks"), prevent_initial_call=True)
def record_run_side_effect(n_clicks: int) -> None:
    """Exercise a callback without Output and update the UI through set_props."""

    message = f"Run {n_clicks} observed by a callback without Output"
    SIDE_EFFECT_EVENTS.append(message)
    del SIDE_EFFECT_EVENTS[:-8]
    set_props("side-effect-status", {"children": message})


@app.callback(
    Output("bootstrap-result", "data"),
    State("run-label", "value"),
)
def bootstrap_from_state(label: str | None) -> dict[str, Any]:
    """Exercise a callback with State but no Input."""

    return {"label": label or "inspection", "family": "no-input"}


@app.callback(
    Output("match-fixed-summary", "children"),
    Input({"type": "pattern-input", "index": MATCH}, "value"),
    prevent_initial_call=True,
)
def summarize_match_into_fixed(value: Any) -> str:
    """Exercise Dash 4.2's relaxed MATCH-input to fixed-output mapping."""

    return f"Latest MATCH value: {numeric_value(value):g}"


@app.callback(
    Input({"type": "pattern-input", "index": MATCH}, "value"),
    prevent_initial_call=True,
)
def observe_match_without_output(value: Any) -> None:
    """Combine a MATCH Input with the no-Output callback form."""

    set_props(
        "match-observer-status",
        {"children": f"MATCH side effect: {numeric_value(value):g}"},
    )


@app.callback(
    Output("duplicate-result", "data"),
    Input("seed-store", "data"),
    prevent_initial_call=True,
)
def primary_duplicate_writer(payload: Any) -> dict[str, Any]:
    """Write the primary value to an output shared by duplicate callbacks.

    This registration owns the canonical output while the secondary writer uses
    ``allow_duplicate=True`` to demonstrate Dash's duplicate-output metadata.
    """

    return {"source": "primary", "value": numeric_value(payload)}


@app.callback(
    Output("duplicate-result", "data", allow_duplicate=True),
    Input("add-pattern-row", "n_clicks"),
    prevent_initial_call=True,
)
def secondary_duplicate_writer(n_clicks: int) -> dict[str, Any]:
    """Write an alternate value to the shared duplicate callback output.

    The dynamic-row button acts as an independent trigger, making the duplicate
    registration easy to distinguish from the primary seed-driven writer.
    """

    return {"source": "secondary", "value": n_clicks}


@app.callback(
    output={
        "summary": Output("flex-summary", "data"),
        "audit": Output("flex-audit", "data"),
    },
    inputs={
        "controls": {
            "clicks": Input("run-pipeline", "n_clicks"),
            "label": State("run-label", "value"),
        },
        "seed": Input("seed-store", "data"),
    },
    prevent_initial_call=True,
)
def grouped_signature(controls: dict[str, Any], seed: Any) -> dict[str, dict[str, Any]]:
    """Exercise flexible dict/tuple dependency grouping."""

    return {
        "summary": {
            "clicks": controls.get("clicks"),
            "value": numeric_value(seed),
        },
        "audit": {
            "label": controls.get("label") or "inspection",
            "family": "flexible-signature",
        },
    }


@app.callback(
    Output("optional-callback-result", "data"),
    Input("optional-callback-probe", "value"),
    optional=True,
    prevent_initial_call=True,
)
def optional_callback(value: Any) -> dict[str, Any]:
    """Exercise callback-level optional dependency handling."""

    return {"value": value, "family": "optional-callback"}


@app.callback(
    Output("async-result", "data"),
    Input("async-trigger", "data"),
    prevent_initial_call=True,
)
async def async_passthrough(payload: Any) -> dict[str, Any]:
    """Exercise native async callback registration without artificial delay."""

    return {"payload": payload, "family": "async"}


@app.callback(
    Output("background-result", "data"),
    Input("background-trigger", "data"),
    background=True,
    progress=Output("background-progress", "data"),
    prevent_initial_call=True,
)
def background_probe(set_progress: Any, payload: Any) -> dict[str, Any]:
    """Register the full background callback dependency shape.

    The hidden trigger intentionally remains dormant in this Flask demo because a
    deployment-specific background manager is not configured.
    """

    set_progress({"phase": "complete"})
    return {"payload": payload, "family": "background"}


@app.callback(
    Output("websocket-result", "data"),
    Input("websocket-trigger", "data"),
    websocket=True,
    prevent_initial_call=True,
)
def websocket_probe(payload: Any) -> dict[str, Any]:
    """Register a dormant WebSocket callback for metadata inspection."""

    return {"payload": payload, "family": "websocket"}


@app.callback(
    Output("mcp-result", "data"),
    Input("seed-store", "data"),
    mcp_enabled=True,
)
def mcp_visible_callback(payload: Any) -> dict[str, Any]:
    """Return a compact seed summary suitable for MCP exposure."""

    return {"value": numeric_value(payload), "family": "mcp"}


CALLBACK_TOTAL = len(app.callback_map)


def topology_card(count: str, label: str, detail: str, tone: str) -> html.Div:
    return html.Div(
        [
            html.Span(count, className="topology-count"),
            html.Strong(label),
            html.Small(detail),
        ],
        className=f"topology-card {tone}",
    )


def build_layout() -> html.Main:
    stores = [
        dcc.Store(id="seed-store", data={"value": 7, "run": 0, "label": "baseline"}),
        dcc.Store(id="optional-result"),
        dcc.Store(id="bootstrap-result"),
        dcc.Store(id="duplicate-result"),
        dcc.Store(id="flex-summary"),
        dcc.Store(id="flex-audit"),
        dcc.Store(id="optional-callback-result"),
        dcc.Store(id="async-trigger"),
        dcc.Store(id="async-result"),
        dcc.Store(id="background-trigger"),
        dcc.Store(id="background-progress"),
        dcc.Store(id="background-result"),
        dcc.Store(id="websocket-trigger"),
        dcc.Store(id="websocket-result"),
        dcc.Store(id="mcp-result"),
        *[dcc.Store(id=f"chain-{index}") for index in range(CHAIN_COUNT)],
        *[dcc.Store(id=f"fanout-{index}") for index in range(FANOUT_COUNT)],
        *[dcc.Store(id=f"merge-{index}") for index in range(MERGE_COUNT)],
        *[dcc.Store(id=f"stateful-{index}") for index in range(STATEFUL_COUNT)],
        *[
            dcc.Store(id=f"multi-positive-{index}")
            for index in range(MULTI_OUTPUT_COUNT)
        ],
        *[
            dcc.Store(id=f"multi-negative-{index}")
            for index in range(MULTI_OUTPUT_COUNT)
        ],
        *[dcc.Store(id=f"client-{index}") for index in range(CLIENTSIDE_COUNT)],
        *[dcc.Store(id=f"hidden-{index}") for index in range(HIDDEN_COUNT)],
    ]

    return html.Main(
        [
            html.Div(stores, className="store-bank"),
            html.Header(
                [
                    html.Div(
                        [
                            html.P(
                                "DEVTOOLS PLUS · CALLBACK LABORATORY",
                                className="eyebrow",
                            ),
                            fac.AntdTag(
                                content="FAC component loaded",
                                color="cyan",
                                bordered=False,
                                style={"marginBottom": 12},
                            ),
                            html.H1("A living map of complex Dash orchestration."),
                            html.P(
                                "This example intentionally registers more than one hundred real callback "
                                "relationships, including modern Dash 4.x callback modes, so Devtools Plus can be tested at scale.",
                                className="lede",
                            ),
                        ],
                        className="hero-copy",
                    ),
                    html.Div(
                        [
                            html.Span(str(CALLBACK_TOTAL), className="hero-number"),
                            html.Span("registered callbacks"),
                        ],
                        className="callback-total",
                    ),
                ],
                className="lab-hero",
            ),
            html.Section(
                [
                    topology_card(
                        str(CHAIN_COUNT),
                        "Linear chain",
                        "Sequential dependencies",
                        "cyan",
                    ),
                    topology_card(
                        str(FANOUT_COUNT), "Fan-out", "Shared source branches", "blue"
                    ),
                    topology_card(
                        str(MERGE_COUNT), "Fan-in", "Multi-input aggregation", "indigo"
                    ),
                    topology_card(
                        "MATCH · ALL · ALLSMALLER",
                        "Pattern IDs",
                        "Dynamic component topology",
                        "violet",
                    ),
                ],
                className="topology-grid",
                **{"aria-label": "Callback topology summary"},
            ),
            html.Div(
                [
                    html.Section(
                        [
                            html.Div(
                                [
                                    html.Div(
                                        [
                                            html.P(
                                                "PIPELINE CONTROL",
                                                className="section-kicker",
                                            ),
                                            html.H2("Trigger the callback network"),
                                        ]
                                    ),
                                    html.Code(
                                        id="seed-preview", className="seed-preview"
                                    ),
                                ],
                                className="section-heading",
                            ),
                            html.Label("Seed value", htmlFor="seed-slider"),
                            dcc.Slider(
                                1,
                                20,
                                1,
                                value=7,
                                id="seed-slider",
                                marks={1: "1", 5: "5", 10: "10", 15: "15", 20: "20"},
                            ),
                            html.Div(
                                [
                                    dcc.Input(
                                        id="run-label",
                                        value="inspection",
                                        placeholder="Run label",
                                    ),
                                    dcc.Dropdown(
                                        id="merge-scale",
                                        value=1,
                                        clearable=False,
                                        options=[
                                            {"label": "1× merge scale", "value": 1},
                                            {"label": "2× merge scale", "value": 2},
                                            {"label": "5× merge scale", "value": 5},
                                        ],
                                    ),
                                    html.Button(
                                        "Run pipeline", id="run-pipeline", n_clicks=0
                                    ),
                                ],
                                className="pipeline-actions",
                            ),
                            html.Div(
                                "Ready to propagate a new seed through the graph.",
                                id="pipeline-result",
                                className="pipeline-result",
                            ),
                        ],
                        className="lab-panel control-panel",
                    ),
                    html.Aside(
                        [
                            html.P("COMPOSITION COVERAGE", className="section-kicker"),
                            html.H2("Callback families"),
                            html.Ul(
                                [
                                    html.Li(
                                        [html.Strong("10"), " clientside callbacks"]
                                    ),
                                    html.Li(
                                        [html.Strong("6"), " multi-output callbacks"]
                                    ),
                                    html.Li([html.Strong("10"), " State snapshots"]),
                                    html.Li([html.Strong("5"), " hidden callbacks"]),
                                    html.Li([html.Strong("2"), " no-Output callbacks"]),
                                    html.Li([html.Strong("2"), " optional forms"]),
                                    html.Li(
                                        [
                                            html.Strong("4.x"),
                                            " async, background, WebSocket and MCP",
                                        ]
                                    ),
                                ]
                            ),
                            html.P(
                                "Open Devtools Plus from the Dash toolbar to inspect every registered edge.",
                                className="coverage-note",
                            ),
                            html.Div(
                                [
                                    html.P(
                                        "ERROR REPORTING TEST",
                                        className="section-kicker",
                                    ),
                                    html.P(
                                        "Run 1 / 0 in Python or throw a clientside Error to inspect the native Dash error UI.",
                                        className="error-trigger-description",
                                    ),
                                    html.Button(
                                        "Trigger ZeroDivisionError",
                                        id="trigger-debug-error",
                                        n_clicks=0,
                                    ),
                                    html.Button(
                                        "Trigger clientside Error",
                                        id="trigger-clientside-error",
                                        n_clicks=0,
                                    ),
                                    html.Span(id="debug-error-output"),
                                    html.Span(id="debug-clientside-error-output"),
                                ],
                                className="error-trigger",
                            ),
                        ],
                        className="lab-panel coverage-panel",
                    ),
                ],
                className="control-grid",
            ),
            html.Section(
                [
                    html.Div(
                        [
                            html.Div(
                                [
                                    html.P(
                                        "COMPONENT INSPECTION TARGET",
                                        className="section-kicker",
                                    ),
                                    html.H2("Explore a nested Dash DataTable"),
                                    html.P(
                                        "Inspect a cell, header sort control, row selector or pagination button. "
                                        "Devtools Plus should map each nested element back to this DataTable.",
                                        className="section-description",
                                    ),
                                ]
                            ),
                            html.Code("dash.dash_table.DataTable"),
                        ],
                        className="section-heading inspection-demo-heading",
                    ),
                    html.Div(
                        dash_table.DataTable(
                            id="inspection-table",
                            columns=[
                                {"name": "Service", "id": "service"},
                                {"name": "Status", "id": "status"},
                                {
                                    "name": "Latency (ms)",
                                    "id": "latency",
                                    "type": "numeric",
                                },
                                {
                                    "name": "Requests",
                                    "id": "requests",
                                    "type": "numeric",
                                },
                                {"name": "Region", "id": "region"},
                            ],
                            data=INSPECTION_ROWS,
                            page_size=5,
                            page_current=0,
                            sort_action="native",
                            sort_mode="multi",
                            filter_action="native",
                            row_selectable="multi",
                            selected_rows=[1],
                            style_table={"overflowX": "auto"},
                            style_header={
                                "backgroundColor": "#f5f8fb",
                                "color": "#52687d",
                                "fontWeight": 700,
                                "borderColor": "#dfe7ee",
                            },
                            style_cell={
                                "borderColor": "#e7edf3",
                                "color": "#294057",
                                "fontFamily": "Aptos, Segoe UI, sans-serif",
                                "fontSize": 13,
                                "padding": "10px 12px",
                                "textAlign": "left",
                            },
                            style_data_conditional=[
                                {
                                    "if": {
                                        "filter_query": '{status} = "healthy"',
                                        "column_id": "status",
                                    },
                                    "color": "#178067",
                                    "fontWeight": 650,
                                },
                                {
                                    "if": {
                                        "filter_query": '{status} = "watch"',
                                        "column_id": "status",
                                    },
                                    "color": "#b07120",
                                    "fontWeight": 650,
                                },
                            ],
                        ),
                        className="inspection-table-wrap",
                    ),
                ],
                className="lab-panel inspection-demo-panel",
            ),
            html.Section(
                [
                    html.Div(
                        [
                            html.Div(
                                [
                                    html.P(
                                        "PATTERN-MATCHING CALLBACKS",
                                        className="section-kicker",
                                    ),
                                    html.H2("Dynamic node workshop"),
                                    html.P(
                                        "Each row participates in MATCH, ALL and ALLSMALLER callbacks.",
                                        className="section-description",
                                    ),
                                ]
                            ),
                            html.Div(
                                [
                                    html.Code(id="pattern-all-summary"),
                                    html.Button(
                                        "Add node", id="add-pattern-row", n_clicks=0
                                    ),
                                ],
                                className="pattern-actions",
                            ),
                        ],
                        className="section-heading pattern-heading",
                    ),
                    html.Div(
                        [
                            html.Div(
                                [
                                    html.Span("NO OUTPUT"),
                                    html.Code(
                                        "Waiting for a pipeline run",
                                        id="side-effect-status",
                                    ),
                                ]
                            ),
                            html.Div(
                                [
                                    html.Span("MATCH → FIXED"),
                                    html.Code(
                                        "Edit any node value",
                                        id="match-fixed-summary",
                                    ),
                                ]
                            ),
                            html.Div(
                                [
                                    html.Span("MATCH → SIDE EFFECT"),
                                    html.Code(
                                        "Edit any node value",
                                        id="match-observer-status",
                                    ),
                                ]
                            ),
                        ],
                        className="modern-callback-strip",
                    ),
                    html.Div(
                        [
                            html.Span("NODE"),
                            html.Span("VALUE"),
                            html.Span("OPERATION"),
                            html.Span("RESULT"),
                            html.Span("ALLSMALLER PREFIX"),
                        ],
                        className="pattern-columns",
                    ),
                    html.Div(
                        [pattern_row(index) for index in range(INITIAL_PATTERN_ROWS)],
                        id="pattern-rows",
                        className="pattern-rows",
                    ),
                ],
                className="lab-panel pattern-panel",
            ),
        ],
        className="lab-shell",
    )


app.layout = build_layout


if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False,
        dev_tools_disable_version_check=True,
        port=8050,
    )
