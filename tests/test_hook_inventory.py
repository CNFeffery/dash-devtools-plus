from dash import hooks

from dash_devtools_plus import hook_inventory


class FakeEntryPoint:
    group = "dash_hooks"
    name = "example-hooks"
    value = "example_hooks.plugin:register"
    module = "example_hooks.plugin"

    def load(self):
        raise AssertionError("Inventory discovery must never import an entry point")


class FakeDistribution:
    metadata = {"Name": "Example-Hooks"}
    version = "2.4.0"
    entry_points = [FakeEntryPoint(), FakeEntryPoint()]


def test_entry_point_discovery_deduplicates_without_loading(monkeypatch):
    monkeypatch.setattr(
        hook_inventory.metadata,
        "distributions",
        lambda: [FakeDistribution()],
    )

    libraries, owners = hook_inventory._entry_point_libraries()

    assert list(libraries) == ["example-hooks"]
    assert libraries["example-hooks"]["entryPoints"] == [
        {
            "name": "example-hooks",
            "value": "example_hooks.plugin:register",
            "module": "example_hooks.plugin",
        }
    ]
    assert owners == {"example_hooks.plugin": "example-hooks"}


def test_runtime_registry_adapter_degrades_safely(monkeypatch):
    monkeypatch.setattr(hooks, "_ns", None)

    contributions, state = hook_inventory._runtime_contributions()

    assert contributions == []
    assert state == "unavailable"
