# 🔗 Callback relationships

Follow every callback edge without losing the thread: this workspace turns Dash's registered callback list into a searchable development view. ✨

![Callback relationships](../../../imgs/docs/callbacks.webp)

## 🔎 Browse and filter

Search callback names, docstrings, source files, inputs, outputs, and state. Combine this with server/client and visibility filters to narrow a large application graph.

Callback type and source location stay pinned to the left while the remaining columns scroll. Every header remains on one line, cells are vertically centered, and subtle column rules make dense rows easier to scan. The Docstring cell keeps its title and a single-line preview; hover it for the complete content.

Use **Show performance metrics** to display or hide Last execution, Executions, Average, and Latest together. The preference is persisted in the current browser. Each metric has its own flat, sortable column—there is no grouped header.

## 📖 Read a callback row

| Column | Meaning |
| --- | --- |
| Callback type | Server-side or clientside registration. |
| Source location | Project-relative Python source and an editor action when a supported local editor is available. |
| Last execution | Local absolute time plus a live relative time, with execution-time sorting. |
| Last execution / Executions / Average / Latest | Callback execution metrics for the current page lifecycle; shown or hidden together from the toolbar. |
| Output / Input / State roles | The registered dependency roles, including multiple values. |
| Docstring | The Python function documentation when it is available. |
| Details | Topology, source kind, role summary, registration metadata, and runtime behavior. |

The details view also surfaces supported Dash metadata such as initial-call behavior, optional dependencies, background execution, dynamic registration, persistence, WebSocket use, no-output callbacks, MCP exposure, and `running` mappings.

Last execution, execution count, average duration, and latest duration are separate sortable columns. Each sorter starts in descending order so recently triggered, high-frequency, and slow callbacks can be brought to the top immediately; the active ordering remains applied as live measurements arrive. Last execution combines the browser's local absolute time with a live relative label: seconds for the first minute, minutes plus seconds until ten minutes, and “More than 10 min ago” thereafter.

## ⚡ Callback performance

The performance workspace sits at the bottom of callback details as a compact, integrated instrumentation console. Latest duration is the primary reading, execution statistics share one continuous metric panel, and the smooth stacked area chart and transfer summary share a low-padding analysis panel. Empty states stay compact instead of reserving a large blank region. It covers the current browser page lifecycle and includes:

- execution count, average duration, latest duration, minimum, and maximum;
- a stacked server/network duration trend for the latest 30 executions and the latest 20 detailed records;
- total, server, and network duration per recorded execution;
- cumulative request and response payload sizes; and
- completion status, including successful, no-update, no-response, and clientside-error outcomes.

Dash DevTools Plus derives these values from Dash Renderer’s built-in callback profile. It observes the renderer store and calculates each execution by differencing Dash’s cumulative counters; it does not wrap or re-run application callbacks and adds no server-side callback state. While callback details are open, a 500 ms fallback refresh also reads the latest profile so polling callbacks continue updating the metrics, chart, and history without user interaction. Up to 200 detailed records are retained per callback, while lifecycle aggregates continue to cover every observed measured execution.

The history is intentionally session-local: a full page reload clears it. Payload sizes represent the request body and the response `Content-Length` exposed by Dash; missing response lengths are reported as zero by the renderer. Clientside callbacks have timing data but no network transfer, while executions for which Dash reports no response remain in history without fabricated duration values. WebSocket callback profiling depends on the metrics exposed by the active Dash Renderer version.

## 🛡️ Scope and safety

Only callback source files under `project_root` are treated as project sources. Set `project_root` and `editor_project_root` when server paths and local editor paths differ.
