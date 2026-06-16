# Web Tools - 实用网页工具集

实用网页工具集，包含纯前端工具和本地可运行的单页应用。

一键体验链接：https://joker1point.github.io/web-tools

##  工具列表

### 1. 文本清理替换工具 ([remove-hash.html](remove-hash.html))

自动去除文本中的 `#` 和 `*` 符号，支持自定义文字替换规则。

**功能：**
- 实时清理：输入即处理，无需点击按钮
- 一键去井号与星号
- 自定义替换规则（支持多规则同时生效）
- 预设快捷标签（如 `熊大 → 图中动物`）
- 实时统计面板（字符数、符号数、替换次数）
- 一键复制/粘贴处理

### 2. HTML 实时渲染预览 ([html-preview.html](html-preview.html))

粘贴 HTML 代码即可实时渲染预览，所见即所得。

**功能：**
- 实时预览：输入后 300ms 自动渲染
- 粘贴并渲染：一键读取剪贴板 HTML
- 内置 5 个常用模板（空白、基础结构、按钮、卡片、表单）
- 可拖拽调整编辑器/预览区比例
- Tab 键自动缩进
- 暗色主题编辑器

### 3. API 联通测试 Dashboard ([react-vite/](react-vite/))

本地运行的 LLM API 连通性验证工具，支持 15+ 主流服务商。

**功能：**
- 一键获取可用模型列表
- Streaming 延迟测试（TTFT + 总延迟 + 历史对比）
- 自动识别 Anthropic / OpenAI 兼容认证方式
- 亮色/暗色主题切换
- 基于 React 18 + Vite 5 + Ant Design 5

**启动：**
```bash
cd react-vite && npm install && npm run dev
```

## 🚀 使用方式

- **纯前端工具（1、2）**：下载对应 `.html` 文件，双击浏览器打开即可
- **React 应用（3）**：本地 `npm install && npm run dev` 启动开发服务器

无需安装、无需网络（除 API 测试需联网）。

## 📦 一键打包

将所有工具（静态页 + React Dashboard）打包到 `dist/`，可用任何静态服务器托管：

```bash
# 跨平台 (推荐)
./build.sh            # Git Bash / Linux / macOS
build.bat             # Windows 原生 cmd

# 或使用 npm
npm run build
```

构建流程：
1. 安装 `react-vite` 依赖
2. 编译 React Dashboard (Vite build)
3. 收集所有工具到 `dist/`
   - `index.html` — 入口导航
   - `remove-hash.html` — 文本清理工具
   - `html-preview.html` — HTML 预览工具
   - `api-dashboard/` — React Dashboard 编译产物
   - `manifest.json` — 工具清单

本地预览打包结果：

```bash
npm run preview       # 默认 4173 端口
# 或
npx serve dist
```

GitHub Pages 已配置自动部署（`.github/workflows/static.yml`），`main` 分支 push 后自动构建并发布到 https://joker1point.github.io/web-tools/。

## 📄 License

MIT
