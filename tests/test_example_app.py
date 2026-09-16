import inspect
from pathlib import Path
from urllib.parse import unquote

import pytest

from dash_devtools_plus import plugin
from examples.app import app, publish_seed, trigger_debug_error


def enable_dev_tools_once():
    if not plugin._devtools_enabled(app):
        app.enable_dev_tools(
            debug=True,
            dev_tools_ui=True,
            dev_tools_disable_version_check=True,
            dev_tools_hot_reload=False,
        )


def test_callback_laboratory_has_broad_callback_coverage():
    dependencies = app._callback_list
    callback_map = app.callback_map

    assert len(dependencies) >= 125
    assert any(item.get("clientside_function") for item in dependencies)
    assert any(item.get("hidden") for item in dependencies)
    assert any('"MATCH"' in item["output"] for item in dependencies)
    assert any('"ALL"' in str(item.get("inputs")) for item in dependencies)
    assert any('"ALLSMALLER"' in str(item.get("inputs")) for item in dependencies)
    assert any(item["output"].startswith("..") for item in dependencies)
    assert sum(bool(item.get("no_output")) for item in dependencies) >= 2
    assert any(not item.get("inputs") and item.get("state") for item in dependencies)
    assert any(
        item["output"] == "match-fixed-summary.children"
        and '"MATCH"' in str(item.get("inputs"))
        for item in dependencies
    )
    assert any(
        item.get("no_output") and '"MATCH"' in str(item.get("inputs"))
        for item in dependencies
    )
    assert sum(
        item["output"].split("@")[0] == "duplicate-result.data"
        for item in dependencies
    ) == 2
    assert any(item.get("optional") for item in dependencies)
    assert any(item.get("background") for item in dependencies)
    assert any(item.get("websocket") for item in dependencies)
    assert any(
        isinstance(item.get("inputs_state_indices"), dict)
        for item in callback_map.values()
    )
    assert any(item.get("mcp_enabled") for item in callback_map.values())
    assert any(
        inspect.iscoroutinefunction(item.get("callback"))
        for item in callback_map.values()
    )


def test_example_includes_nested_datatable_for_component_inspection():
    table = app.layout()["inspection-table"]

    assert table.page_size == 5
    assert table.filter_action == "native"
    assert table.sort_action == "native"
    assert table.row_selectable == "multi"
    assert len(table.data) > table.page_size


def test_example_exposes_an_opt_in_native_error_trigger():
    layout = app.layout()

    assert layout["trigger-debug-error"].n_clicks == 0
    assert layout["trigger-clientside-error"].n_clicks == 0
    assert "debug-error-output.children" in app.callback_map
    assert any(
        item.get("output") == "debug-clientside-error-output.children"
        and item.get("clientside_function")
        for item in app._callback_list
    )
    with pytest.raises(ZeroDivisionError):
        trigger_debug_error(1)


def test_callback_metadata_includes_relative_python_source_locations():
    enable_dev_tools_once()
    workspace = Path(__file__).parents[1]

    response = app.server.test_client().get("/_dash-devtools-plus/callbacks")
    callbacks = response.get_json()
    by_output = {item["output"]: item for item in callbacks}

    assert response.status_code == 200
    assert len(callbacks) == len(app._callback_list)
    server_callbacks = [
        item for item in callbacks if not item.get("clientside_function")
    ]
    assert len(server_callbacks) >= 110
    assert all(item["source"].get("docstring") for item in server_callbacks)
    assert sum(
        "\n\n" in item["source"]["docstring"] for item in server_callbacks
    ) >= 100
    source = by_output["seed-store.data"]["source"]
    assert {key: source[key] for key in ("kind", "function", "path", "line")} == {
        "kind": "python",
        "function": "publish_seed",
        "path": "examples/app.py",
        "line": inspect.getsourcelines(publish_seed)[1],
    }
    assert unquote(source["editorUri"]) == (
        f"vscode://file/{workspace.as_posix()}"
        f"/examples/app.py:{inspect.getsourcelines(publish_seed)[1]}:1"
    )
    assert [target["id"] for target in source["editorUris"]] == [
        "vscode",
        "cursor",
        "pycharm",
    ]
    assert all(isinstance(target["supported"], bool) for target in source["editorUris"])
    assert source["docstring"] == inspect.getdoc(publish_seed)

    client_source = by_output["client-0.data"]["source"]
    clientside_line = next(
        line_number
        for line_number, text in enumerate(
            (workspace / "examples" / "app.py").read_text(encoding="utf-8").splitlines(),
            start=1,
        )
        if "app.clientside_callback(" in text
    )
    assert {
        key: client_source[key]
        for key in ("kind", "function", "path", "line", "docstring")
    } == {
        "kind": "clientside-registration",
        "function": "app.clientside_callback",
        "path": "examples/app.py",
        "line": clientside_line,
        "docstring": None,
    }
    assert [target["id"] for target in client_source["editorUris"]] == [
        "vscode",
        "cursor",
        "pycharm",
    ]
    no_output_callbacks = [item for item in callbacks if item.get("no_output")]
    assert len(no_output_callbacks) >= 2
    assert all(item["output"] is None for item in no_output_callbacks)
    assert {item["source"]["function"] for item in no_output_callbacks} >= {
        "record_run_side_effect",
        "observe_match_without_output",
    }
    assert by_output["mcp-result.data"]["mcp_enabled"] is True


def test_component_library_metadata_uses_dash_module_signature():
    enable_dev_tools_once()

    response = app.server.test_client().get(
        "/_dash-devtools-plus/component-libraries"
    )
    libraries = response.get_json()
    by_module = {item["module"]: item for item in libraries}

    assert response.status_code == 200
    expected_modules = {
        "dash.dcc",
        "dash.html",
        "dash.dash_table",
        "feffery_antd_components",
    }
    assert expected_modules <= set(by_module)
    assert by_module["dash.dcc"]["version"]
    assert by_module["dash.dcc"]["scope"] == "core"
    assert by_module["feffery_antd_components"]["scope"] == "third-party"
    assert by_module["feffery_antd_components"]["exports"] > 0
    assert "fac" in by_module["feffery_antd_components"]["aliases"]


def test_hook_library_inventory_reports_entry_points_and_runtime_order():
    enable_dev_tools_once()

    response = app.server.test_client().get("/_dash-devtools-plus/hook-libraries")
    inventory = response.get_json()

    assert response.status_code == 200
    assert inventory["schemaVersion"] == 1
    assert inventory["processScoped"] is True
    assert inventory["completeness"] == {
        "entryPoints": "complete",
        "runtimeRegistry": "complete",
        "appSnapshot": "complete",
    }

    installed = [
        item
        for item in inventory["libraries"]
        if item["id"] == "dash-devtools-plus"
    ]
    assert len(installed) == 1
    assert installed[0]["status"] == "registered"
    assert installed[0]["version"] == "0.1.1"
    hook_types = {item["type"] for item in installed[0]["hookTypes"]}
    assert {"devtool", "routes", "script", "setup", "stylesheet"} <= hook_types

    demo = next(
        item
        for item in inventory["libraries"]
        if item["source"] == "manual" and "examples.demo_hooks" in item["modules"]
    )
    assert demo["status"] == "registered"
    assert {item["type"] for item in demo["hookTypes"]} == {"layout", "setup"}
    assert "layout" in inventory["orderWarnings"]
