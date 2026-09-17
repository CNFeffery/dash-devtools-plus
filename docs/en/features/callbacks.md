# 🔗 Callback relationships

Follow every callback edge without losing the thread: this workspace turns Dash's registered callback list into a searchable development view. ✨

![Callback relationships](../../../imgs/docs/callbacks.webp)

## 🔎 Browse and filter

Search callback names, docstrings, source files, inputs, outputs, and state. Combine this with server/client and visibility filters to narrow a large application graph.

## 📖 Read a callback row

| Column | Meaning |
| --- | --- |
| Callback type | Server-side or clientside registration. |
| Source location | Project-relative Python source and an editor action when a supported local editor is available. |
| Output / Input / State roles | The registered dependency roles, including multiple values. |
| Docstring | The Python function documentation when it is available. |
| Details | Topology, source kind, role summary, registration metadata, and runtime behavior. |

The details view also surfaces supported Dash metadata such as initial-call behavior, optional dependencies, background execution, dynamic registration, persistence, WebSocket use, no-output callbacks, MCP exposure, and `running` mappings.

## 🛡️ Scope and safety

Only callback source files under `project_root` are treated as project sources. Set `project_root` and `editor_project_root` when server paths and local editor paths differ.
