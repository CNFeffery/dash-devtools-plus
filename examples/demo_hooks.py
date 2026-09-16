"""Small manual hook library used by the development example.

It intentionally provides two ordered layout hooks so the hook inventory panel
has a realistic non-entry-point library and ordering relationship to inspect.
"""

from dash import hooks


@hooks.setup(priority=20)
def annotate_demo_app(app):
    """Expose a harmless marker that is useful while inspecting the example."""

    app.server.config["DEVTOOLS_PLUS_DEMO_HOOKS"] = True


@hooks.layout(priority=20)
def normalise_demo_layout(layout):
    """First stage in the example's layout hook pipeline."""

    return layout


@hooks.layout(priority=5)
def preserve_demo_layout(layout):
    """Second stage in the example's layout hook pipeline."""

    return layout
