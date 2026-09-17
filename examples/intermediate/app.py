"""A focused travel-budget scenario built only with Dash core components."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dash import Dash, Input, Output, dcc, html  # noqa: E402
import plotly.graph_objects as go  # noqa: E402

from dash_devtools_plus import configure_devtools_plus  # noqa: E402

configure_devtools_plus(
    default_locale="zh-CN",
    project_root=PROJECT_ROOT,
    editor_project_root=PROJECT_ROOT,
)

app = Dash(__name__, assets_folder=str(Path(__file__).parent / "assets"))
app.title = "旅行预算规划 · Dash Devtools Plus"

DESTINATIONS = {
    "hangzhou": {"label": "杭州", "stay": 620, "meal": 220, "accent": "#0b766e"},
    "chengdu": {"label": "成都", "stay": 460, "meal": 180, "accent": "#c55b31"},
    "xiamen": {"label": "厦门", "stay": 580, "meal": 210, "accent": "#1664a3"},
    "dali": {"label": "大理", "stay": 420, "meal": 170, "accent": "#7a5a34"},
}
ACTIVITIES = {
    "museum": ("展馆与文化", 120),
    "outdoor": ("户外体验", 260),
    "food": ("特色餐饮", 320),
}

app.layout = html.Main(
    [
        html.Header(
            [
                html.Div(
                    [
                        html.P("WEEKEND FIELD NOTES", className="eyebrow"),
                        html.H1("旅行预算规划器"),
                        html.P("调整行程条件，即时比较住宿、餐饮、交通和体验支出。"),
                    ]
                ),
                html.Div(
                    [html.Span("Built with"), html.Strong("Dash Core Components")],
                    className="built-with",
                ),
            ],
            className="page-header",
        ),
        html.Div(
            [
                html.Aside(
                    [
                        html.H2("行程条件"),
                        html.Label("目的地", htmlFor="destination"),
                        dcc.Dropdown(
                            id="destination",
                            value="hangzhou",
                            clearable=False,
                            options=[
                                {"label": item["label"], "value": key}
                                for key, item in DESTINATIONS.items()
                            ],
                        ),
                        html.Label("住宿晚数", htmlFor="nights"),
                        dcc.Slider(
                            id="nights",
                            min=1,
                            max=7,
                            step=1,
                            value=3,
                            marks={i: str(i) for i in range(1, 8)},
                        ),
                        html.Label("出行人数", htmlFor="travelers"),
                        dcc.RadioItems(
                            id="travelers",
                            value=2,
                            options=[
                                {"label": f"{i} 人", "value": i} for i in range(1, 5)
                            ],
                            inline=True,
                        ),
                        html.Label("体验偏好", htmlFor="activities"),
                        dcc.Checklist(
                            id="activities",
                            value=["museum", "food"],
                            options=[
                                {"label": label, "value": key}
                                for key, (label, _cost) in ACTIVITIES.items()
                            ],
                        ),
                        html.Label("预算上限", htmlFor="budget"),
                        dcc.Input(
                            id="budget", type="number", min=1000, step=500, value=8000
                        ),
                    ],
                    className="planner-controls",
                ),
                html.Section(
                    [
                        html.Div(
                            [
                                html.Div(
                                    [
                                        html.Span("预计总支出"),
                                        html.Strong(id="total-cost"),
                                    ]
                                ),
                                html.Div(
                                    [
                                        html.Span("人均预算"),
                                        html.Strong(id="per-person"),
                                    ]
                                ),
                                html.Div(
                                    [
                                        html.Span("预算余量"),
                                        html.Strong(id="budget-gap"),
                                    ]
                                ),
                            ],
                            className="metric-strip",
                        ),
                        html.Div(id="trip-summary", className="trip-summary"),
                        dcc.Graph(
                            id="budget-chart",
                            config={"displayModeBar": False},
                            className="budget-chart",
                        ),
                        html.Div(id="budget-advice", className="budget-advice"),
                    ],
                    className="planner-results",
                ),
            ],
            className="planner-grid",
        ),
    ],
    className="trip-shell",
)


@app.callback(
    Output("total-cost", "children"),
    Output("per-person", "children"),
    Output("budget-gap", "children"),
    Output("trip-summary", "children"),
    Output("budget-chart", "figure"),
    Output("budget-advice", "children"),
    Input("destination", "value"),
    Input("nights", "value"),
    Input("travelers", "value"),
    Input("activities", "value"),
    Input("budget", "value"),
)
def plan_trip(
    destination: str,
    nights: int,
    travelers: int,
    activities: list[str] | None,
    budget: float | None,
) -> tuple[str, str, str, str, go.Figure, str]:
    """Calculate and visualize a practical trip budget from the selected inputs."""

    place = DESTINATIONS[destination]
    nights = int(nights or 1)
    travelers = int(travelers or 1)
    budget = float(budget or 0)
    activity_cost = sum(ACTIVITIES[key][1] for key in (activities or [])) * travelers
    costs = {
        "住宿": place["stay"] * nights,
        "餐饮": place["meal"] * (nights + 1) * travelers,
        "往返交通": 520 * travelers,
        "体验": activity_cost,
    }
    total = sum(costs.values())
    gap = budget - total
    currency = lambda value: f"¥{value:,.0f}"  # noqa: E731

    figure = go.Figure(
        go.Bar(
            x=list(costs.values()),
            y=list(costs.keys()),
            orientation="h",
            marker={"color": place["accent"], "line": {"width": 0}},
            hovertemplate="%{y}<br>¥%{x:,.0f}<extra></extra>",
        )
    )
    figure.update_layout(
        margin={"l": 12, "r": 12, "t": 26, "b": 20},
        height=300,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis={"showgrid": True, "gridcolor": "#e6e1d7", "zeroline": False},
        yaxis={"autorange": "reversed"},
        font={"family": "Segoe UI, Microsoft YaHei, sans-serif", "color": "#24312e"},
    )

    selected = "、".join(ACTIVITIES[key][0] for key in (activities or [])) or "自由探索"
    summary = f"{travelers} 人前往{place['label']}，停留 {nights + 1} 天 {nights} 晚；体验重点为{selected}。"
    advice = (
        f"预算充足，还可预留 {currency(gap)} 作为机动支出。"
        if gap >= 0
        else f"当前方案超出预算 {currency(abs(gap))}，可优先缩短住宿或减少付费体验。"
    )
    return (
        currency(total),
        currency(total / travelers),
        currency(gap),
        summary,
        figure,
        advice,
    )


if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False,
        dev_tools_disable_version_check=True,
        port=8050,
    )
