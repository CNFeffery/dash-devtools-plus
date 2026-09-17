"""Dash Devtools Plus public API and Dash hook entry point."""

from .plugin import configure_devtools_plus, register

__version__ = "0.1.3"

# Loading the ``dash_hooks`` entry point imports this module. Registration is
# idempotent, so explicit imports and automatic discovery can safely coexist.
register()

__all__ = ["configure_devtools_plus", "register", "__version__"]
