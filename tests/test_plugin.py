import inspect
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from dash import Dash, html, hooks

import dash_devtools_plus
from dash_devtools_plus import configure_devtools_plus, register
from dash_devtools_plus import plugin


def test_registration_is_idempotent_and_configurable():
    register()
    register()
    configure_devtools_plus(default_locale="zh-CN", accent_color="#00ffaa")

    devtools = hooks.get_hooks("dev_tools")
    ours = [item for item in devtools if item["namespace"] == "DashDevtoolsPlus"]
    assert len(ours) == 1
    assert ours[0]["position"] == "left"
    props = ours[0]["props"]()
    assert props["defaultLocale"] == "zh-CN"
    assert props["accentColor"] == "#00ffaa"
    assert isinstance(props["enabled"], bool)
    assert props["callbacksEndpoint"] == "_dash-devtools-plus/callbacks"
    assert props["componentLibrariesEndpoint"] == "_dash-devtools-plus/component-libraries"
    assert props["hookLibrariesEndpoint"] == "_dash-devtools-plus/hook-libraries"
    assert props["serverMetricsEndpoint"] == "_dash-devtools-plus/server-metrics"
    assert "metricsEndpoint" not in props
    assert "metricsInterval" not in props


def test_devtools_config_has_no_metrics_route():
    app = Dash(__name__)
    app.layout = html.Div("test")
    app.enable_dev_tools(dev_tools_ui=True, dev_tools_disable_version_check=True)

    rules = {rule.rule for rule in app.server.url_map.iter_rules()}
    assert "/dash-devtools-plus/metrics" not in rules

    config = json.loads(app._generate_config_html().split(">", 1)[1].rsplit("<", 1)[0])
    assert any(item["namespace"] == "DashDevtoolsPlus" for item in config["dev_tools"])


@pytest.mark.parametrize(
    "endpoint",
    [
        "/_dash-devtools-plus/callbacks",
        "/_dash-devtools-plus/component-libraries",
        "/_dash-devtools-plus/hook-libraries",
        "/_dash-devtools-plus/server-metrics",
    ],
)
def test_all_routes_are_disabled_without_debug(endpoint):
    app = Dash(__name__)
    app.layout = html.Div("test")

    response = app.server.test_client().get(endpoint)

    assert response.status_code == 404
    assert response.headers["Cache-Control"] == "no-store, max-age=0"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.parametrize(
    "endpoint",
    [
        "/_dash-devtools-plus/callbacks",
        "/_dash-devtools-plus/component-libraries",
        "/_dash-devtools-plus/hook-libraries",
        "/_dash-devtools-plus/server-metrics",
    ],
)
def test_dev_tools_ui_alone_does_not_enable_routes(endpoint):
    app = Dash(__name__)
    app.layout = html.Div("test")
    app.enable_dev_tools(
        debug=False,
        dev_tools_ui=True,
        dev_tools_disable_version_check=True,
    )

    response = app.server.test_client().get(endpoint)

    assert response.status_code == 404


def test_frontend_component_is_disabled_when_only_dev_tools_ui_is_enabled():
    app = Dash(__name__)
    app.layout = html.Div("test")
    app.enable_dev_tools(debug=False, dev_tools_ui=True)

    page = app.server.test_client().get("/").get_data(as_text=True)
    config_markup = page.split('<script id="_dash-config"', 1)[1].split(">", 1)[1]
    config = json.loads(config_markup.split("</script>", 1)[0])
    ours = next(
        item for item in config["dev_tools"] if item["namespace"] == "DashDevtoolsPlus"
    )

    assert ours["props"]["enabled"] is False


def test_debug_mode_enables_frontend_and_routes_with_no_store_headers():
    app = Dash(__name__)
    app.layout = html.Div("test")
    app.enable_dev_tools(
        debug=True,
        dev_tools_ui=True,
        dev_tools_disable_version_check=True,
        dev_tools_hot_reload=False,
    )

    client = app.server.test_client()
    page = client.get("/").get_data(as_text=True)
    config_markup = page.split('<script id="_dash-config"', 1)[1].split(">", 1)[1]
    config = json.loads(config_markup.split("</script>", 1)[0])
    ours = next(
        item for item in config["dev_tools"] if item["namespace"] == "DashDevtoolsPlus"
    )
    response = client.get("/_dash-devtools-plus/callbacks")

    assert ours["props"]["enabled"] is True
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, max-age=0"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_built_assets_exist_and_are_registered():
    asset_dir = Path(dash_devtools_plus.__file__).parent / "assets"
    assert (asset_dir / "dash_devtools_plus.js").stat().st_size > 10_000
    assert (asset_dir / "dash_devtools_plus.css").stat().st_size > 1_000
    script = (asset_dir / "dash_devtools_plus.js").read_text(encoding="utf-8")
    assert "window.DashDevtoolsPlus" in script
    assert "dash-devtools-plus-runtime-styles" in script
    resources = [
        resource
        for resource in hooks._js_dist + hooks._css_dist
        if resource.get("namespace") == "dash_devtools_plus"
    ]
    assert resources
    assert all(resource["dev_only"] for resource in resources)


def test_config_validation():
    try:
        configure_devtools_plus(default_locale="fr")
    except ValueError as error:
        assert "default_locale" in str(error)
    else:
        raise AssertionError("Unsupported locale should fail")

    try:
        configure_devtools_plus(editor="not-an-editor")
    except ValueError as error:
        assert "editor" in str(error)
    else:
        raise AssertionError("Unsupported editor should fail")


def test_callback_source_builds_mapped_ide_uris():
    workspace = Path(__file__).parents[1]

    def callback_for_editor_test():
        """Describe an example callback.

        Details:
            Relative indentation is preserved.
        """

        return None

    try:
        configure_devtools_plus(
            editor="cursor",
            project_root=workspace,
            editor_project_root=r"D:\workspaces\Dash demo",
        )
        with patch.object(
            plugin,
            "_editor_supported",
            side_effect=lambda editor: editor != "pycharm",
        ):
            source = plugin._callback_source(callback_for_editor_test)

        assert source["path"] == "tests/test_plugin.py"
        assert source["editorUri"] == (
            "cursor://file/D:/workspaces/Dash%20demo/tests/test_plugin.py:"
            f"{inspect.getsourcelines(callback_for_editor_test)[1]}:1"
        )
        targets = {target["id"]: target for target in source["editorUris"]}
        assert list(target["id"] for target in source["editorUris"]) == [
            "cursor",
            "vscode",
            "pycharm",
        ]
        assert targets["cursor"]["uri"].startswith(
            "cursor://file/D:/workspaces/Dash%20demo/tests/test_plugin.py:"
        )
        assert targets["pycharm"]["uri"].startswith(
            "pycharm://open?file=D:/workspaces/Dash%20demo/tests/test_plugin.py&line="
        )
        assert targets["pycharm"]["uri"].endswith("&column=1")
        assert targets["cursor"]["supported"] is True
        assert targets["vscode"]["supported"] is True
        assert targets["pycharm"]["supported"] is False
        assert source["docstring"] == (
            "Describe an example callback.\n\n"
            "Details:\n"
            "    Relative indentation is preserved."
        )

        configure_devtools_plus(editor=None, project_root=workspace)
        disabled_source = plugin._callback_source(callback_for_editor_test)
        assert disabled_source["editorUri"] is None
        assert disabled_source["editorUris"] == []
    finally:
        configure_devtools_plus()
