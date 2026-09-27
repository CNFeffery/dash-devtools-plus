"""Regression coverage for application boundaries and distribution ownership."""

import json
import os
import subprocess
import sys
from types import ModuleType, SimpleNamespace

import pytest
from dash import Dash, html

from dash_devtools_plus import dependency_inventory as inventory
from dash_devtools_plus import plugin


def loaded_module(monkeypatch, name, path, source="", encoding="utf-8"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding=encoding)
    module = ModuleType(name)
    module.__file__ = str(path)
    module.__package__ = name if path.name == "__init__.py" else name.rpartition(".")[0]
    monkeypatch.setitem(sys.modules, name, module)
    return module


def fake_app(name, callbacks=None, layout=None):
    return SimpleNamespace(
        config={"name": name},
        server=SimpleNamespace(),
        callback_map=callbacks or {},
        layout=layout,
    )


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "gbk"])
def test_python_source_encoding(monkeypatch, tmp_path, encoding):
    source = f"# coding: {encoding}\n# 中文\nimport json\n"
    module = loaded_module(
        monkeypatch, "encoding_app", tmp_path / "app.py", source, encoding
    )
    scan = inventory.scan_application(fake_app(module.__name__))
    assert "json" in scan.imports
    assert scan.diagnostics()["status"] == "complete"


@pytest.mark.parametrize("backend", ["flask", "fastapi"])
@pytest.mark.parametrize("callable_layout", [False, True])
def test_real_dash_entry_with_no_callbacks(
    monkeypatch, tmp_path, backend, callable_layout
):
    if backend == "fastapi":
        pytest.importorskip("fastapi")
    name = f"entry_{backend}_{callable_layout}"
    module = loaded_module(
        monkeypatch,
        name,
        tmp_path / "server.py",
        "from dash import Dash, html\nimport json\n",
    )
    app = Dash(name, backend=backend, assets_folder=str(tmp_path / "assets"))
    if callable_layout:
        module.__dict__["html"] = html
        exec("def layout(): return html.Div()", module.__dict__)
        app.layout = module.layout
    else:
        app.layout = html.Div()
    monkeypatch.chdir(tmp_path.parent)
    scan = inventory.scan_application(app)
    assert scan.root == tmp_path
    assert {"dash", "dash.html", "json"} <= scan.imports


def test_unmarked_project_root_does_not_depend_on_callback_order(monkeypatch, tmp_path):
    loaded_module(monkeypatch, "entry", tmp_path / "server.py", "import json\n")
    loaded_module(
        monkeypatch, "views.screen", tmp_path / "views" / "screen.py", "import csv\n"
    )
    loaded_module(
        monkeypatch,
        "callbacks.page",
        tmp_path / "callbacks" / "page.py",
        "import email\n",
    )
    callbacks = {}
    for name in ["views.screen", "callbacks.page"]:

        def callback():
            return None

        callback.__module__ = name
        callbacks[name] = {"callback": callback}
    import csv  # noqa: F401
    import email  # noqa: F401

    for mapping in [callbacks, dict(reversed(list(callbacks.items())))]:
        scan = inventory.scan_application(fake_app("entry", mapping))
        assert scan.root == tmp_path
        assert {"json", "csv", "email"} <= scan.imports


def test_application_root_is_stable_across_hash_seeds(tmp_path):
    (tmp_path / "server.py").write_text("import json\n", encoding="utf-8")
    (tmp_path / "callbacks").mkdir()
    (tmp_path / "callbacks" / "page.py").write_text("import csv\n", encoding="utf-8")
    script = """
import csv, json, sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from dash_devtools_plus.dependency_inventory import scan_application
root=Path(sys.argv[1])
for name, file in [('entry', 'server.py'), ('callbacks.page', 'callbacks/page.py')]:
    module=ModuleType(name); module.__file__=str(root/file); sys.modules[name]=module
def callback(): pass
callback.__module__='callbacks.page'
app=SimpleNamespace(config={'name':'entry'}, layout=None, server=None,
    callback_map={'x':{'callback':callback}})
scan=scan_application(app)
print(json.dumps([str(scan.root), sorted(scan.imports)]))
"""
    results = [
        subprocess.check_output(
            [sys.executable, "-B", "-c", script, str(tmp_path)],
            env={**os.environ, "PYTHONHASHSEED": seed},
            text=True,
        ).strip()
        for seed in ["0", "1", "5"]
    ]
    assert len(set(results)) == 1
    assert json.loads(results[0])[1] == ["csv", "json"]


def test_local_parent_imports_and_application_isolation(monkeypatch, tmp_path):
    root = tmp_path / "one"
    loaded_module(monkeypatch, "one", root / "__init__.py", "import json\n")
    loaded_module(monkeypatch, "one.entry", root / "entry.py", "from . import page\n")
    loaded_module(monkeypatch, "one.page", root / "page.py", "import csv\n")
    loaded_module(
        monkeypatch, "other.entry", tmp_path / "other" / "entry.py", "import email\n"
    )
    import csv  # noqa: F401

    scan = inventory.scan_application(fake_app("one.entry"), root)
    assert {"json", "csv"} <= scan.imports
    assert "email" not in scan.imports
    assert scan.local_modules == {"one", "one.entry", "one.page"}


def test_dynamic_imports_and_refresh(monkeypatch, tmp_path):
    source = """import importlib as il
from importlib import import_module as load
il.import_module("late_package")
load("json")
__import__("csv")
load(variable_name)
"""
    module = loaded_module(monkeypatch, "dynamic_app", tmp_path / "app.py", source)
    import csv  # noqa: F401

    first = inventory.scan_application(fake_app(module.__name__))
    assert {"json", "csv"} <= first.imports
    assert "late_package" not in first.imports
    assert first.issues == [
        {"module": "dynamic_app", "reason": "dynamic-import-unresolved"}
    ]
    monkeypatch.setitem(sys.modules, "late_package", ModuleType("late_package"))
    second = inventory.scan_application(fake_app(module.__name__))
    assert "late_package" in second.imports


def test_loaded_sibling_apps_are_not_import_evidence(monkeypatch, tmp_path):
    parent = loaded_module(monkeypatch, "apps", tmp_path / "apps" / "__init__.py")
    first = loaded_module(
        monkeypatch,
        "apps.first",
        tmp_path / "apps" / "first.py",
        "from . import shared\n",
    )
    second = loaded_module(
        monkeypatch, "apps.second", tmp_path / "apps" / "second.py", "import csv\n"
    )
    shared = loaded_module(
        monkeypatch, "apps.shared", tmp_path / "apps" / "shared.py", "import json\n"
    )
    parent.first, parent.second, parent.shared = first, second, shared
    import csv  # noqa: F401

    scan = inventory.scan_application(fake_app(first.__name__), tmp_path)
    assert "json" in scan.imports
    assert "csv" not in scan.imports
    assert "apps.second" not in scan.local_modules


def test_registered_hook_is_separate_from_direct_imports(monkeypatch, tmp_path):
    source = tmp_path / "site-packages" / "auto_hook.py"
    loaded_module(monkeypatch, "auto_hook", source)
    dist = FakeDistribution(source.parent, "Auto-Hook", ["auto_hook.py"])
    monkeypatch.setattr(inventory.metadata, "distributions", lambda: [dist])
    monkeypatch.setattr(
        plugin, "scan_application", lambda app, root: inventory.ImportScan(tmp_path)
    )
    monkeypatch.setattr(plugin, "_component_library_metadata", lambda: [])
    monkeypatch.setattr(
        plugin,
        "build_hook_inventory",
        lambda app: {
            "libraries": [
                {
                    "id": "auto-hook",
                    "name": "Auto-Hook",
                    "version": "1.2",
                    "status": "registered",
                    "snapshotCount": 1,
                    "modules": ["auto_hook"],
                }
            ],
            "dashVersion": "4.4.1",
            "completeness": {"appSnapshot": "complete"},
            "summary": {},
            "orderWarnings": [],
            "unassigned": [],
        },
    )
    result = plugin._loaded_dependency_metadata(fake_app("missing"))
    assert result["libraries"] == []
    assert result["runtimeHooks"] == [{"name": "Auto-Hook", "version": "1.2"}]


def test_registered_components_do_not_require_generated_private_names(
    monkeypatch, tmp_path
):
    from dash.development.base_component import Component, ComponentRegistry

    monkeypatch.setattr(ComponentRegistry, "registry", set(ComponentRegistry.registry))
    monkeypatch.setattr(
        ComponentRegistry,
        "namespace_to_package",
        dict(ComponentRegistry.namespace_to_package),
    )
    monkeypatch.setattr(
        ComponentRegistry, "children_props", ComponentRegistry.children_props.copy()
    )
    module = loaded_module(monkeypatch, "custom_widget", tmp_path / "custom_widget.py")
    module.Widget = type(
        "Widget",
        (Component,),
        {"__module__": "custom_widget", "_namespace": "custom_widget"},
    )
    assert not hasattr(module, "_component")
    components = plugin._component_library_metadata()
    assert any(item["module"] == "custom_widget" for item in components)


def test_read_failure_is_reported_without_paths(monkeypatch, tmp_path):
    module = loaded_module(
        monkeypatch, "broken_app", tmp_path / "app.py", "invalid python !"
    )
    scan = inventory.scan_application(fake_app(module.__name__))
    assert {"module": "broken_app", "reason": "source-unreadable"} in scan.issues
    assert scan.diagnostics()["status"] == "partial"
    assert str(tmp_path) not in json.dumps(scan.diagnostics())


class FakeDistribution:
    def __init__(self, root, name, files=(), version="1.2", editable=None):
        self.root, self.metadata, self.files = root, {"Name": name}, files
        self.version, self.editable = version, editable

    def locate_file(self, file):
        return self.root / file

    def read_text(self, name):
        if name == "direct_url.json" and self.editable:
            return json.dumps(
                {"url": self.editable.as_uri(), "dir_info": {"editable": True}}
            )
        return None


def resolver(monkeypatch, mapping, distributions):
    monkeypatch.setattr(inventory.metadata, "distributions", lambda: distributions)
    index = inventory.DistributionResolver()
    index.mapping = mapping
    return index


def test_namespace_providers_use_concrete_files(monkeypatch, tmp_path):
    loaded_module(monkeypatch, "shared.alpha", tmp_path / "shared" / "alpha.py")
    loaded_module(monkeypatch, "shared.beta", tmp_path / "shared" / "beta.py")
    monkeypatch.setitem(sys.modules, "shared", ModuleType("shared"))
    index = resolver(
        monkeypatch,
        {"shared": ["Alpha", "Beta"]},
        [
            FakeDistribution(tmp_path, "Alpha", ["shared/alpha.py"]),
            FakeDistribution(tmp_path, "Beta", ["shared/beta.py"]),
        ],
    )
    assert index.resolve("shared.alpha") == [{"name": "Alpha", "version": "1.2"}]
    assert index.resolve("shared.beta") == [{"name": "Beta", "version": "1.2"}]
    assert index.resolve("shared") == []


def test_local_shadow_is_not_attributed_to_installed_distribution(
    monkeypatch, tmp_path
):
    loaded_module(monkeypatch, "widget", tmp_path / "project" / "widget.py")
    index = resolver(
        monkeypatch,
        {"widget": ["Widget"]},
        [
            FakeDistribution(tmp_path / "site-packages", "Widget", ["widget.py"]),
        ],
    )
    assert index.resolve("widget") == []


def test_editable_package_without_top_level_metadata(monkeypatch, tmp_path):
    root = tmp_path / "editable space"
    loaded_module(monkeypatch, "custom_widget", root / "src" / "custom_widget.py")
    dist = FakeDistribution(
        tmp_path, "Different-Distribution", editable=root, version=None
    )
    index = resolver(monkeypatch, {}, [dist])
    assert index.resolve("custom_widget") == [
        {"name": "Different-Distribution", "version": None}
    ]


def test_distribution_snapshot_refreshes_versions(monkeypatch, tmp_path):
    loaded_module(monkeypatch, "widget", tmp_path / "widget.py")
    dist = FakeDistribution(tmp_path, "Widget", ["widget.py"])
    first = resolver(monkeypatch, {"widget": ["Widget"]}, [dist])
    assert first.resolve("widget")[0]["version"] == "1.2"
    dist.version = "2.0"
    assert inventory.DistributionResolver().resolve("widget")[0]["version"] == "2.0"


def test_environment_uses_distribution_identity_and_keeps_unknown_versions():
    records = [
        {
            "name": name,
            "category": "dash-component",
            "version": "99.0",
            "distributions": [{"name": "dash", "version": "4.4.1"}],
        }
        for name in ["dash", "dash-core-components", "dash-html-components"]
    ]
    records.append(
        {
            "name": "widget",
            "category": "other",
            "version": None,
            "distributions": [{"name": "Widget", "version": None}],
        }
    )
    assert inventory.environment_libraries(records) == [
        {"name": "dash", "version": "4.4.1"},
        {"name": "Widget", "version": None},
    ]


@pytest.mark.parametrize("backend", ["flask", "fastapi"])
def test_feffery_components_reach_both_endpoints(monkeypatch, tmp_path, backend):
    if backend == "fastapi":
        pytest.importorskip("fastapi")
    pytest.importorskip("feffery_utils_components")
    pytest.importorskip("feffery_markdown_components")
    source = """from dash import Dash, html
import feffery_utils_components as fuc
import feffery_markdown_components as fmc
app = Dash(__name__, backend=BACKEND)
app.layout = html.Div([fuc.FefferyTopProgress([]), fmc.FefferyMarkdown()])
"""
    name = "feffery_probe_" + backend
    module = loaded_module(monkeypatch, name, tmp_path / "app.py", source)
    module.__dict__["BACKEND"] = backend
    monkeypatch.setattr(plugin, "_PROJECT_ROOT", None)
    exec(compile(source, module.__file__, "exec"), module.__dict__)
    app = module.app
    app.enable_dev_tools(
        debug=True,
        dev_tools_ui=True,
        dev_tools_hot_reload=False,
        dev_tools_disable_version_check=True,
    )
    if backend == "fastapi":
        from fastapi.testclient import TestClient

        client = TestClient(app.server)

        def get_json(route):
            return client.get(route).json()
    else:
        client = app.server.test_client()

        def get_json(route):
            return client.get(route).get_json()

    dependencies = get_json("/_dash-devtools-plus/dependencies")
    environment = get_json("/_dash-devtools-plus/runtime-environment")
    expected = {"feffery_utils_components", "feffery_markdown_components"}
    assert expected <= {item["name"] for item in dependencies["libraries"]}
    assert expected <= {
        item["name"] for item in environment["dependencies"]["libraries"]
    }
    assert "dash-core-components" not in {
        item["name"] for item in environment["dependencies"]["libraries"]
    }
