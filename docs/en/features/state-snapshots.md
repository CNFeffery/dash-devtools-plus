# 📸 State snapshots

> ✨ Save a useful moment during exploration, then return to it in the same tab.

State snapshots capture selected component props and restore them later in the same browser tab.

![Create a state snapshot](../../../imgs/docs/state-snapshot-capture.png)

## ✨ Create a snapshot

1. Select **New snapshot**.
2. Review the components grouped by component library. Detected components are selected by default.
3. Search, limit the list to components with IDs, or uncheck entries that should not be captured.
4. Give the snapshot a name and save it.

## ↩️ Restore and delete

The snapshot list shows the creation time, number of components, and number of saved props. Restore applies saved values through Dash's clientside property update mechanism. A restore can trigger callbacks, so treat it as a real application state change. Deleting a snapshot cannot be undone.

## 🧱 Storage boundary

Snapshots live in browser session storage. They are scoped to the current browser tab and are not a server-side persistence or collaboration feature. When storage becomes full, the panel warns that newly created snapshots are only available until refresh.
