# FastAPI 接口文档

当 Dash 应用使用 FastAPI 服务时，Devtools Plus 会显示“接口文档”标签页。页面通过 iframe 嵌入 FastAPI 自带的 Swagger UI 和 ReDoc，可切换两种视图，也可将当前文档在独立浏览器标签页中打开。

文档链接取自服务实际配置的 `docs_url`、`redoc_url` 和 `root_path`，不会误用 Dash 自身的路由前缀。若只启用一种文档页面，切换区只显示可用项；若完全关闭 OpenAPI 文档，标签页会显示提示。Flask 后端不会显示此标签页。

可运行 [`examples/fastapi/app.py`](../../../examples/fastapi/app.py) 体验：示例将文档地址改为 `/api/docs` 和 `/api/redoc`，并提供包含查询参数、路径参数与请求体验证的任务接口。
