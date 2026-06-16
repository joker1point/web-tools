## API 联通测试 Dashboard — 使用与原理文档

### 这是什么

一个本地运行的 Web 工具，帮助开发者快速验证主流 LLM API 的连通性。你只需在浏览器里填写 API Key、选择服务商，即可一键完成两项核心测试：获取可用模型列表，以及测量请求延迟。

整个过程不需要后端服务，所有 API 请求直接从你的浏览器发出。

---

### 快速开始

```bash
# 进入项目目录
cd react-vite

# 安装依赖（首次使用）
npm install

# 启动开发服务器
npm run dev
```

启动后在浏览器访问 `http://127.0.0.1:5173/` 即可看到 Dashboard 界面。

---

### 功能说明

#### 1. API 配置区

配置区位于页面顶部，包含三个输入项：

**API Key** — 你的服务商密钥，支持密码显隐切换。系统会根据选择的服务商自动决定认证方式：Anthropic 使用 `x-api-key` 请求头，其他服务商使用标准的 `Authorization: Bearer` 格式。

**Base URL** — 下拉菜单预置了 15 家常见 LLM 服务商，包括 OpenAI、Anthropic、Google Gemini、DeepSeek、Moonshot、智谱 AI、通义千问、SiliconFlow、Together AI、Groq、Mistral AI、零一万物、百川智能、MiniMax、Agnes AI。如果你的服务商不在列表中，选择「自定义 URL」手动输入即可。

**测试模型名称** — 指定连通性测试使用的模型。可以直接输入模型名称，也可以从下拉建议中选择。如果你先执行了「获取模型列表」，AutoComplete 会自动把返回的模型作为候选项，方便快速选择。

**请求体配置（可折叠）** — 点击「请求体配置 展开 ▾」可展开高级选项：
- **测试语句** — 自定义发送给模型的消息内容（默认 `Hi`），支持多行文本，最大 2000 字符，带实时计数
- **Max Tokens** — 自定义 `max_tokens` 字段（默认 16，范围 1-2048）

#### 2. 测试一：模型列表

点击「获取模型列表」按钮，系统向 `{Base URL}/v1/models` 发起 GET 请求，以表格形式展示返回结果。表格包含三列：模型 ID、所有者、对象类型，支持分页和搜索过滤。右上角会显示本次请求的耗时（毫秒）。

如果服务商不支持 `/v1/models` 端点或返回错误，会以红色 Alert 展示具体错误信息和 HTTP 状态码。

#### 3. 测试二：连通性与延迟

点击「发送测试请求」按钮，系统向 `{Base URL}/v1/chat/completions`（Anthropic 为 `/v1/messages`）发起一个轻量级的 streaming 请求。消息内容和 `max_tokens` 来自上方的「请求体配置」区域（默认消息 `"Hi"`，默认 `max_tokens=16`）。

请求完成后展示三项指标：

- **状态码** — HTTP 响应码，2xx 为绿色，其他为红色
- **TTFT（首字时间）** — 从发出请求到收到第一个 streaming chunk 的耗时，反映服务的初始响应速度
- **总延迟** — 从发出请求到流式传输全部完成的总耗时

下方还会展示响应内容片段，以及多次测试的历史对比表格（含模型名称列），方便观察不同模型或不同时间点的延迟差异。

#### 4. 主题切换

右上角开关可在亮色/暗色模式间切换。主题切换会同步更新 Ant Design 组件主题和所有 CSS 自定义属性（seed tokens），确保全局配色一致。

---

### 工作原理

#### 架构

项目基于 React 18 + Vite 5 + Ant Design 5 构建，是一个纯前端的单页应用（SPA）。没有后端服务器，所有网络请求通过浏览器原生的 `fetch` API 直接发出。

```
浏览器 ──fetch──▶ LLM API 服务商
        ◀──响应──
```

#### 认证处理

不同服务商的 API 认证方式有差异，系统通过检测 Base URL 中是否包含 `anthropic.com` 来自动切换：

| 服务商 | 请求头 | 示例 |
|--------|--------|------|
| Anthropic | `x-api-key` + `anthropic-version` | `x-api-key: sk-ant-...` |
| 其他（OpenAI 兼容） | `Authorization: Bearer` | `Authorization: Bearer sk-...` |

#### 延迟测量

延迟测试采用 streaming 模式（`"stream": true`），利用 `ReadableStream` API 逐 chunk 读取响应：

1. 记录 `performance.now()` 作为起始时间
2. 调用 `fetch` 发起请求
3. 当第一个 chunk 到达时，记录 TTFT = `当前时间 - 起始时间`
4. 持续读取直到流结束，记录总延迟
5. 解析 SSE `data:` 行，提取模型返回的文本内容

这种方式比非 streaming 请求能更精确地分离「服务响应速度」和「完整传输耗时」。

#### 主题系统

主题通过两套机制协同实现：

- **Ant Design ConfigProvider** — 通过 `theme.algorithm`（`defaultAlgorithm` / `darkAlgorithm`）控制所有 Ant Design 组件的内置样式
- **CSS Custom Properties** — `:root` 上定义 `--seed-bg`、`--seed-surface`、`--seed-fg`、`--seed-primary`、`--seed-accent`、`--seed-border` 等 seed token，供全局样式和行内样式引用。切换主题时，`useEffect` 会将对应的暗色/亮色值写入 DOM，实现 `var()` 引用同步更新

#### CORS 说明

由于请求从浏览器直接发出，目标 API 必须允许跨域访问（设置 `Access-Control-Allow-Origin` 响应头）。大部分主流 LLM 服务商已支持 CORS，但如果遇到跨域错误，可以考虑：

- 在本地启动一个反向代理（如 `cors-anywhere`、`nginx`）
- 使用支持 CORS 的 API 中转服务
- 在 Vite 配置中添加 `server.proxy` 规则

---

### 项目结构

```
react-vite/
├── index.html            # Vite 入口 HTML
├── vite.config.js        # Vite 构建配置
├── package.json          # 项目依赖
├── canvas-design.html    # Canvas 预览入口
└── src/
    ├── main.jsx          # React 挂载入口
    ├── App.jsx           # Dashboard 主组件（全部业务逻辑）
    └── styles.css        # 全局样式 + seed tokens + Ant Design 覆写
```

App.jsx 是一个自包含的单文件组件，包含预置服务商列表、认证逻辑、API 请求函数、状态管理和完整的 UI 渲染。对于当前规模的工具来说，单文件结构足够清晰且易于维护。

---

### 生产构建

```bash
npm run build
```

产物输出到 `dist/` 目录，可以用任何静态文件服务器（如 `npx serve dist`）托管。
