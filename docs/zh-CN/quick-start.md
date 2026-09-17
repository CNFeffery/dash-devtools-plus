# ⚡ 快速开始

Dash Devtools Plus 是基于 Dash 中 Hooks 机制的 Dash 应用开发调试额外功能增强插件 ✨。它在 Dash 原生 Dev Tools 工具栏中增加一个工作区，不替换原生工具栏，也不会改变生产环境行为。

## ✅ 环境要求

- Python 3.9 及以上
- Dash 3.4.0 及以上
- Dash 应用同时启用调试模式和原生 Dev Tools UI

## 📦 安装

```bash
pip install dash-devtools-plus
```

本包提供 `dash_hooks` 入口点。安装后 Dash 会自动发现该入口点；导入包即可完成集成注册。

## 🪄 最小应用

需要自定义选项时，请在创建 `Dash` 实例前调用 `configure_devtools_plus`；如果默认值已满足需求，可以省略该调用。

```python
from dash import Dash, html
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(default_locale="zh-CN")

app = Dash(__name__)
app.layout = html.Div("Hello, Dash Devtools Plus")

if __name__ == "__main__":
    app.run(debug=True)
```

访问应用后，在 Dash 原生右下角工具栏中点击 **Devtools Plus**。

## 🧯 面板没有出现时

插件只会在以下两个条件同时满足时显示：

1. Dash 正在以调试模式运行；
2. Dash 原生 Dev Tools UI 已启用。

这样能避免在普通生产会话中暴露回调源码位置、运行时清单和服务器遥测数据。源码根目录和编辑器相关设置见[配置参数](configuration.md)。
