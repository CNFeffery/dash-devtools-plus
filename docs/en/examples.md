# Example applications

The repository includes three runnable applications. Each calls `configure_devtools_plus` with the repository root, so the package can be exercised from a checkout without installing it into the environment first.

| Example | Purpose | Run command |
| --- | --- | --- |
| `simple` | Verify the smallest graph: one server callback and one clientside callback. | `python examples/simple/app.py` |
| `intermediate` | Explore a focused travel-budget scenario implemented with Dash core components. | `python examples/intermediate/app.py` |
| `comprehensive` | Exercise callback topology, pattern matching, source inspection, snapshots, dependencies, and toolbar themes at scale. | `python examples/comprehensive/app.py` |

All three use port `8050` by default. Run one application at a time, then open <http://127.0.0.1:8050>.

The comprehensive example deliberately contains native error-test controls, background and WebSocket registration shapes, and 100+ callbacks. Use it for acceptance checks; do not copy its intentionally broad topology wholesale into a production app.

![The comprehensive callback laboratory](../../imgs/docs/comprehensive-example.png)
