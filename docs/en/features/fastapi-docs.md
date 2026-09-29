# FastAPI API documentation

When the Dash app uses a FastAPI server, Devtools Plus adds an **API docs** tab. It embeds FastAPI's Swagger UI and ReDoc pages, lets you switch between the available views, and opens the selected page in a separate browser tab.

The links come from the server's actual `docs_url`, `redoc_url`, and `root_path` settings. A custom Dash route prefix does not change where FastAPI serves its documentation. If one documentation page is disabled, only the other is offered; if OpenAPI documentation is disabled entirely, the tab explains that no page is available. Flask-backed Dash apps do not show this tab.

Try [`examples/fastapi/app.py`](../../../examples/fastapi/app.py): its documentation lives at `/api/docs` and `/api/redoc` and includes sample task endpoints with query parameters, path parameters, and a validated request body.
