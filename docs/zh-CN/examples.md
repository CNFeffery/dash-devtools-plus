# 🧪 示例应用

0.1.4 开发版源码提供五个示例应用，均使用仓库根目录配置 `configure_devtools_plus`。建议先按[源码安装说明](quick-start.md#体验未发布的-014)安装当前版本；完整示例还需要 `feffery-antd-components` 和 `dash-mantine-components`。

| 示例 | 用途 | 运行命令 |
| --- | --- | --- |
| `simple` | 验证最小回调图：一个服务端回调与一个客户端回调。 | `python examples/simple/app.py` |
| `callback_performance` | 对比递增延时、固定延时轮询和即时浏览器端回调，集中体验实时性能监控。 | `python examples/callback_performance/app.py` |
| `intermediate` | 使用 Dash 内置组件体验聚焦的旅行预算规划场景。 | `python examples/intermediate/app.py` |
| `comprehensive` | 大规模覆盖回调拓扑、模式匹配、源码探查、快照、依赖库和工具栏主题。 | `python examples/comprehensive/app.py` |
| `fastapi` | 通过 `backend="fastapi"` 运行 Dash，使用持久 WebSocket 回调流式推送服务端时间，并提供异步 API 接口。需要先执行 `pip install "dash-devtools-plus[fastapi]"`。 | `python examples/fastapi/app.py` |

五个示例默认均使用 `8050` 端口，请一次只运行一个，然后访问 <http://127.0.0.1:8050>。按你想验证的问题挑选复杂度，让 Devtools Plus 带你看清每个环节 ✨。

## 体验回调性能监控

运行 `python examples/callback_performance/app.py`，打开 **Devtools Plus → 回调关系**，保留“性能指标”开关为开启状态。

1. 多次点击服务端按钮。每次点击增加 0.5 秒等待，最高四秒；对比最近、平均、最小和最大耗时。
2. 打开 `handle_poll` 的详情。它每两秒执行一次、固定等待 0.35 秒，可积累稳定的耗时历史。历史默认显示五条，展开后最多显示 20 条。
3. 触发客户端按钮后打开对应详情。趋势图展示客户端耗时，Dash 请求和响应传输量为零。
4. 点击“回调数据流”右上角的全屏图标放大依赖关系，按 `Esc` 返回。性能区的信息按钮可查看样本覆盖范围和传输量估算口径。

数据来自当前浏览器页面中的真实执行，刷新页面会开启新的监控会话。该示例用于对比功能，不是基准测试；指标定义与限制见[回调执行性能](features/callbacks.md#callback-performance)。

## 完整回调实验室

0.1.4 源码中的完整示例有意包含原生报错测试控件、后台与 WebSocket 注册形态，以及 131 条回调。它适合验收与压力检查，不建议将其刻意扩张的回调拓扑直接照搬到生产应用。

![完整回调实验室](../../imgs/docs/comprehensive-example.webp)
