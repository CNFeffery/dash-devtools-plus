<img src="./branding/devtools-plus-logo.svg" alt="Dash Devtools Plus logo" width="88" />

# Dash Devtools Plus

一个基于 Dash Hooks API、专注于 Dash 应用开发体验的增强型开发者控制台。

[English](./README.md) | 简体中文

Dash Devtools Plus 在不修改应用布局的前提下，为 Dash 原生开发者工具栏增加一个基于 Ant Design 的工作区，提供回调诊断、组件检查、状态快照、运行时组件库与 Hooks 清单，以及服务器资源监控能力。

> [!IMPORTANT]
> Dash Devtools Plus 仅用于开发环境。只有同时启用 Dash 调试模式和原生 Dev Tools UI 时，其界面和元数据接口才会开放。请勿将调试服务器暴露到不可信网络。

## 目录

- [特性](#特性)
- [环境要求](#环境要求)
- [安装](#安装)
- [快速开始](#快速开始)
- [配置](#配置)
- [Devtools Plus 功能板块](#devtools-plus-功能板块)
  - [服务器资源](#服务器资源)
  - [回调](#回调)
  - [组件检查器](#组件检查器)
  - [状态快照](#状态快照)
  - [组件库](#组件库)
  - [Dash Hooks](#dash-hooks)
- [安全与使用边界](#安全与使用边界)
- [项目开发](#项目开发)
- [项目结构](#项目结构)
- [架构](#架构)
- [参与贡献](#参与贡献)
- [开源协议](#开源协议)

## 特性

- 原生集成 `hooks.devtool`，与 Dash Dev Tools 共享弹窗状态。
- 支持 English 和简体中文界面。
- 可搜索的回调关系、源码位置和 IDE 跳转能力。
- 点击页面元素即可检查对应 Dash 组件及其当前属性。
- 支持选择组件、创建会话级状态快照并恢复属性。
- 展示运行时组件库和 Dash Hooks 插件清单。
- 实时展示 CPU、内存、磁盘、操作系统及 Python 运行时信息。
- 前端资产随 Python 包本地分发，运行时无需依赖 CDN。
- 元数据接口仅在调试模式下开放，并禁止缓存响应。

## 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Python | 3.9 或更高版本 | Python 包及 Dash 应用运行环境 |
| Dash | 3.3 或更高版本 | Dash Hooks 和 Dev Tools API |
| Node.js | 20.19 或更高版本，或 22.12 及更高版本 | 仅用于前端开发 |
| npm | 随 Node.js 一同安装 | 管理前端依赖及构建 |

通过 Python 包使用本项目的用户不需要安装 Node.js，发布包中已经包含构建完成的 JavaScript 和 CSS 文件。

## 安装

从 PyPI 安装：

```bash
pip install dash-devtools-plus
```

如果需要参与项目开发，请参考[项目开发](#项目开发)章节。

## 快速开始

安装后，Dash 会通过 `dash_hooks` 入口点自动发现本插件。如需自定义配置，请在创建 Dash 应用之前调用配置函数：

```python
from dash import Dash, html
from dash_devtools_plus import configure_devtools_plus

configure_devtools_plus(
    default_locale="zh-CN",
    accent_color="#119DFF",
    editor="vscode",
)

app = Dash(__name__)
app.layout = html.Div("你好，Dash")

if __name__ == "__main__":
    app.run(debug=True)
```

打开应用后，在 Dash 原生开发者工具栏中选择 **Devtools Plus**。

## 配置

请在创建 `Dash` 实例之前调用 `configure_devtools_plus`。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `default_locale` | `"en" \| "zh-CN"` | `"en"` | 初始界面语言。用户切换语言后，浏览器本地偏好优先。 |
| `accent_color` | `str` | `"#119DFF"` | Devtools Plus 界面的主题强调色。 |
| `editor` | `"vscode" \| "cursor" \| "pycharm" \| None` | `"vscode"` | 回调源码跳转使用的首选编辑器。设置为 `None` 可禁用编辑器链接。 |
| `project_root` | `str \| Path \| None` | `None` | 服务器端解析回调源码时使用的项目边界。 |
| `editor_project_root` | `str \| Path \| None` | `None` | 浏览器和 Dash 服务器使用不同文件路径时，本地编辑器可见的项目根目录。 |

在 Docker、WSL、远程工作区或其他两端文件路径不一致的环境中，可显式映射服务器项目目录和本地编辑器目录：

```python
configure_devtools_plus(
    project_root="/app",
    editor_project_root=r"C:\projects\my-dash-app",
)
```

只有位于项目根目录中的回调文件才会生成编辑器链接。服务器不会直接启动编辑器进程，也不会接受浏览器传入的文件路径。

## Devtools Plus 功能板块

| 板块 | 功能概述 | 详情 |
| --- | --- | --- |
| 服务器资源 | 实时展示服务器资源占用和运行环境概况 | [查看详情](#服务器资源) |
| 回调 | 查询回调依赖、执行行为及源码元数据 | [查看详情](#回调) |
| 组件检查器 | 通过页面元素定位并检查对应 Dash 组件 | [查看详情](#组件检查器) |
| 状态快照 | 选择性捕获和恢复组件属性 | [查看详情](#状态快照) |
| 组件库 | 展示已加载的 Dash 组件包、版本及导入别名 | [查看详情](#组件库) |
| Dash Hooks | 展示 Hook 插件、注册顺序及诊断信息 | [查看详情](#dash-hooks) |

### 服务器资源

### 回调

### 组件检查器

### 状态快照

### 组件库

### Dash Hooks

## 安全与使用边界

只有同时启用 Dash 调试模式和原生 Dev Tools UI 时，工具栏组件和 Devtools Plus 元数据路由才会开放。条件不满足时，直接请求这些接口会收到通用且禁止缓存的 `404` 响应。

开发接口可能暴露回调名称、项目相对源码路径、已安装包版本、Hook 注册信息以及服务器运行环境信息。这些接口自身不构成身份认证边界，因此应仅在可信机器或受保护的开发网络中运行调试应用。

状态快照和组件检查完全在浏览器中运行。快照保存在当前标签页的 `sessionStorage` 中，恢复组件属性时可能触发相关 Dash 回调。

## 项目开发

### 创建 Conda 或 Mamba 环境

推荐在同一个 Conda 环境中安装 Python 和 Node.js。直接从 `conda-forge` 安装 Node.js，可以避免额外安装和维护系统级 Node.js。

使用 Mamba：

```bash
mamba create -n dash-devtools-plus-dev -c conda-forge python=3.12 "nodejs>=22.12,<23"
conda activate dash-devtools-plus-dev
```

使用 Conda：

```bash
conda create -n dash-devtools-plus-dev -c conda-forge python=3.12 "nodejs>=22.12,<23"
conda activate dash-devtools-plus-dev
```

检查开发工具链：

```bash
python --version
node --version
npm --version
```

### 安装开发依赖

在项目根目录执行：

```bash
python -m pip install -e ".[dev]"
npm ci
```

`npm ci` 会严格按照 `package-lock.json` 中记录的版本安装前端依赖。

### 构建前端

```bash
npm run build
```

Vite 会将发布资产写入 `dash_devtools_plus/assets/`。这些 JavaScript 和 CSS 文件属于 Python 发布包的一部分，修改前端源代码后需要重新构建并提交它们。

开发过程中如需持续监听并重新构建：

```bash
npm run dev
```

### 运行测试

```bash
python -m pytest
npm run test:frontend
```

### 使用 Ruff 检查与格式化

检查 Python 代码：

```bash
ruff check .
ruff format --check .
```

应用安全的自动修复和格式化：

```bash
ruff check . --fix
ruff format .
```

Ruff 的 Python 目标版本、行长度等设置统一保存在 `pyproject.toml` 中。

### 运行示例应用

```bash
python examples/app.py
```

打开 <http://127.0.0.1:8050>，然后在 Dash 开发者工具栏中选择 **Devtools Plus**。

### 构建 Python 发布包

重新构建前端资产后，生成源码包和 wheel：

```bash
python -m build
```

生成的发布文件位于 `dist/`。

## 项目结构

```text
dash_devtools_plus/
  assets/                 随 Python 包分发的 JavaScript 和 CSS
  hook_inventory.py       Dash Hooks 发现和运行时清单
  plugin.py               Hooks、路由、配置和 Dev Tools 注册
  server_metrics.py       服务器资源采样
frontend/
  src/                    React 界面和浏览器端诊断逻辑
  tests/                  基于 Node.js 的前端测试
examples/                 开发及验收示例应用
tests/                    Python 测试
package.json              前端依赖及脚本
pyproject.toml            Python 包和工具配置
vite.config.js            前端库构建配置
```

## 架构

- 导入 Python 包时，通过 Dash Hooks 注册表注册前端资产、元数据路由、setup hook 和 Dev Tools 组件。
- setup hook 将 Dev Tools 组件绑定到对应 Dash 应用，并跟踪 Dash 最终解析出的调试状态。
- 回调、组件库、Hooks 库和服务器资源数据通过受调试状态保护的应用路由提供。
- React 界面被编译为 IIFE bundle，并复用 Dash 提供的 React 和 ReactDOM 实例。
- 组件检查器通过浏览器组件 API 读取当前 Dash 布局，并沿 React 树解析页面元素对应的组件。
- 状态快照在浏览器中序列化可安全转换为 JSON 的组件属性，并通过 `dash_clientside.set_props` 恢复。

## 参与贡献

欢迎提交改进。在创建 Pull Request 之前，请确保：

1. 已更新相关源文件，并在必要时重新构建前端资产。
2. 已运行 Python 和前端测试。
3. 已通过 Ruff 检查和格式化验证。
4. 提交中不包含缓存、本地虚拟环境或构建归档文件。

## 开源协议

[MIT](./LICENSE)
