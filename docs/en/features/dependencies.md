# 🧩 Imported dependencies

> ✨ See the libraries your project actually imports, without being distracted by the entire environment.

The dependency workspace summarizes libraries directly imported by the project source tree, rather than every package installed in the Python environment.

![Imported dependencies](../../../imgs/docs/dependencies.webp)

## 🗂️ Categories

| Category | Detection result |
| --- | --- |
| Standard library | Direct imports resolved to Python's standard library. |
| Dash components | `dash` itself and detected Dash component libraries. |
| Dash Hooks | Hook packages discovered through entry points or runtime registration. |
| Other libraries | Direct imports that do not fit the categories above. |

Use the clickable category cards, category selector, and search to narrow the table. Search covers library names, versions, imported modules, component aliases, Hook entry points, and Hook types. The table shows the library, category, installed version when available, imported module names, and the runtime module count.

## 🔽 Expanded details

Rows for Dash component and Hook libraries can expand:

- Component rows show package module, scope, exports, browser assets, and project aliases.
- Hook rows show entry points, source, status, hook types, and runtime registration details.

When an ordered Hook type has multiple registrations, the workspace calls out the affected types and shows their current effective order. Without explicit priorities, that order should not be assumed to stay identical across environments.

The inventory applies the configured `project_root` boundary and excludes common virtual-environment locations. Project-local modules—including Hooks registered manually from application source—are not presented as “Other” or external dependencies; a third-party import must map to an installed Python distribution to enter the inventory. It is an import-based development inventory, not a lock-file or vulnerability audit.
