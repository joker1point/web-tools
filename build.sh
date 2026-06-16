#!/usr/bin/env bash
# build.sh - 一键打包所有 Web 工具 (Linux / macOS / Git Bash on Windows)
#
# 流程:
#   1. 安装 react-vite 依赖
#   2. 编译 React Dashboard
#   3. 收集所有工具到顶层 dist/
#
# 用法:
#   ./build.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Web Tools · 一键打包脚本          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 颜色
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${CYAN}[build]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC}    $1"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $1"; }

# 检测包管理器
if command -v yarn >/dev/null 2>&1; then
  PM="yarn"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  echo "错误: 需要 npm 或 yarn"
  exit 1
fi

info "使用包管理器: $PM"
info "Node 版本: $(node -v)"

# 1) 安装 React Dashboard 依赖
if [ ! -d "react-vite/node_modules" ]; then
  info "安装 react-vite 依赖..."
  cd react-vite
  $PM install
  cd ..
else
  info "react-vite/node_modules 已存在，跳过安装"
fi

# 2) 编译 React
info "编译 React Dashboard..."
cd react-vite
$PM run build
cd ..

# 3) 运行 pack.js
info "收集所有工具到 dist/..."
node scripts/pack.js

ok "全部完成 ✓"
echo ""
echo "  本地预览:  npx serve dist"
echo "  部署:      GitHub Pages 已配置自动部署"
echo ""
