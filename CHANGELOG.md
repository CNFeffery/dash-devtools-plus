# Changelog

All notable changes to this project are documented in this file.

## [0.1.4] - Unreleased

### Added

- Added performance monitoring to the Callback Relationships workspace, including live execution metrics, timing trends, transfer statistics, and execution history.

### Changed

- Improved the callback relationship table for clearer information hierarchy, readability, and interaction.
- Improved visualization charts across related feature workspaces with refined AntV charts, interactive legends, and stable live data updates.

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
