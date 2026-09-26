import inspect
from pathlib import Path
from urllib.parse import unquote

import pytest

from dash_devtools_plus import plugin
from examples.callback_performance.app import (
    POLL_DELAY_SECONDS,
    app as callback_performance_app,
    handle_poll,
    handle_server_click,
)
from examples.comprehensive.app import app, publish_seed, trigger_debug_error
from examples.intermediate.app import app as intermediate_app, plan_trip
from examples.simple.app import app as simple_app, create_greeting


def enable_dev_tools_once(target_app=app):
    if not plugin._devtools_enabled(target_app):
        target_app.enable_dev_tools(
            debug=True,
            dev_tools_ui=True,
            dev_tools_disable_version_check=True,
            dev_tools_hot_reload=False,
        )


def test_simple_example_has_exactly_one_server_and_one_clientside_callback():
    dependencies = simple_app._callback_list

    assert len(dependencies) == 2
    assert sum(bool(item.get("clientside_function")) for item in dependencies) == 1
    assert sum(not item.get("clientside_function") for item in dependencies) == 1
    assert create_greeting(" Dash ") == "你好，Dash。这条消息来自 Python。"


def test_intermediate_example_is_one_cohesive_core_component_scenario():
    assert len(intermediate_app._callback_list) == 1
    callback = intermediate_app._callback_list[0]

    assert len(callback["inputs"]) == 5
    assert callback["output"].startswith("..total-cost.children")
    assert "budget-chart.figure" in callback["output"]
    assert "inspection-table" not in str(intermediate_app.layout)

    total, per_person, gap, summary, figure, advice = plan_trip(
        "hangzhou", 3, 2, ["museum", "food"], 8000
    )
    assert (total, per_person, gap) == ("¥5,540", "¥2,770", "¥2,460")
    assert "杭州" in summary
    assert len(figure.data) == 1
    assert "预算充足" in advice


def test_callback_performance_example_has_three_contrasting_callbacks(monkeypatch):
    dependencies = callback_performance_app._callback_list
    sleeps = []

    monkeypatch.setattr("examples.callback_performance.app.time.sleep", sleeps.append)

    assert len(dependencies) == 3
    assert sum(bool(item.get("clientside_function")) for item in dependencies) == 1
    assert sum(not item.get("clientside_function") for item in dependencies) == 2
    assert "第 3 次点击" in handle_server_click(3)
    assert "第 7 次轮询" in handle_poll(7)
    assert sleeps == [1.5, POLL_DELAY_SECONDS]


@pytest.mark.parametrize(
    "example_app", [simple_app, callback_performance_app, intermediate_app, app]
)
def test_each_example_serves_its_page_layout_and_callback_manifest(example_app):
    enable_dev_tools_once(example_app)
    client = example_app.server.test_client()

    assert client.get("/").status_code == 200
    assert client.get("/_dash-layout").status_code == 200
    assert client.get("/_dash-dependencies").status_code == 200


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
    assert (
        sum(
            item["output"].split("@")[0] == "duplicate-result.data"
            for item in dependencies
        )
        == 2
    )
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
    assert (
        sum("\n\n" in item["source"]["docstring"] for item in server_callbacks) >= 100
    )
    source = by_output["seed-store.data"]["source"]
    assert {key: source[key] for key in ("kind", "function", "path", "line")} == {
        "kind": "python",
        "function": "publish_seed",
        "path": "examples/comprehensive/app.py",
        "line": inspect.getsourcelines(publish_seed)[1],
    }
    workspace_uri_path = workspace.as_posix().lstrip("/")
    assert unquote(source["editorUri"]) == (
        f"vscode://file/{workspace_uri_path}"
        f"/examples/comprehensive/app.py:{inspect.getsourcelines(publish_seed)[1]}:1"
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
            (workspace / "examples" / "comprehensive" / "app.py")
            .read_text(encoding="utf-8")
            .splitlines(),
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
        "path": "examples/comprehensive/app.py",
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
    assert all(item["callback_id"] for item in no_output_callbacks)
    assert all(item["callback_id"] != item["output"] for item in no_output_callbacks)
    assert {item["source"]["function"] for item in no_output_callbacks} >= {
        "record_run_side_effect",
        "observe_match_without_output",
    }
    assert by_output["mcp-result.data"]["mcp_enabled"] is True


def test_component_library_metadata_uses_dash_module_signature():
    enable_dev_tools_once()

    response = app.server.test_client().get("/_dash-devtools-plus/component-libraries")
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
        item for item in inventory["libraries"] if item["id"] == "dash-devtools-plus"
    ]
    assert len(installed) == 1
    assert installed[0]["status"] == "registered"
    assert installed[0]["version"] == "0.1.4"
    hook_types = {item["type"] for item in installed[0]["hookTypes"]}
    assert {"devtool", "routes", "script", "setup", "stylesheet"} <= hook_types

    demo = next(
        item
        for item in inventory["libraries"]
        if item["source"] == "manual"
        and "examples.comprehensive.demo_hooks" in item["modules"]
    )
    assert demo["status"] == "registered"
    assert {item["type"] for item in demo["hookTypes"]} == {"layout", "setup"}
    assert "layout" in inventory["orderWarnings"]


def test_dependency_inventory_unifies_imported_library_categories():
    enable_dev_tools_once()

    response = app.server.test_client().get("/_dash-devtools-plus/dependencies")
    inventory = response.get_json()

    assert response.status_code == 200
    assert inventory["schemaVersion"] == 1
    assert inventory["summary"]["total"] == len(inventory["libraries"])
    assert {item["category"] for item in inventory["libraries"]} == {
        "standard",
        "dash-component",
        "dash-hook",
    }
    assert inventory["summary"] == {
        "total": 10,
        "standard": 3,
        "dashComponents": 6,
        "dashHooks": 1,
        "other": 0,
    }

    by_id = {item["id"]: item for item in inventory["libraries"]}
    assert by_id["component:dash"]["modules"] == ["dash"]
    assert by_id["component:dash"]["version"]
    assert by_id["component:dash"]["component"] is None
    assert by_id["component:dash.dcc"]["component"]["module"] == "dash.dcc"
    assert by_id["component:feffery_antd_components"]["component"]["aliases"]

    hooks = [item for item in inventory["libraries"] if item["category"] == "dash-hook"]
    assert any(item["name"] == "dash-devtools-plus" for item in hooks)
    assert all(item["hook"]["status"] != "discovered" for item in hooks)
    assert not any(item["id"] == "hook:plotly-cloud" for item in hooks)
    assert not any(
        item["name"].startswith("examples.") for item in inventory["libraries"]
    )
    assert not any(
        item["name"] in {"Flask", "Werkzeug"} for item in inventory["libraries"]
    )
    assert inventory["hookMeta"]["dashVersion"]


def test_runtime_environment_combines_server_and_dependency_information():
    enable_dev_tools_once()

    response = app.server.test_client().get("/_dash-devtools-plus/runtime-environment")
    environment = response.get_json()

    assert response.status_code == 200
    assert environment["schemaVersion"] == 1
    assert environment["generatedAt"] > 0
    assert environment["application"]["dashVersion"]
    assert environment["application"]["devtoolsPlusVersion"] == "0.1.4"
    assert environment["python"]["version"]
    assert environment["python"]["implementation"]
    assert set(environment["python"]) == {"version", "implementation"}
    assert environment["server"]["operatingSystem"]
    assert environment["server"]["architecture"]
    assert set(environment["server"]) == {
        "operatingSystem",
        "osRelease",
        "architecture",
    }
    libraries = environment["dependencies"]["libraries"]
    assert libraries
    assert all(
        set(library) == {"name", "version"} and library["version"]
        for library in libraries
    )
    assert "pathlib" not in {library["name"] for library in libraries}
    assert not any(library["name"].startswith("examples.") for library in libraries)
