# Configuration

Configure Dash Devtools Plus before creating the `Dash` application instance:

```python
from pathlib import Path

from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(
    default_locale="en",
    accent_color="#119DFF",
    editor="vscode",
    project_root=Path(__file__).resolve().parent,
)
```

## Parameters

| Parameter | Type | Default | Purpose |
| --- | --- | --- | --- |
| `default_locale` | `"en"` or `"zh-CN"` | `"en"` | Initial panel language. A language selected in the browser takes precedence on later visits. |
| `accent_color` | `str` | `"#119DFF"` | Primary accent color for Devtools Plus controls and highlights. |
| `editor` | `"vscode"`, `"cursor"`, `"pycharm"`, or `None` | `"vscode"` | Preferred editor used by source-opening actions. `None` disables choosing a preferred editor. |
| `project_root` | `str`, `Path`, or `None` | `None` | Server-side project boundary for source locations and direct-import dependency discovery. It must be an existing directory. |
| `editor_project_root` | `str`, `Path`, or `None` | `None` | Client-visible project root. Use it when the Dash server and browser/IDE use different filesystem paths. |

## Local server and local editor

For a typical local checkout, `project_root` is enough:

```python
configure_devtools_plus(project_root=Path(__file__).resolve().parent)
```

## Containerized server and local editor

The server may see `/app` while your editor sees a Windows or macOS checkout. Keep the server boundary and editor target separate:

```python
configure_devtools_plus(
    project_root="/app",
    editor_project_root=r"C:\projects\my-dash-app",
    editor="cursor",
)
```

`project_root` is also the security boundary for source metadata: files outside it are not exposed as project callback sources or direct project imports.

## Multiple Dash applications

Registration is idempotent. A process can create multiple Dash applications, and Devtools Plus binds its debug state and component properties to the owning app. Configure shared defaults before creating those apps.
