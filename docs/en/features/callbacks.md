# 🔗 Callback relationships

Follow every callback edge without losing the thread: this workspace turns Dash's registered callback list into a searchable development view. ✨

![Callback relationships](../../../imgs/docs/callbacks.webp)

## 🔎 Browse and filter

Search callback names, docstrings, source files, inputs, outputs, and state. Combine this with server/client and visibility filters to narrow a large application graph.

Callback type and source location stay pinned to the left while the remaining columns scroll. Every header remains on one line, cells are vertically centered, and subtle column rules make dense rows easier to scan. The Docstring cell keeps its title and a single-line preview; hover it for the complete content.

Use **Show performance metrics** to display or hide Last execution, Executions, Average, Latest, Minimum and Maximum together. The preference is persisted in the current browser. Each metric has its own flat, sortable column. Extrema tooltips explain that only captured individual timings are included.

## 📖 Read a callback row

| Column | Meaning |
| --- | --- |
| Callback type | Server-side or clientside registration. |
| Source location | Project-relative Python source and an editor action when a supported local editor is available. |
| Last execution / Executions / Average / Latest / Minimum / Maximum | Callback execution metrics for the owning Renderer on the current page; shown or hidden together from the toolbar. |
| Output / Input / State roles | The registered dependency roles, including multiple values. |
| Docstring | The Python function documentation when it is available. |
| Details | Topology, source kind, role summary, registration metadata, and runtime behavior. |

The details view also surfaces supported Dash metadata such as initial-call behavior, optional dependencies, background execution, dynamic registration, persistence, WebSocket use, no-output callbacks, MCP exposure, and `running` mappings.

All six metrics are separate sortable columns. Each sorter starts in descending order so recently triggered, high-frequency, and slow callbacks can be brought to the top immediately; the active ordering remains applied as live measurements arrive. Last execution combines the browser's local absolute time with a live relative label: seconds for the first minute, minutes plus seconds until ten minutes, and “More than 10 min ago” thereafter. Unrecoverable completion times display “Time unavailable”.

## ⚡ Callback performance

![Live callback performance details in v0.1.4](../../../imgs/docs/callback-performance.webp)

The performance workspace sits at the bottom of callback details. A prominent latest-duration reading includes completion status and its percentage difference from the session average. A stacked duration chart places server and network time in context, followed by a four-metric strip with explicit sample counts. Click a chart legend to show or hide its series; the selection stays in place as new executions arrive. Transfer totals stay compact, custom timing stages expand on demand, and the information button explains measurement scope. On narrow screens, the overview stacks vertically and execution records scroll within their own table. It covers the current browser page lifecycle and includes:

- execution count, average duration, latest duration, minimum, and maximum;
- a stacked duration chart for the latest 30 measured executions and five recent records, expandable to 20;
- total, server, and network duration per recorded execution;
- cumulative request and response payload sizes; and
- completion status, including successful, no-update, no-response, and clientside-error outcomes.

Dash DevTools Plus differences the Renderer’s cumulative profile counters. It also observes final callback execution results to supplement HTTP 4xx/5xx failures missing from the profile, recording counts and HTTP status without inventing timings or transfer sizes. Intermediate authentication retries are not additional executions. Native clientside-error and no-response records are not counted twice. No application callback or fetch function is wrapped, and no server-side profiling state is added.

Each Renderer has an independent session, selected through the panel's Dash context. Profile resets clear the old baseline and history. A 500 ms fallback scan runs while details are open. Collection is synchronous; React notifications are throttled to 100 ms, pending chart updates are coalesced, and hidden performance tables do not subscribe to frequent updates.

The main table includes six independently sortable metrics: last execution, count, average, latest, minimum and maximum. Average covers cumulative timed executions; extrema cover only captured individual samples, whose count is shown in details. Each callback retains 200 detailed records, with the latest 30 measured samples plotted and five records displayed by default, expandable to 20. The omitted count includes cached rows outside that visible window. Pre-attachment executions never receive invented timestamps; recovered individual timings with unknown completion times show `—`. Custom `ctx.record_timing` stages appear as cumulative totals and individual history values.

HTTP timing is labeled Server and Network & other, because the remainder also includes browser processing and waiting. Unknown splits show total time only. Clientside callbacks show client time. Background totals include queueing and polling waits; WebSocket and background callbacks show only total time and no unreliable server/network breakdown or transfer sizes.

Request sizes use Dash's string-length estimate, not exact UTF-8 bytes; response sizes use `Content-Length`. Totals cover only data reported by the Renderer and exclude supplemented HTTP failures. Ambiguous zero/missing HTTP sizes appear as `—`; clientside Dash callback transfer is zero. History is page-local and disappears on a full reload. Profiling depends on Renderer internals and cannot recover pre-attachment failures already removed from execution queues and absent from the profile.

## 🛡️ Scope and safety

Only callback source files under `project_root` are treated as project sources. Set `project_root` and `editor_project_root` when server paths and local editor paths differ.
