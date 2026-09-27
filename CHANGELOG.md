# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - Unreleased

### Added

- Added fuzzy, exact ID, and exact prop name search for callbacks.
- Added one-click navigation from component inspection to related callbacks using exact ID search.
- Added component inspection from State Snapshots with preserved snapshot state on return.
- Added an online prop editor with live updates, automatic type detection, validation, and formatting.

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
