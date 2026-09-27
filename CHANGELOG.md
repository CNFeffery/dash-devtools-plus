# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - Unreleased

### Added

- Added direct component inspection from the State Snapshots selection tree, including components without IDs, with a source indicator and a return action that preserves snapshot selections, filters, draft names, and tree scroll position.
- Added runtime editing of non-component props from both page inspection and State Snapshots, with automatic type detection, string, number, boolean, and JSON modes, and live updates through Dash's `set_props` API.
- Added a locally bundled Monaco Editor with inline diagnostics, validation on apply, and undoable formatting for JSON and string content. JSON-like objects and arrays are normalized to standard JSON, while ordinary text retains its punctuation and only has trailing whitespace and line endings cleaned up.

### Changed

### Fixed

## [0.1.4] - 2026-09-27

### Added

- Added callback performance monitoring with live metrics, timing trends, and execution history.

### Changed

- Improved the callback relationship table for clearer information hierarchy, readability, and interaction.
- Refined callback details for a clearer, more polished viewing experience.
- Improved chart presentation, interaction, and live data updates across related feature workspaces.

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
