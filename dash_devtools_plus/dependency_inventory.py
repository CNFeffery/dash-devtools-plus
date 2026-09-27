"""Application-scoped import discovery and installed package attribution.

Discovery never imports application modules or evaluates layouts. Each request
uses a fresh module/metadata snapshot so a refresh observes newly loaded code.
"""

from __future__ import annotations

import ast
import csv
import inspect
import json
import os
import sys
import sysconfig
import tokenize
from dataclasses import dataclass, field
from importlib import metadata
from importlib.util import resolve_name
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import urlsplit
from urllib.request import url2pathname

PROJECT_MARKERS = ("pyproject.toml", "setup.py", "setup.cfg", ".git")
ENVIRONMENT_PARTS = {"site-packages", "dist-packages", ".venv", "venv"}


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def module_source(module: Any) -> Path | None:
    source = getattr(module, "__file__", None)
    if not source or str(source).startswith("<"):
        return None
    try:
        return Path(source).resolve()
    except (OSError, RuntimeError, TypeError, ValueError):
        return None


def is_project_source(source: Path, root: Path) -> bool:
    return is_within(source, root) and not ENVIRONMENT_PARTS.intersection(
        part.casefold() for part in source.relative_to(root).parts
    )


def is_standard_library(name: str, module: Any) -> bool:
    source = module_source(module)
    origin = getattr(getattr(module, "__spec__", None), "origin", None)
    if origin in {"built-in", "frozen"}:
        return True
    if source:
        root = Path(sysconfig.get_path("stdlib")).resolve()
        return is_within(source, root) and not {
            "site-packages",
            "dist-packages",
        }.intersection(part.casefold() for part in source.parts)
    return name in sys.builtin_module_names or name in getattr(
        sys, "stdlib_module_names", ()
    )


@dataclass
class ImportScan:
    root: Path
    imports: set[str] = field(default_factory=set)
    local_modules: set[str] = field(default_factory=set)
    issues: list[dict[str, str]] = field(default_factory=list)
    scanned_files: int = 0

    def issue(self, module: str, reason: str) -> None:
        item = {"module": module, "reason": reason}
        if item not in self.issues:
            self.issues.append(item)

    def diagnostics(self) -> dict[str, Any]:
        return {
            "status": "partial" if self.issues else "complete",
            "scannedFiles": self.scanned_files,
            "issues": sorted(
                self.issues, key=lambda item: (item["module"], item["reason"])
            ),
        }


def _callable_module(value: Any) -> str | None:
    if not callable(value):
        return None
    try:
        return getattr(inspect.unwrap(value), "__module__", None)
    except ValueError:
        return getattr(value, "__module__", None)


def _seed_modules(app: Any, modules: dict[str, Any]) -> list[Any]:
    config = getattr(app, "config", {})
    names = [
        config.get("name") if hasattr(config, "get") else None,
        getattr(getattr(app, "server", None), "import_name", None),
        _callable_module(getattr(app, "layout", None)),
    ]
    names.extend(
        sorted(
            {
                name
                for callback in getattr(app, "callback_map", {}).values()
                if (name := _callable_module(callback.get("callback")))
            }
        )
    )
    plugin_root = Path(__file__).resolve().parent
    result = []
    seen = set()
    for name in names:
        module = modules.get(name)
        source = module_source(module)
        if (
            not name
            or name in seen
            or source is None
            or {"site-packages", "dist-packages"}.intersection(
                part.casefold() for part in source.parts
            )
            or is_within(source, plugin_root)
            or is_standard_library(name.partition(".")[0], module)
        ):
            continue
        seen.add(name)
        result.append(module)
    return result


def application_root(seeds: list[Any], configured_root: Path | None) -> Path:
    if configured_root is not None:
        return configured_root.resolve()
    if not seeds:
        return Path.cwd().resolve()
    # The app creation module is first, followed by the callable layout and
    # deterministically ordered callbacks. Component classes are never seeds.
    source = module_source(seeds[0])
    assert source is not None
    for parent in source.parents:
        if any((parent / marker).exists() for marker in PROJECT_MARKERS):
            return parent
    root = source.parent
    while (root / "__init__.py").is_file():
        root = root.parent
    # Unpackaged apps can keep their server and callbacks in sibling folders.
    # Only use their common ancestor when it stays inside the launch directory;
    # never expand to a drive root to accommodate an unrelated external callback.
    parents = [str(module_source(module).parent) for module in seeds]
    try:
        common = Path(os.path.commonpath(parents))
        cwd = Path.cwd().resolve()
        if common != Path(common.anchor) and is_within(common, cwd):
            root = common if is_within(root, common) else root
    except ValueError:  # Different drives cannot define one project boundary.
        pass
    return root


def source_imports(module: Any, modules: dict[str, Any], scan: ImportScan) -> set[str]:
    source = module_source(module)
    name = getattr(module, "__name__", "unknown")
    if source is None or source.suffix.casefold() != ".py":
        scan.issue(name, "source-unavailable")
        return set()
    try:
        with tokenize.open(source) as stream:
            tree = ast.parse(stream.read(), filename=str(source))
    except (OSError, SyntaxError, UnicodeError, LookupError):
        scan.issue(name, "source-unreadable")
        return set()
    scan.scanned_files += 1
    imported: set[str] = set()
    importlib_aliases = {"importlib"}
    import_module_aliases: set[str] = set()
    nodes = list(ast.walk(tree))
    for node in nodes:
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "importlib":
                    importlib_aliases.add(alias.asname or alias.name)
                candidate = alias.name
                if candidate not in modules:
                    candidate = candidate.partition(".")[0]
                if modules.get(candidate) is not None:
                    imported.add(candidate)
        elif isinstance(node, ast.ImportFrom):
            if node.module == "__future__":
                continue  # Compiler directives are not runtime dependencies.
            base = node.module or ""
            if node.level:
                try:
                    base = resolve_name("." * node.level + base, module.__package__)
                except (AttributeError, ImportError, ValueError):
                    continue
            if modules.get(base) is not None:
                imported.add(base)
            for alias in node.names:
                if base == "importlib" and alias.name == "import_module":
                    import_module_aliases.add(alias.asname or alias.name)
                candidate = f"{base}.{alias.name}"
                if modules.get(candidate) is not None:
                    imported.add(candidate)

    for node in nodes:
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        dynamic = (
            isinstance(func, ast.Name)
            and func.id in import_module_aliases | {"__import__"}
        ) or (
            isinstance(func, ast.Attribute)
            and func.attr == "import_module"
            and isinstance(func.value, ast.Name)
            and func.value.id in importlib_aliases
        )
        if not dynamic:
            continue
        argument = (
            node.args[0]
            if node.args
            else next((kw.value for kw in node.keywords if kw.arg == "name"), None)
        )
        if not isinstance(argument, ast.Constant) or not isinstance(
            argument.value, str
        ):
            scan.issue(name, "dynamic-import-unresolved")
            continue
        candidate = argument.value
        if candidate.startswith("."):
            package_arg = (
                node.args[1]
                if len(node.args) > 1
                else next(
                    (kw.value for kw in node.keywords if kw.arg == "package"), None
                )
            )
            package = (
                package_arg.value
                if isinstance(package_arg, ast.Constant)
                else getattr(module, "__package__", None)
                if isinstance(package_arg, ast.Name) and package_arg.id == "__package__"
                else None
            )
            try:
                candidate = resolve_name(candidate, package)
            except (ImportError, ValueError, TypeError):
                scan.issue(name, "dynamic-import-unresolved")
                continue
        if modules.get(candidate) is not None:
            imported.add(candidate)
    return imported


def _bound_imports(module: Any, modules: dict[str, Any]) -> set[str]:
    """Recover module bindings and imported component types without executing code."""
    from dash.development.base_component import Component

    result = set()
    for value in tuple(vars(module).values()):
        if isinstance(value, ModuleType):
            name = value.__name__
            if name.startswith(module.__name__ + "."):
                # Import machinery attaches every loaded child to its parent.
                # These bindings are not evidence that this app imports siblings.
                # Explicit imports and dynamic literal calls are handled by AST.
                continue
        elif isinstance(value, type) and issubclass(value, Component):
            name = value.__module__
        else:
            continue
        if modules.get(name) is not None:
            result.add(name)
    return result


def scan_application(app: Any, configured_root: Path | None = None) -> ImportScan:
    modules = dict(sys.modules)
    seeds = _seed_modules(app, modules)
    scan = ImportScan(application_root(seeds, configured_root))
    queue = list(seeds)
    seen: set[Path] = set()
    plugin_root = Path(__file__).resolve().parent

    # Static layouts are concrete, app-owned evidence, even without callbacks.
    from dash.development.base_component import Component

    layout = getattr(app, "layout", None)
    if isinstance(layout, Component):
        components = [layout]
        visited: set[int] = set()
        while components:
            component = components.pop()
            if id(component) in visited:
                continue
            visited.add(id(component))
            scan.imports.add(type(component).__module__)
            children = vars(component).get("children")
            if isinstance(children, Component):
                components.append(children)
            elif isinstance(children, (list, tuple)):
                components.extend(
                    child for child in children if isinstance(child, Component)
                )
    while queue:
        module = queue.pop(0)
        source = module_source(module)
        if source is None or not is_project_source(source, scan.root):
            continue
        if source in seen or is_within(source, plugin_root):
            continue
        seen.add(source)
        scan.local_modules.add(module.__name__)
        imported = source_imports(module, modules, scan) | _bound_imports(
            module, modules
        )
        scan.imports.update(imported)
        for imported_name in sorted(imported):
            # Importing pkg.child executes pkg.__init__ too. Traverse loaded
            # local parents, but never walk into third-party implementations.
            parts = imported_name.split(".")
            for size in range(1, len(parts) + 1):
                imported_module = modules.get(".".join(parts[:size]))
                imported_source = module_source(imported_module)
                if imported_source and is_project_source(imported_source, scan.root):
                    queue.append(imported_module)
    if not scan.scanned_files:
        scan.issue("application", "application-source-unavailable")
    return scan


def normalise_distribution(name: str) -> str:
    import re

    return re.sub(r"[-_.]+", "-", name).casefold()


class DistributionResolver:
    """Resolve concrete module files; do not guess among namespace owners."""

    def __init__(self) -> None:
        self.distributions = {}
        self.mapping: dict[str, set[str]] = {}
        self._paths: dict[str, list[str]] = {}
        for dist in metadata.distributions():
            if dist.metadata.get("Name"):
                # Match importlib.metadata's first-distribution precedence.
                key = normalise_distribution(dist.metadata["Name"])
                if key in self.distributions:
                    continue
                self.distributions[key] = dist
                declared = (dist.read_text("top_level.txt") or "").split()
                if not declared:
                    declared = {
                        path.replace("\\", "/").split("/")[0].split(".")[0]
                        for path in self._distribution_paths(key)
                        if path.endswith((".py", ".pyc", ".pyd", ".so"))
                    }
                for name in declared:
                    if name.isidentifier():
                        self.mapping.setdefault(name, set()).add(key)
        self._files: dict[str, set[str]] = {}
        self._resolved: dict[str, list[dict[str, Any]]] = {}

    def _distribution_paths(self, key: str) -> list[str]:
        if key not in self._paths:
            dist = self.distributions[key]
            record = dist.read_text("RECORD")
            sources = dist.read_text("SOURCES.txt") if record is None else None
            # Read recorded paths without stat-ing every installed file. Some
            # metadata providers filter dist.files via thousands of fs calls.
            if record is not None:
                paths = [row[0] for row in csv.reader(record.splitlines()) if row]
            elif sources is not None:
                paths = sources.splitlines()
            else:
                paths = [str(path) for path in (dist.files or ())]
            self._paths[key] = paths
        return self._paths[key]

    def _owns(self, key: str, source: Path) -> bool:
        dist = self.distributions[key]
        if key not in self._files:
            root = Path(dist.locate_file("")).resolve()
            self._files[key] = {
                os.path.normcase(os.path.abspath(root / file))
                for file in self._distribution_paths(key)
                if str(file).endswith((".py", ".pyc", ".pyd", ".so"))
            }
        if os.path.normcase(str(source)) in self._files[key]:
            return True
        try:
            direct = json.loads(dist.read_text("direct_url.json") or "{}")
            url = urlsplit(direct.get("url", ""))
            if direct.get("dir_info", {}).get("editable") and url.scheme == "file":
                path = url2pathname(url.path)
                if url.netloc:
                    path = f"//{url.netloc}{path}"
                return is_within(source, Path(path).resolve())
        except (OSError, ValueError, TypeError):
            pass
        return False

    def resolve(self, module_name: str) -> list[dict[str, Any]]:
        if module_name in self._resolved:
            return self._resolved[module_name]
        module = sys.modules.get(module_name)
        source = module_source(module)
        root_name = module_name.partition(".")[0]
        candidates = {
            normalise_distribution(name) for name in self.mapping.get(root_name, ())
        } & self.distributions.keys()
        owners = {key for key in candidates if source and self._owns(key, source)}
        if source and not candidates:
            # Missing top_level.txt/RECORD entries occur in editable installs.
            owners = {key for key in self.distributions if self._owns(key, source)}
        if not source:
            # A namespace root is not evidence that all its providers are used.
            owners = set()
        records = [
            {
                "name": self.distributions[key].metadata["Name"],
                "version": self.distributions[key].version or None,
            }
            for key in sorted(owners)
        ]
        self._resolved[module_name] = records
        return records


def environment_libraries(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse component subpackages to their installed Python distribution."""
    libraries = {}
    for record in records:
        if record["category"] == "standard":
            continue
        for dist in record.get("distributions", []):
            libraries[normalise_distribution(dist["name"])] = dict(dist)
    return sorted(libraries.values(), key=lambda item: item["name"].casefold())
