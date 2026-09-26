# 🧪 Example applications

The 0.1.4 development checkout includes five runnable applications. Each calls `configure_devtools_plus` with the repository root. Use the [source installation instructions](quick-start.md#try-014-before-release) to run the current version; the comprehensive example additionally requires `feffery-antd-components` and `dash-mantine-components`.

| Example | Purpose | Run command |
| --- | --- | --- |
| `simple` | Verify the smallest graph: one server callback and one clientside callback. | `python examples/simple/app.py` |
| `callback_performance` | Compare an increasing server delay, a fixed-delay polling callback, and an instant clientside callback. | `python examples/callback_performance/app.py` |
| `intermediate` | Explore a focused travel-budget scenario implemented with Dash core components. | `python examples/intermediate/app.py` |
| `comprehensive` | Exercise callback topology, pattern matching, source inspection, snapshots, dependencies, and toolbar themes at scale. | `python examples/comprehensive/app.py` |
| `fastapi` | Stream server time with a persistent WebSocket callback and asynchronous FastAPI APIs. Requires `pip install "dash-devtools-plus[fastapi]"`. | `python examples/fastapi/app.py` |

All five use port `8050` by default. Run one application at a time, then open <http://127.0.0.1:8050>. Pick the size that matches the question you want to explore, then let Devtools Plus reveal the moving parts. ✨

## Explore callback performance

Run `python examples/callback_performance/app.py`, open **Devtools Plus → Callback relationships**, and keep **Metrics** enabled.

1. Click the server button several times. Its delay increases by 0.5 seconds per click, up to four seconds; compare Latest, Average, Minimum, and Maximum.
2. Open the details for `handle_poll`. It runs every two seconds with a fixed 0.35-second delay, building a steady timing history. Expand the five-row history to see up to 20 records.
3. Trigger the clientside button and open its details. The chart shows client duration, with no Dash request/response transfer.
4. Use the fullscreen icon in **Callback data flow** to enlarge the dependencies; press `Esc` to return. The performance information button explains sample coverage and payload estimates.

Samples come from real executions in the current browser page. Reloading starts a new monitoring session; the example is a comparison tool, not a benchmark. See [Callback performance](features/callbacks.md#callback-performance) for metric definitions and limitations.

## Comprehensive laboratory

The comprehensive example deliberately contains native error-test controls, background and WebSocket registration shapes, and 131 callbacks in the 0.1.4 checkout. Use it for acceptance checks; do not copy its intentionally broad topology wholesale into a production app.

![The comprehensive callback laboratory](../../imgs/docs/comprehensive-example.webp)
