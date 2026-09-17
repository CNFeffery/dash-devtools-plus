"""Dash hooks registration for Dash Devtools Plus."""

from __future__ import annotations

import ast
import inspect
import re
import shutil
import sys
import sysconfig
import tokenize
from collections import Counter
from functools import lru_cache, wraps
from importlib import metadata
from pathlib import Path, PurePosixPath, PureWindowsPath
from threading import Lock
from typing import Any, Optional, Union
from urllib.parse import quote
from weakref import WeakKeyDictionary, ref

from dash import get_app, hooks

from .hook_inventory import build_hook_inventory, capture_app_hook_snapshot
from .server_metrics import collect_server_metrics

try:
    from importlib.metadata import packages_distributions
except ImportError:  # Python 3.9 lacks this standard-library API.
    from importlib_metadata import packages_distributions


_LOCK = Lock()
_REGISTERED = False
_DEBUG_STATE_LOCK = Lock()
_APP_DEBUG_STATE: WeakKeyDictionary[Any, bool] = WeakKeyDictionary()
_CLIENTSIDE_SOURCE_LOCK = Lock()
_APP_CLIENTSIDE_SOURCES: WeakKeyDictionary[Any, dict[str, dict[str, Any]]] = (
    WeakKeyDictionary()
)
_CONFIG: dict[str, Any] = {
    "defaultLocale": "en",
    "accentColor": "#119DFF",
}
_CALLBACKS_ROUTE = "_dash-devtools-plus/callbacks"
_DEPENDENCIES_ROUTE = "_dash-devtools-plus/dependencies"
_COMPONENT_LIBRARIES_ROUTE = "_dash-devtools-plus/component-libraries"
_HOOK_LIBRARIES_ROUTE = "_dash-devtools-plus/hook-libraries"
_SERVER_METRICS_ROUTE = "_dash-devtools-plus/server-metrics"
_COMPONENT_LIBRARY_SIGNATURE = frozenset({"_component", "_dash", "_js_dist"})
_PROJECT_MARKERS = ("pyproject.toml", "setup.py", "setup.cfg", ".git")
_EDITOR_ORDER = ("vscode", "cursor", "pycharm")
_EDITOR_LABELS = {
    "vscode": "VS Code",
    "cursor": "Cursor",
    "pycharm": "PyCharm",
}
_EDITOR_COMMANDS = {
    "vscode": ("code",),
    "cursor": ("cursor",),
    "pycharm": ("pycharm", "pycharm-professional", "pycharm-community"),
}
_SUPPORTED_EDITORS = frozenset(_EDITOR_LABELS)
_EDITOR: Optional[str] = "vscode"
_PROJECT_ROOT: Optional[Path] = None
_EDITOR_PROJECT_ROOT: Optional[str] = None


def configure_devtools_plus(
    *,
    default_locale: str = "en",
    accent_color: str = "#119DFF",
    editor: Optional[str] = "vscode",
    project_root: Optional[Union[str, Path]] = None,
    editor_project_root: Optional[Union[str, Path]] = None,
) -> None:
    """Configure Devtools Plus before constructing the :class:`dash.Dash` app.

    Parameters are deliberately small and serialisable because Dash passes them
    directly to the custom React component.
    """

    global _EDITOR, _PROJECT_ROOT, _EDITOR_PROJECT_ROOT

    if default_locale not in {"en", "zh-CN"}:
        raise ValueError("default_locale must be 'en' or 'zh-CN'")
    if editor not in {*_SUPPORTED_EDITORS, None}:
        supported = ", ".join(repr(name) for name in _EDITOR_ORDER)
        raise ValueError(f"editor must be one of {supported}, or None")

    resolved_project_root = None
    if project_root is not None:
        resolved_project_root = Path(project_root).expanduser().resolve()
        if not resolved_project_root.is_dir():
            raise ValueError("project_root must point to an existing directory")

    client_root = None
    if editor_project_root is not None:
        client_root = str(editor_project_root).strip()
        if not client_root:
            raise ValueError("editor_project_root must not be empty")

    _EDITOR = editor
    _PROJECT_ROOT = resolved_project_root
    _EDITOR_PROJECT_ROOT = client_root
    _CONFIG.update(
        defaultLocale=default_locale,
        accentColor=accent_color,
    )
    register()


def _component_props() -> dict[str, Any]:
    try:
        app = get_app()
    except Exception:  # Dash can call props outside an active app context.
        app = None

    return _component_props_for(app)


def _component_props_for(app: Any | None) -> dict[str, Any]:
    """Build props for one app so multi-app processes cannot share debug state."""

    return {
        **_CONFIG,
        "enabled": bool(app is not None and _devtools_enabled(app)),
        "callbacksEndpoint": _CALLBACKS_ROUTE,
        "dependenciesEndpoint": _DEPENDENCIES_ROUTE,
        "componentLibrariesEndpoint": _COMPONENT_LIBRARIES_ROUTE,
        "hookLibrariesEndpoint": _HOOK_LIBRARIES_ROUTE,
        "serverMetricsEndpoint": _SERVER_METRICS_ROUTE,
    }


def _set_debug_state(app: Any, enabled: bool) -> None:
    """Remember the explicit ``debug`` value resolved by Dash for one app."""

    try:
        with _DEBUG_STATE_LOCK:
            _APP_DEBUG_STATE[app] = bool(enabled)
    except TypeError:
        # Keep compatibility if a future Dash app becomes non-weakrefable.
        return


def _tracked_debug_state(app: Any) -> bool:
    try:
        with _DEBUG_STATE_LOCK:
            return bool(_APP_DEBUG_STATE.get(app, False))
    except TypeError:
        return False


def _backend_debug_state(app: Any) -> bool:
    """Read the live backend debug flag without assuming Flask internals."""

    backend_server = getattr(getattr(app, "backend", None), "server", None)
    if backend_server is None:
        backend_server = getattr(app, "server", None)
    return bool(getattr(backend_server, "debug", False))


def _devtools_enabled(app: Any) -> bool:
    """Require both debug mode and the native Dash Dev Tools UI."""

    dev_tools = getattr(app, "_dev_tools", {})  # pylint: disable=protected-access
    ui_enabled = bool(getattr(dev_tools, "get", lambda *_: False)("ui"))
    debug_enabled = _tracked_debug_state(app) or _backend_debug_state(app)
    return debug_enabled and ui_enabled


def _install_debug_tracker(app: Any) -> None:
    """Track Dash's resolved debug value without retaining application objects."""

    original = app.enable_dev_tools
    if getattr(original, "_dash_devtools_plus_debug_tracker", False):
        return

    @wraps(original)
    def tracked_enable_dev_tools(*args: Any, **kwargs: Any) -> bool:
        debug_enabled = original(*args, **kwargs)
        _set_debug_state(app, bool(debug_enabled))
        return debug_enabled

    tracked_enable_dev_tools._dash_devtools_plus_debug_tracker = True  # type: ignore[attr-defined]
    app.enable_dev_tools = tracked_enable_dev_tools
    _set_debug_state(app, _backend_debug_state(app))


def _bind_component_props(app: Any) -> None:
    """Bind the cloned Devtools Plus registration to its owning Dash app."""

    app_reference = ref(app)

    def app_component_props() -> dict[str, Any]:
        return _component_props_for(app_reference())

    app_component_props.__module__ = __name__
    app_component_props.__name__ = "app_component_props"
    for devtools_hook in app._hooks.get_hooks("dev_tools"):  # pylint: disable=protected-access
        if devtools_hook.get("namespace") == "DashDevtoolsPlus":
            devtools_hook["props"] = app_component_props


def _setup_app(app: Any) -> None:
    """Install the security boundary before capturing hook registrations."""

    _install_debug_tracker(app)
    _bind_component_props(app)
    _install_clientside_source_tracker(app)
    capture_app_hook_snapshot(app)


def _harden_response(response: Any) -> Any:
    """Prevent sensitive development metadata from being cached or sniffed."""

    headers = getattr(response, "headers", None)
    if headers is not None:
        headers["Cache-Control"] = "no-store, max-age=0"
        headers["Pragma"] = "no-cache"
        headers["X-Content-Type-Options"] = "nosniff"
    return response


def _make_text_response(app: Any, body: str, status: int) -> Any:
    """Create a text response across Dash 3's Flask and Dash 4 backends."""

    backend = getattr(app, "backend", None)
    make_response = getattr(backend, "make_response", None)
    if callable(make_response):
        return make_response(body, status=status)

    server = getattr(app, "server", None)
    make_response = getattr(server, "make_response", None)
    if not callable(make_response):
        raise RuntimeError("Dash application does not expose a response factory")
    return make_response((body, status))


def _make_json_response(app: Any, payload: Any) -> Any:
    """Create a JSON response across Dash 3's Flask and Dash 4 backends."""

    backend = getattr(app, "backend", None)
    jsonify = getattr(backend, "jsonify", None)
    if callable(jsonify):
        return jsonify(payload)

    server = getattr(app, "server", None)
    json_response = getattr(getattr(server, "json", None), "response", None)
    if callable(json_response):
        return json_response(payload)

    # Flask versions supported by Dash 3 predate the app.json provider.
    from flask import jsonify as flask_jsonify  # pylint: disable=import-outside-toplevel

    return flask_jsonify(payload)


def _debug_only_response(app: Any, payload_factory: Any) -> Any:
    """Serve a payload only inside an explicitly debug-enabled Dash app."""

    if not _devtools_enabled(app):
        return _harden_response(_make_text_response(app, "Not Found", 404))
    return _harden_response(_make_json_response(app, payload_factory()))


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _is_project_source(source_file: Path, project_root: Path) -> bool:
    """Return whether a source belongs to the project rather than its env."""

    if not _is_relative_to(source_file, project_root):
        return False
    source_parts = {part.casefold() for part in source_file.parts}
    return source_parts.isdisjoint({"site-packages", "dist-packages"})


def _source_root(source_file: Path) -> Optional[Path]:
    """Find a project boundary without exposing paths outside the project."""

    if _PROJECT_ROOT is not None:
        return _PROJECT_ROOT if _is_relative_to(source_file, _PROJECT_ROOT) else None

    candidates = (Path.cwd().resolve(), *source_file.parents)
    for candidate in candidates:
        if not _is_relative_to(source_file, candidate):
            continue
        if any((candidate / marker).exists() for marker in _PROJECT_MARKERS):
            return candidate
    return source_file.parent


def _editor_uri(
    editor: str, source_file: Path, source_root: Path, line: int
) -> Optional[str]:
    """Build an IDE URI for a verified file contained by the project root."""

    if editor not in _SUPPORTED_EDITORS or not _is_relative_to(
        source_file, source_root
    ):
        return None

    relative_path = source_file.relative_to(source_root)
    editor_root = _EDITOR_PROJECT_ROOT or str(source_root)
    is_windows_path = (
        bool(re.match(r"^[A-Za-z]:[\\/]", editor_root)) or "\\" in editor_root
    )
    if is_windows_path:
        target_path = PureWindowsPath(editor_root, *relative_path.parts).as_posix()
    else:
        target_path = PurePosixPath(editor_root, *relative_path.parts).as_posix()

    encoded_path = quote(target_path, safe="/:")
    if editor == "pycharm":
        return f"pycharm://open?file={encoded_path}&line={line}&column=1"

    uri_path = encoded_path if encoded_path.startswith("/") else f"/{encoded_path}"
    return f"{editor}://file{uri_path}:{line}:1"


def _windows_url_protocol_registered(scheme: str) -> bool:
    """Check the merged Windows URL protocol registry without launching an app."""

    try:
        import winreg  # pylint: disable=import-outside-toplevel

        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, scheme) as protocol_key:
            try:
                winreg.QueryValueEx(protocol_key, "URL Protocol")
            except OSError:
                return False

        with winreg.OpenKey(
            winreg.HKEY_CLASSES_ROOT, rf"{scheme}\shell\open\command"
        ) as command_key:
            command, _ = winreg.QueryValueEx(command_key, None)
            return bool(str(command).strip())
    except (ImportError, OSError):
        return False


@lru_cache(maxsize=len(_EDITOR_ORDER))
def _editor_supported(editor: str) -> bool:
    """Best-effort detection of IDE URL handlers on the Dash server host."""

    if editor not in _SUPPORTED_EDITORS:
        return False
    if sys.platform == "win32":
        return _windows_url_protocol_registered(editor)

    if any(shutil.which(command) for command in _EDITOR_COMMANDS[editor]):
        return True
    if sys.platform != "darwin":
        return False

    application_names = {
        "vscode": ("Visual Studio Code.app",),
        "cursor": ("Cursor.app",),
        "pycharm": ("PyCharm.app", "PyCharm Professional.app", "PyCharm CE.app"),
    }
    application_roots = (Path("/Applications"), Path.home() / "Applications")
    return any(
        (root / application_name).is_dir()
        for root in application_roots
        for application_name in application_names[editor]
    )


def _editor_targets(
    source_file: Path, source_root: Path, line: int
) -> list[dict[str, Any]]:
    """Return trusted IDE targets, with the configured preference listed first."""

    if _EDITOR is None:
        return []

    editor_order = (
        _EDITOR,
        *(_editor for _editor in _EDITOR_ORDER if _editor != _EDITOR),
    )
    targets = []
    for editor in editor_order:
        uri = _editor_uri(editor, source_file, source_root, line)
        if uri is not None:
            targets.append(
                {
                    "id": editor,
                    "label": _EDITOR_LABELS[editor],
                    "uri": uri,
                    "supported": _editor_supported(editor),
                }
            )
    return targets


def _source_location(
    source_path_value: str,
    line: int,
    *,
    kind: str,
    function: Optional[str],
    docstring: Optional[str] = None,
) -> dict[str, Any]:
    """Build safe, project-relative source metadata for the debug endpoint."""

    source_path = Path(source_path_value).resolve()
    root = _source_root(source_path)
    if root is None:
        raise ValueError("callback source is outside the configured project root")
    relative_path = source_path.relative_to(root).as_posix()
    editor_targets = _editor_targets(source_path, root, line)
    return {
        "kind": kind,
        "function": function,
        "path": relative_path,
        "line": line,
        "editorUri": editor_targets[0]["uri"] if editor_targets else None,
        "editorUris": editor_targets,
        "docstring": docstring,
    }


def _callback_docstring(callback: Any) -> Optional[str]:
    """Return a display-ready Docstring while preserving relative indentation."""

    try:
        original = inspect.unwrap(callback)
        value = getattr(original, "__doc__", None)
        if not isinstance(value, str):
            return None
        cleaned = inspect.cleandoc(value)
        return cleaned or None
    except (AttributeError, TypeError, ValueError):
        return None


@lru_cache(maxsize=128)
def _source_tree(source_path_value: str, modified_time_ns: int) -> ast.Module:
    """Parse a source file using its declared encoding and cache its current AST."""

    del modified_time_ns  # The cache key invalidates the entry when the file changes.
    with tokenize.open(source_path_value) as source_file:
        return ast.parse(source_file.read(), filename=source_path_value)


def _definition_for_qualname(nodes: list[ast.stmt], parts: list[str]) -> Optional[ast.AST]:
    """Find a function definition from its module-relative qualified name."""

    if not parts:
        return None
    for node in nodes:
        if not isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if node.name != parts[0]:
            continue
        if len(parts) == 1:
            return node
        return _definition_for_qualname(node.body, parts[1:])
    return None


def _current_callback_source_line(callback: Any, source_path_value: str) -> int:
    """Locate a callback in the current source file, falling back to its code object."""

    fallback_line = inspect.getsourcelines(callback)[1]
    try:
        source_path = Path(source_path_value).resolve()
        qualname = getattr(callback, "__qualname__", "")
        parts = [part for part in qualname.split(".") if part != "<locals>"]
        tree = _source_tree(str(source_path), source_path.stat().st_mtime_ns)
        definition = _definition_for_qualname(tree.body, parts)
        if not isinstance(definition, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return fallback_line
        return min(
            [definition.lineno, *(decorator.lineno for decorator in definition.decorator_list)]
        )
    except (OSError, SyntaxError, TypeError, UnicodeError, ValueError):
        return fallback_line


def _callback_source(callback: Any) -> dict[str, Any]:
    if callback is None:
        return {
            "kind": "clientside",
            "function": None,
            "path": None,
            "line": None,
            "editorUri": None,
            "editorUris": [],
            "docstring": None,
        }

    docstring = _callback_docstring(callback)
    try:
        original = inspect.unwrap(callback)
        source_path_value = inspect.getsourcefile(original) or inspect.getfile(original)
        line = _current_callback_source_line(original, source_path_value)
        return _source_location(
            source_path_value,
            line,
            kind="python",
            function=getattr(original, "__name__", type(original).__name__),
            docstring=docstring,
        )
    except (OSError, TypeError, ValueError):
        return {
            "kind": "unavailable",
            "function": getattr(callback, "__name__", None),
            "path": None,
            "line": None,
            "editorUri": None,
            "editorUris": [],
            "docstring": docstring,
        }


def _clientside_registration_source(caller_frame: Any) -> dict[str, Any]:
    """Describe the Python statement that registered a clientside callback."""

    if caller_frame is None:
        return _callback_source(None)
    try:
        return _source_location(
            caller_frame.f_code.co_filename,
            caller_frame.f_lineno,
            kind="clientside-registration",
            function="app.clientside_callback",
        )
    except (AttributeError, OSError, TypeError, ValueError):
        return _callback_source(None)


def _install_clientside_source_tracker(app: Any) -> None:
    """Capture each ``app.clientside_callback`` call site for this Dash app."""

    original = app.clientside_callback
    if getattr(original, "_dash_devtools_plus_source_tracker", False):
        return

    @wraps(original)
    def tracked_clientside_callback(*args: Any, **kwargs: Any) -> Any:
        current_frame = inspect.currentframe()
        try:
            source = _clientside_registration_source(
                current_frame.f_back if current_frame is not None else None
            )
        finally:
            del current_frame

        with _CLIENTSIDE_SOURCE_LOCK:
            dependency_count = len(app._callback_list)  # pylint: disable=protected-access
            result = original(*args, **kwargs)
            new_dependencies = app._callback_list[dependency_count:]  # pylint: disable=protected-access
            app_sources = _APP_CLIENTSIDE_SOURCES.setdefault(app, {})
            for dependency in new_dependencies:
                callback_id = dependency.get("output")
                if callback_id:
                    app_sources[callback_id] = source
        return result

    tracked_clientside_callback._dash_devtools_plus_source_tracker = True  # type: ignore[attr-defined]
    app.clientside_callback = tracked_clientside_callback


def _tracked_clientside_source(app: Any, callback_id: Any) -> dict[str, Any]:
    try:
        with _CLIENTSIDE_SOURCE_LOCK:
            source = _APP_CLIENTSIDE_SOURCES.get(app, {}).get(callback_id)
    except TypeError:
        source = None
    return dict(source) if source is not None else _callback_source(None)


def _callback_metadata(app: Any) -> list[dict[str, Any]]:
    callbacks = []
    for dependency in app._callback_list:  # pylint: disable=protected-access
        item = dict(dependency)
        callback_id = item.get("output")
        callback_entry = app.callback_map.get(callback_id, {})
        if item.get("no_output"):
            # Dash uses an internal hash as the registry key for callbacks with
            # no declared Output. It is an implementation detail, not a role.
            item["output"] = None
        item["mcp_enabled"] = callback_entry.get("mcp_enabled")
        if item.get("clientside_function"):
            item["source"] = _tracked_clientside_source(app, callback_id)
        else:
            item["source"] = _callback_source(callback_entry.get("callback"))
        callbacks.append(item)
    return callbacks


def _serve_callback_metadata():
    app = get_app()
    return _debug_only_response(app, lambda: _callback_metadata(app))


def _component_library_metadata() -> list[dict[str, Any]]:
    """Return loaded Dash component libraries identified by their signature."""

    libraries: list[tuple[int, dict[str, Any]]] = []
    seen_modules: set[int] = set()
    for module_name, module in tuple(sys.modules.items()):
        if module is None or id(module) in seen_modules:
            continue
        try:
            if not _COMPONENT_LIBRARY_SIGNATURE.issubset(dir(module)):
                continue

            seen_modules.add(id(module))
            package = getattr(module, "package", None)
            package_metadata = package if isinstance(package, dict) else {}
            display_name = (
                package_metadata.get("name")
                or getattr(module, "package_name", None)
                or module_name
            )
            version = getattr(module, "__version__", None) or package_metadata.get(
                "version"
            )
            exports = getattr(module, "__all__", ())
            js_dist = getattr(module, "_js_dist", ())

            libraries.append(
                (
                    id(module),
                    {
                        "module": module_name,
                        "name": str(display_name),
                        "version": str(version) if version is not None else None,
                        "exports": len(exports)
                        if hasattr(exports, "__len__")
                        else None,
                        "jsAssets": len(js_dist)
                        if hasattr(js_dist, "__len__")
                        else None,
                        "scope": "core"
                        if module_name.startswith("dash.")
                        else "third-party",
                    },
                )
            )
        except (AttributeError, RuntimeError, TypeError, ValueError):
            continue

    aliases: dict[int, set[str]] = {module_id: set() for module_id, _ in libraries}
    project_root = _PROJECT_ROOT or Path.cwd().resolve()
    for owner_module in tuple(sys.modules.values()):
        source_file = getattr(owner_module, "__file__", None)
        if not source_file:
            continue
        try:
            if not _is_project_source(Path(source_file).resolve(), project_root):
                continue
            namespace = tuple(vars(owner_module).items())
        except (OSError, RuntimeError, TypeError, ValueError):
            continue

        for alias, value in namespace:
            module_aliases = aliases.get(id(value))
            if (
                module_aliases is not None
                and alias.isidentifier()
                and not alias.startswith("_")
            ):
                module_aliases.add(alias)

    records = []
    for module_id, library in libraries:
        library["aliases"] = sorted(aliases[module_id], key=str.casefold)
        records.append(library)

    return sorted(
        records,
        key=lambda item: (item["scope"] != "core", item["name"].casefold()),
    )


def _serve_component_library_metadata():
    app = get_app()
    return _debug_only_response(app, _component_library_metadata)


def _serve_hook_library_metadata():
    app = get_app()
    return _debug_only_response(app, lambda: build_hook_inventory(app))


@lru_cache(maxsize=1)
def _module_distribution_map() -> dict[str, tuple[str, ...]]:
    """Return a stable top-level-module to distribution mapping."""

    return {
        module: tuple(sorted(distributions, key=str.casefold))
        for module, distributions in packages_distributions().items()
    }


def _module_source(module: Any) -> Path | None:
    source = getattr(module, "__file__", None)
    if not source:
        return None
    try:
        return Path(source).absolute()
    except (OSError, RuntimeError, TypeError, ValueError):
        return None


def _is_standard_library(
    module_name: str,
    module: Any,
    distributions: tuple[str, ...],
) -> bool:
    """Classify stdlib imports on every supported Python version."""

    standard_names = getattr(sys, "stdlib_module_names", ())
    if module_name in standard_names or module_name in sys.builtin_module_names:
        return True

    spec = getattr(module, "__spec__", None)
    if getattr(spec, "origin", None) in {"built-in", "frozen"}:
        return True
    if distributions:
        return False

    source = _module_source(module)
    if source is None:
        return False
    try:
        standard_root = Path(sysconfig.get_path("stdlib")).resolve()
        if not _is_relative_to(source, standard_root):
            return False
    except (OSError, RuntimeError, TypeError, ValueError):
        return False
    return "site-packages" not in source.parts and "dist-packages" not in source.parts


@lru_cache(maxsize=None)
def _distribution_version(distribution_name: str) -> str | None:
    try:
        return str(metadata.version(distribution_name))
    except (metadata.PackageNotFoundError, ValueError):
        return None


def _relative_import_base(module: Any, imported: ast.ImportFrom) -> str:
    """Resolve the absolute base of one ``from`` import without importing it."""

    if not imported.level:
        return imported.module or ""

    package = getattr(module, "__package__", None)
    if not package:
        return ""
    package_parts = package.split(".")
    keep = len(package_parts) - imported.level + 1
    if keep < 0:
        return ""
    base_parts = package_parts[:keep]
    if imported.module:
        base_parts.extend(imported.module.split("."))
    return ".".join(base_parts)


def _source_imports(module: Any) -> set[str]:
    """Return modules explicitly imported by one loaded Python source file."""

    source = _module_source(module)
    if source is None or source.suffix.casefold() != ".py":
        return set()
    try:
        tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    except (OSError, SyntaxError, UnicodeError):
        return set()

    imported_modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in sys.modules:
                    imported_modules.add(alias.name)
                    continue
                root_name = alias.name.partition(".")[0]
                if root_name in sys.modules:
                    imported_modules.add(root_name)
        elif isinstance(node, ast.ImportFrom):
            base = _relative_import_base(module, node)
            if not base:
                continue
            if base in sys.modules:
                imported_modules.add(base)
            for alias in node.names:
                if alias.name == "*":
                    continue
                candidate = f"{base}.{alias.name}"
                if candidate in sys.modules:
                    imported_modules.add(candidate)

    return imported_modules


def _application_direct_imports(app: Any) -> tuple[set[str], set[str]]:
    """Find imports made directly by the running application's source tree."""

    seed_names: set[str] = set()
    server_name = getattr(getattr(app, "server", None), "import_name", None)
    if server_name:
        seed_names.add(server_name)

    layout_module = getattr(getattr(app, "layout", None), "__module__", None)
    if layout_module:
        seed_names.add(layout_module)
    for callback in getattr(app, "callback_map", {}).values():
        callback_module = getattr(callback.get("callback"), "__module__", None)
        if callback_module:
            seed_names.add(callback_module)

    seed_modules = [sys.modules[name] for name in seed_names if name in sys.modules]
    seed_sources = [
        source for module in seed_modules if (source := _module_source(module))
    ]
    if _PROJECT_ROOT is not None:
        project_root = _PROJECT_ROOT
    elif seed_sources:
        project_root = _source_root(seed_sources[0]) or Path.cwd().resolve()
    else:
        project_root = Path.cwd().resolve()

    plugin_root = Path(__file__).resolve().parent
    queue: list[Any] = []
    seen_sources: set[Path] = set()
    local_roots: set[str] = set()
    direct_imports: set[str] = set()

    for module in seed_modules:
        source = _module_source(module)
        if source is None or not _is_project_source(source, project_root):
            continue
        queue.append(module)
        module_name = getattr(module, "__name__", "")
        if module_name:
            local_roots.add(module_name.partition(".")[0])

    while queue:
        module = queue.pop()
        source = _module_source(module)
        if source is None or source in seen_sources:
            continue
        seen_sources.add(source)

        for imported_name in _source_imports(module):
            direct_imports.add(imported_name)
            imported_module = sys.modules.get(imported_name)
            imported_source = _module_source(imported_module)
            if imported_source is None or not _is_project_source(
                imported_source, project_root
            ):
                continue
            local_roots.add(imported_name.partition(".")[0])
            if not _is_relative_to(imported_source, plugin_root):
                queue.append(imported_module)

    return direct_imports, local_roots


def _matches_direct_import(module_name: str, direct_imports: set[str]) -> bool:
    return any(
        module_name == imported
        or module_name.startswith(f"{imported}.")
        or imported.startswith(f"{module_name}.")
        for imported in direct_imports
    )


def _loaded_dependency_metadata(app: Any) -> dict[str, Any]:
    """Build an inventory of libraries directly imported by application code."""

    component_libraries = _component_library_metadata()
    hook_inventory = build_hook_inventory(app)
    distribution_map = _module_distribution_map()
    direct_imports, local_roots = _application_direct_imports(app)
    direct_roots = {name.partition(".")[0] for name in direct_imports}
    module_counts: Counter[str] = Counter()
    root_modules: dict[str, Any] = {}

    for loaded_name, loaded_module in tuple(sys.modules.items()):
        if loaded_module is None or not loaded_name:
            continue
        root_name = loaded_name.partition(".")[0]
        if (
            not root_name.isidentifier()
            or root_name.startswith("_")
            or root_name in {"builtins", "__main__"}
        ):
            continue
        module_counts[root_name] += 1
        root_modules.setdefault(root_name, sys.modules.get(root_name) or loaded_module)

    records: list[dict[str, Any]] = []
    claimed_roots: set[str] = set()

    if "dash" in direct_imports:
        dash_module = root_modules.get("dash")
        dash_version = getattr(dash_module, "__version__", None)
        records.append(
            {
                "id": "component:dash",
                "name": "dash",
                "version": (
                    str(dash_version)
                    if dash_version is not None
                    else _distribution_version("dash")
                ),
                "category": "dash-component",
                "modules": ["dash"],
                "moduleCount": module_counts.get("dash", 0),
                "component": None,
                "hook": None,
            }
        )
        claimed_roots.add("dash")

    for component in component_libraries:
        root_name = component["module"].partition(".")[0]
        is_direct_component = component["module"] in direct_imports or (
            not component["module"].startswith("dash.") and root_name in direct_roots
        )
        if not is_direct_component:
            continue
        claimed_roots.add(root_name)
        records.append(
            {
                "id": f"component:{component['module']}",
                "name": component["name"],
                "version": component["version"],
                "category": "dash-component",
                "modules": [component["module"]],
                "moduleCount": module_counts.get(root_name, 0),
                "component": component,
                "hook": None,
            }
        )

    for hook_library in hook_inventory["libraries"]:
        # An installed entry point that was never loaded is not a dependency of
        # the running app. The legacy endpoint still exposes those discoveries.
        if hook_library["status"] == "discovered":
            continue
        hook_roots = {
            module.partition(".")[0] for module in hook_library["modules"] if module
        }
        if not any(
            _matches_direct_import(module, direct_imports)
            for module in hook_library["modules"]
        ):
            continue
        claimed_roots.update(hook_roots)
        records.append(
            {
                "id": f"hook:{hook_library['id']}",
                "name": hook_library["name"],
                "version": hook_library["version"],
                "category": "dash-hook",
                "modules": hook_library["modules"],
                "moduleCount": sum(module_counts.get(name, 0) for name in hook_roots),
                "component": None,
                "hook": hook_library,
            }
        )

    other_distributions: dict[str, dict[str, Any]] = {}
    standard_records: list[dict[str, Any]] = []
    for root_name in sorted(direct_roots, key=str.casefold):
        module = root_modules.get(root_name)
        if module is None or root_name in claimed_roots or root_name in local_roots:
            continue
        distributions = distribution_map.get(root_name, ())
        if _is_standard_library(root_name, module, distributions):
            standard_records.append(
                {
                    "id": f"standard:{root_name}",
                    "name": root_name,
                    "version": None,
                    "category": "standard",
                    "modules": [root_name],
                    "moduleCount": module_counts[root_name],
                    "component": None,
                    "hook": None,
                }
            )
            continue

        distribution_name = distributions[0] if distributions else root_name
        distribution_id = re.sub(r"[-_.]+", "-", distribution_name).casefold()
        record = other_distributions.setdefault(
            distribution_id,
            {
                "id": f"other:{distribution_id}",
                "name": distribution_name,
                "version": _distribution_version(distribution_name),
                "category": "other",
                "modules": [],
                "moduleCount": 0,
                "component": None,
                "hook": None,
            },
        )
        if root_name not in record["modules"]:
            record["modules"].append(root_name)
        record["moduleCount"] += module_counts[root_name]

    records.extend(standard_records)
    records.extend(other_distributions.values())
    category_order = {
        "standard": 0,
        "dash-component": 1,
        "dash-hook": 2,
        "other": 3,
    }
    for record in records:
        record["modules"] = sorted(record["modules"], key=str.casefold)
    records.sort(
        key=lambda item: (
            category_order[item["category"]],
            item["name"].casefold(),
            item["id"],
        )
    )
    category_counts = Counter(record["category"] for record in records)

    return {
        "schemaVersion": 1,
        "libraries": records,
        "summary": {
            "total": len(records),
            "standard": category_counts["standard"],
            "dashComponents": category_counts["dash-component"],
            "dashHooks": category_counts["dash-hook"],
            "other": category_counts["other"],
        },
        "hookMeta": {
            "dashVersion": hook_inventory["dashVersion"],
            "completeness": hook_inventory["completeness"],
            "summary": hook_inventory["summary"],
            "orderWarnings": hook_inventory["orderWarnings"],
            "unassigned": hook_inventory["unassigned"],
        },
    }


def _serve_dependency_metadata():
    app = get_app()
    return _debug_only_response(app, lambda: _loaded_dependency_metadata(app))


def _serve_server_metrics():
    app = get_app()
    return _debug_only_response(app, collect_server_metrics)


def register() -> None:
    """Register assets and the toolbar component exactly once."""

    global _REGISTERED
    with _LOCK:
        if _REGISTERED:
            return

        hooks.script(
            [
                {
                    "dev_package_path": "assets/dash_devtools_plus.js",
                    "namespace": "dash_devtools_plus",
                    "dev_only": True,
                }
            ]
        )
        hooks.stylesheet(
            [
                {
                    "dev_package_path": "assets/dash_devtools_plus.css",
                    "namespace": "dash_devtools_plus",
                    "dev_only": True,
                }
            ]
        )

        hooks.route(name=_CALLBACKS_ROUTE)(_serve_callback_metadata)
        hooks.route(name=_DEPENDENCIES_ROUTE)(_serve_dependency_metadata)
        hooks.route(name=_COMPONENT_LIBRARIES_ROUTE)(_serve_component_library_metadata)
        hooks.route(name=_HOOK_LIBRARIES_ROUTE)(_serve_hook_library_metadata)
        hooks.route(name=_SERVER_METRICS_ROUTE)(_serve_server_metrics)
        hooks.setup(priority=sys.maxsize)(_setup_app)

        hooks.devtool(
            namespace="DashDevtoolsPlus",
            component_type="DevtoolsPlus",
            props=_component_props,
            position="left",
        )

        _REGISTERED = True
