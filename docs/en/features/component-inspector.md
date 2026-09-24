# 🔍 Component inspector

> ✨ Click what you see, then follow it back to the Dash component that owns it.

The component inspector maps a rendered page element back to the closest owning Dash component.

![Component inspector resolved a DataTable](../../../imgs/docs/component-inspector.webp)

## 🧭 Workflow

1. Open **Component inspector** and select **Start component inspection**.
2. Move over the running application; the nearest supported Dash component is highlighted.
3. Click an element to reopen the panel with its component identity, DOM mapping, layout path, and current props.
4. Press `Esc` to cancel inspection without selecting an element.

The inspection click is intercepted before it reaches the target control, so selecting a button, input, table cell, or pagination control does not also perform that control's normal action.

## 🧩 Inspection output

| Section | What it answers |
| --- | --- |
| Selected element → mapped component | Which DOM element was clicked and which Dash component owns it. |
| Identity | Namespace, component type, ID, root DOM element, and dimensions. |
| Layout path | The component's location in the Dash layout tree; it can be copied for debugging. |
| Current props | Runtime prop values, inferred types, search, copying, and expandable structured values. |
| Nested component values | Drill into registered Dash components found inside prop values, then navigate back through the inspection breadcrumb. |

Dash development-tool namespaces are excluded so the inspector focuses on the application rather than the tool UI itself.
