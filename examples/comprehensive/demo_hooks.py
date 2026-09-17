"""Small manual hook library used by the comprehensive example.

It intentionally provides two ordered layout hooks so the hook inventory panel
has a realistic non-entry-point library and ordering relationship to inspect.
"""

from dash import hooks


@hooks.setup(priority=20)
def annotate_demo_app(app):
    """Expose a harmless marker that is useful while inspecting the example."""

    # Keep this demonstration hook independent of the concrete Dash backend.
    # Flask exposes ``server.config`` while FastAPI intentionally does not.
    app._devtools_plus_demo_hooks = True


@hooks.layout(priority=20)
def normalise_demo_layout(layout):
    """First stage in the example's layout hook pipeline."""

    return layout


@hooks.layout(priority=5)
def preserve_demo_layout(layout):
    """Second stage in the example's layout hook pipeline."""

    return layout
