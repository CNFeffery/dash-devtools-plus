"""Read-only introspection for Dash hook plugins.

Entry-point discovery uses Python's public metadata API. Runtime contribution
details are deliberately isolated here because Dash currently exposes those
through private registries whose shape may change between releases.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from functools import lru_cache
from importlib import metadata
from pathlib import Path
from threading import Lock
from typing import Any
from weakref import WeakKeyDictionary

import dash
from dash import hooks


_SNAPSHOT_LOCK = Lock()
_APP_SNAPSHOTS: WeakKeyDictionary[Any, frozenset[int]] = WeakKeyDictionary()
_NORMALIZE_NAME = re.compile(r"[-_.]+")
_ORDERED_TYPES = (
    "setup",
    "layout",
    "routes",
    "error",
    "callback",
    "index",
    "custom_data",
    "websocket_connect",
    "websocket_message",
)


def _normalise_distribution(name: str) -> str:
    return _NORMALIZE_NAME.sub("-", name).casefold()


def _module_from_value(value: str) -> str:
    return value.partition(":")[0].strip()


def _callable_owner(value: Any) -> tuple[str | None, str | None]:
    if not callable(value):
        return None, None
    module = getattr(value, "__module__", None)
    name = getattr(value, "__qualname__", None) or getattr(value, "__name__", None)
    return module, name


def _runtime_contributions() -> tuple[list[dict[str, Any]], str]:
    """Return a stable JSON-friendly view over the current Dash registry."""

    namespace = getattr(hooks, "_ns", None)
    if not isinstance(namespace, dict):
        return [], "unavailable"

    finals = getattr(hooks, "_finals", {})
    final_ids = (
        {id(item) for item in finals.values()} if isinstance(finals, dict) else set()
    )
    contributions: list[dict[str, Any]] = []

    for hook_type in _ORDERED_TYPES:
        items = list(namespace.get(hook_type, ()))
        final = finals.get(hook_type) if isinstance(finals, dict) else None
        if final is not None and all(id(item) != id(final) for item in items):
            items.append(final)
        for position, item in enumerate(items, start=1):
            owner_module, callable_name = _callable_owner(getattr(item, "func", None))
            contributions.append(
                {
                    "runtimeId": id(item),
                    "type": hook_type,
                    "position": position,
                    "priority": getattr(item, "priority", None),
                    "final": id(item) in final_ids,
                    "module": owner_module,
                    "callable": callable_name,
                    "ordered": True,
                }
            )

    for position, item in enumerate(namespace.get("dev_tools", ()), start=1):
        props = item.get("props") if isinstance(item, dict) else None
        owner_module, callable_name = _callable_owner(props)
        contributions.append(
            {
                "runtimeId": id(item),
                "type": "devtool",
                "position": position,
                "priority": None,
                "final": False,
                "module": owner_module,
                "callable": callable_name,
                "namespace": item.get("namespace") if isinstance(item, dict) else None,
                "ordered": False,
            }
        )

    for hook_type, attribute in (
        ("script", "_js_dist"),
        ("stylesheet", "_css_dist"),
    ):
        for position, item in enumerate(getattr(hooks, attribute, ()), start=1):
            contributions.append(
                {
                    "runtimeId": id(item),
                    "type": hook_type,
                    "position": position,
                    "priority": None,
                    "final": False,
                    "module": None,
                    "callable": None,
                    "namespace": item.get("namespace")
                    if isinstance(item, dict)
                    else None,
                    "ordered": False,
                }
            )

    for position, item in enumerate(
        getattr(hooks, "_clientside_callbacks", ()), start=1
    ):
        function = item[0] if isinstance(item, tuple) and item else None
        owner_module, callable_name = _callable_owner(function)
        contributions.append(
            {
                "runtimeId": id(item),
                "type": "clientside_callback",
                "position": position,
                "priority": None,
                "final": False,
                "module": owner_module,
                "callable": callable_name,
                "ordered": False,
            }
        )

    return contributions, "complete"


def capture_app_hook_snapshot(app: Any) -> None:
    """Capture the registry visible when Dash runs this plugin's setup hook."""

    contributions, _ = _runtime_contributions()
    snapshot = frozenset(item["runtimeId"] for item in contributions)
    try:
        with _SNAPSHOT_LOCK:
            _APP_SNAPSHOTS[app] = snapshot
    except TypeError:
        # A future Dash implementation could make app objects non-weakrefable.
        return


def _snapshot_for(app: Any) -> frozenset[int] | None:
    try:
        with _SNAPSHOT_LOCK:
            return _APP_SNAPSHOTS.get(app)
    except TypeError:
        return None


@lru_cache(maxsize=1)
def _hook_entry_point_specs(
    _provider_identity: int,
) -> tuple[tuple[str, str, str, str, str, str], ...]:
    """Cache installed Dash Hook entry points for the process lifetime."""

    specs: list[tuple[str, str, str, str, str, str]] = []
    seen_entries: set[tuple[str, str, str, str]] = set()

    for distribution in metadata.distributions():
        distribution_name = distribution.metadata.get("Name") or "unknown"
        version = distribution.version
        library_id = _normalise_distribution(distribution_name)
        for entry_point in distribution.entry_points:
            if entry_point.group != "dash_hooks":
                continue
            module = getattr(entry_point, "module", None) or _module_from_value(
                entry_point.value
            )
            dedupe_key = (
                library_id,
                str(version),
                entry_point.name,
                entry_point.value,
            )
            if dedupe_key in seen_entries:
                continue
            seen_entries.add(dedupe_key)
            specs.append(
                (
                    library_id,
                    distribution_name,
                    str(version),
                    entry_point.name,
                    entry_point.value,
                    module,
                )
            )

    return tuple(specs)


def _entry_point_libraries() -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    libraries: dict[str, dict[str, Any]] = {}
    module_owners: dict[str, str] = {}

    for (
        library_id,
        distribution_name,
        version,
        entry_point_name,
        entry_point_value,
        module,
    ) in _hook_entry_point_specs(id(metadata.distributions)):
        loaded_module = sys.modules.get(module) or sys.modules.get(
            module.partition(".")[0]
        )
        runtime_version = getattr(loaded_module, "__version__", None)
        resolved_version = runtime_version or version

        library = libraries.setdefault(
            library_id,
            {
                "id": library_id,
                "name": distribution_name,
                "version": str(resolved_version),
                "source": "entry-point",
                "entryPoints": [],
                "modules": [],
                "loaded": False,
                "contributions": [],
            },
        )
        library["entryPoints"].append(
            {
                "name": entry_point_name,
                "value": entry_point_value,
                "module": module,
            }
        )
        if module not in library["modules"]:
            library["modules"].append(module)
        library["loaded"] = library["loaded"] or module in sys.modules
        module_owners[module] = library_id

    return libraries, module_owners


def _owner_for_contribution(
    contribution: dict[str, Any], module_owners: dict[str, str]
) -> tuple[str | None, str]:
    owner_module = contribution.get("module")
    if owner_module:
        candidates = sorted(module_owners, key=len, reverse=True)
        for module in candidates:
            if owner_module == module or owner_module.startswith(f"{module}."):
                return module_owners[module], "module"

    namespace = contribution.get("namespace")
    if namespace:
        normalised_namespace = namespace.replace("-", "_").casefold()
        for module, owner in module_owners.items():
            module_key = module.replace(".", "_").casefold()
            if normalised_namespace == module_key or normalised_namespace.startswith(
                f"{module_key}_"
            ):
                return owner, "namespace"
    return None, "unknown"


def _manual_library(module: str) -> dict[str, Any]:
    top_level = module.partition(".")[0]
    loaded_module = sys.modules.get(module)
    source_file = getattr(loaded_module, "__file__", None)
    is_project_module = False
    if source_file:
        try:
            Path(source_file).resolve().relative_to(Path.cwd().resolve())
            is_project_module = True
        except (OSError, ValueError):
            pass

    if is_project_module:
        distribution_name = module
        version = None
    else:
        distribution_names = metadata.packages_distributions().get(top_level, ())
        distribution_name = distribution_names[0] if distribution_names else top_level
        try:
            version = metadata.version(distribution_name)
        except metadata.PackageNotFoundError:
            version = None
    library_id = f"manual:{_normalise_distribution(distribution_name)}"
    return {
        "id": library_id,
        "name": distribution_name,
        "version": str(version) if version is not None else None,
        "source": "manual",
        "entryPoints": [],
        "modules": [module],
        "loaded": module in sys.modules,
        "contributions": [],
    }


def build_hook_inventory(app: Any) -> dict[str, Any]:
    """Build the hook library inventory for the current process and app."""

    libraries, module_owners = _entry_point_libraries()
    contributions, runtime_state = _runtime_contributions()
    snapshot = _snapshot_for(app)
    unassigned: list[dict[str, Any]] = []

    for contribution in contributions:
        contribution["phase"] = (
            "snapshot"
            if snapshot is None or contribution["runtimeId"] in snapshot
            else "late"
        )
        owner, confidence = _owner_for_contribution(contribution, module_owners)
        contribution["attribution"] = confidence
        if owner is None and contribution.get("module"):
            manual = _manual_library(contribution["module"])
            owner = manual["id"]
            libraries.setdefault(owner, manual)
        if owner is None:
            unassigned.append(contribution)
            continue
        libraries[owner]["contributions"].append(contribution)

    records = []
    all_type_counts: Counter[str] = Counter()
    late_count = 0
    for library in libraries.values():
        library_contributions = library.pop("contributions")
        type_counts = Counter(item["type"] for item in library_contributions)
        snapshot_count = sum(
            item["phase"] == "snapshot" for item in library_contributions
        )
        library_late_count = len(library_contributions) - snapshot_count
        late_count += library_late_count
        all_type_counts.update(type_counts)
        library.update(
            {
                "status": (
                    "registered"
                    if snapshot_count
                    else "late"
                    if library_late_count
                    else "loaded"
                    if library["loaded"]
                    else "discovered"
                ),
                "registrationCount": len(library_contributions),
                "snapshotCount": snapshot_count,
                "lateCount": library_late_count,
                "hookTypes": [
                    {"type": hook_type, "count": count}
                    for hook_type, count in sorted(type_counts.items())
                ],
                "contributions": library_contributions,
            }
        )
        records.append(library)

    unassigned_types = Counter(item["type"] for item in unassigned)
    all_type_counts.update(unassigned_types)
    records.sort(
        key=lambda item: (
            item["status"] not in {"registered", "late"},
            item["source"] != "entry-point",
            item["name"].casefold(),
        )
    )
    order_warnings = [
        hook_type
        for hook_type, count in sorted(all_type_counts.items())
        if count > 1 and hook_type not in {"script", "stylesheet", "devtool"}
    ]

    return {
        "schemaVersion": 1,
        "dashVersion": dash.__version__,
        "processScoped": True,
        "completeness": {
            "entryPoints": "complete",
            "runtimeRegistry": runtime_state,
            "appSnapshot": "complete" if snapshot is not None else "unavailable",
        },
        "summary": {
            "libraries": len(records),
            "registrations": len(contributions),
            "hookTypes": len(all_type_counts),
            "unassigned": len(unassigned),
            "late": late_count,
        },
        "orderWarnings": order_warnings,
        "libraries": records,
        "unassigned": unassigned,
    }
