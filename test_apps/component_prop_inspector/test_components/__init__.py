"""Test-only Dash components for component-inspector regression apps."""

from __future__ import annotations

from dash.development.base_component import Component, _explicitize_args

__version__ = "0.0.1"

_js_dist = [
    {
        "relative_package_path": "test_components.js",
        "namespace": "test_components",
    }
]
_css_dist: list[dict] = []


class ComponentPropCarrier(Component):
    """Carry one component prop through an extra React wrapper."""

    _namespace = "test_components"
    _type = "ComponentPropCarrier"
    _children_props = ["slot"]
    _base_nodes = ["slot", "children"]

    @_explicitize_args
    def __init__(
        self,
        children=None,
        *,
        id=None,
        slot=None,
        **kwargs,
    ):
        self._prop_names = ["children", "id", "slot"]
        self._valid_wildcard_attributes = []
        self.available_properties = ["children", "id", "slot"]
        self.available_wildcard_properties = []

        explicit_args = kwargs.pop("_explicit_args")
        local_values = locals()
        local_values.update(kwargs)
        props = {
            name: local_values[name]
            for name in explicit_args
            if name not in {"children", "kwargs"}
        }
        super().__init__(children=children, **props)


ComponentPropCarrier._js_dist = _js_dist
ComponentPropCarrier._css_dist = _css_dist

__all__ = ["ComponentPropCarrier"]
