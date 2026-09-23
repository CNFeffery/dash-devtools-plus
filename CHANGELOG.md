# Changelog

All notable changes to this project are documented in this file.

## [0.1.4] - Unreleased

### Added

- Added current-page callback performance monitoring with bounded execution history, average/latest/minimum/maximum duration, server/network timing, transfer sizes, and completion status, derived from Dash Renderer’s built-in profile data.
- Made execution count, average duration, and latest duration independently sortable, with descending-first ordering for faster bottleneck discovery.
- Added a sortable last-execution column with local absolute timestamps and live, threshold-based relative time labels.

### Changed

- Moved callback performance to the bottom of the details modal and rebuilt it as a compact instrumentation console with an integrated summary rail, low-padding analysis panel, restrained transfer breakdown, and condensed history states.
- Reworked the duration trend into a compact, smooth stacked server/network area chart and added a 500 ms detail-view refresh fallback so polling callbacks remain live without manual interaction.
- Fixed the narrow-screen tab overflow menu so it renders above the Devtools drawer on hover, and allowed the runtime dependency list to expand naturally without a nested scrollbar.
- Refined the callback table with single-line headers, vertically centered cells, stronger column separation, pinned callback-type/source columns, a compact horizontal scrollbar, and one-line Docstring previews.
- Flattened the performance columns and added a browser-persisted control for showing or hiding all callback performance metrics.

## [0.1.3] - 2026-09-18

### Added

- Added a final Runtime Environment workspace with concise Dash, Python, server, browser, and installed dependency details, plus one-click copying of an issue-ready Markdown report.

### Changed

- Tightened dependency ownership checks so project-local components and manually registered Hooks are not classified as third-party libraries.

### Fixed

- Kept component-valued props isolated from unrelated React Fiber ancestors and siblings in the Component Inspector, preventing oversized prop results and UI stalls in large component trees.

## [0.1.2] - 2026-09-17

### Added

- Added support for Dash applications using the FastAPI backend, with an example powered by persistent WebSocket callbacks.

### Fixed

- Fixed vertical scrolling in the Component Inspector panel.
- Prevented Component Inspector probing from triggering interactions in the inspected application.
- Corrected callback source locations in FastAPI applications after source changes during development.
