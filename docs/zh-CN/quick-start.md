# ⚡ 快速开始

Dash Devtools Plus 是基于 Dash 中 Hooks 机制的 Dash 应用开发调试额外功能增强插件 ✨。它在 Dash 原生 Dev Tools 工具栏中增加一个工作区，不替换原生工具栏，也不会改变生产环境行为。

## ✅ 环境要求

- Python 3.9 及以上
- Dash 3.4.0 及以上
- Dash 应用同时启用调试模式和原生 Dev Tools UI

## 📦 安装

```bash
pip install dash-devtools-plus -U
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

## FastAPI 后端

FastAPI 后端要求 Dash 版本不低于 4.2。安装可选依赖后，可以通过
`backend="fastapi"` 创建后端，也可以将已有的 `FastAPI` 服务传给 `Dash`：

```bash
pip install "dash-devtools-plus[fastapi]"
```

```python
from fastapi import FastAPI
from dash import Dash, html

server = FastAPI()
app = Dash(__name__, server=server)
app.layout = html.Div("Dash with FastAPI")
```

自行提供 FastAPI 服务时，请使用 Uvicorn 启动。仓库中的
[`fastapi` 示例](../../examples/fastapi/app.py) 同时包含 Dash 回调和异步
`/api/health` 接口。

### 使用 WebSocket 流式回调

FastAPI 示例还展示了 Dash 4.2 的 WebSocket 回调：通过
`websocket_callbacks=True` 启用传输，为每个浏览器会话运行一个 `async def`
持久回调，使用 `await ctx.websocket.get_prop(...)` 读取当前控件，再通过
`set_props(...)` 流式更新组件内容。FastAPI 可选依赖会安装
`uvicorn[standard]`，其中包含 Uvicorn 所需的 WebSocket 实现。

## 🧯 面板没有出现时

插件只会在以下两个条件同时满足时显示：

1. Dash 正在以调试模式运行；
2. Dash 原生 Dev Tools UI 已启用。

这样能避免在普通生产会话中暴露回调源码位置、运行时清单和服务器遥测数据。源码根目录和编辑器相关设置见[配置参数](configuration.md)。
