# ⚙️ 配置参数

请在创建 `Dash` 应用实例前配置 Dash Devtools Plus：

```python
from pathlib import Path

from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(
    default_locale="zh-CN",
    accent_color="#119DFF",
    editor="vscode",
    project_root=Path(__file__).resolve().parent,
)
```

## 🎛️ 参数一览

| 参数 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `default_locale` | `"en"` 或 `"zh-CN"` | `"en"` | 面板初始语言。用户在浏览器中切换过语言后，本地偏好优先。 |
| `accent_color` | `str` | `"#119DFF"` | Devtools Plus 控件和高亮区域使用的主强调色。 |
| `editor` | `"vscode"`、`"cursor"`、`"pycharm"` 或 `None` | `"vscode"` | 源码打开动作优先使用的编辑器。设为 `None` 时不指定首选编辑器。 |
| `project_root` | `str`、`Path` 或 `None` | `None` | 服务端用于定位源码、扫描直接导入依赖的项目边界；必须是已存在目录。 |
| `editor_project_root` | `str`、`Path` 或 `None` | `None` | 浏览器/IDE 可见的项目根目录。Dash 服务端与本地编辑器看到的文件路径不同的时候使用。 |

## 💻 本地服务端与本地编辑器

普通本地项目只设置 `project_root` 即可：

```python
configure_devtools_plus(project_root=Path(__file__).resolve().parent)
```

## 📦 容器中的服务端与本地编辑器

服务端可能看到 `/app`，而编辑器看到 Windows 或 macOS 上的本地目录。此时应分别提供服务端边界和编辑器目标：

```python
configure_devtools_plus(
    project_root="/app",
    editor_project_root=r"C:\projects\my-dash-app",
    editor="cursor",
)
```

`project_root` 同时是源码元数据的安全边界：位于该目录之外的文件不会作为项目回调源码或项目直接导入项暴露。

## 🧩 多个 Dash 应用

注册过程是幂等的。同一进程可创建多个 Dash 应用，Devtools Plus 会把调试状态和组件属性绑定到各自所属的应用。请在创建这些应用前配置共享默认值。
