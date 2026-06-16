@echo off
REM build.bat - 一键打包所有 Web 工具 (Windows 原生命令行)
REM
REM 用法: build.bat

setlocal enabledelayedexpansion

echo.
echo ============================================
echo    Web Tools - 一键打包脚本
echo ============================================
echo.

cd /d "%~dp0"

REM 1) 安装 React Dashboard 依赖
if not exist "react-vite\node_modules" (
  echo [build] 安装 react-vite 依赖...
  cd react-vite
  call npm install
  if errorlevel 1 (
    echo [error] npm install 失败
    exit /b 1
  )
  cd ..
) else (
  echo [build] react-vite\node_modules 已存在，跳过安装
)

REM 2) 编译 React
echo [build] 编译 React Dashboard...
cd react-vite
call npm run build
if errorlevel 1 (
  echo [error] npm run build 失败
  exit /b 1
)
cd ..

REM 3) 运行 pack.js
echo [build] 收集所有工具到 dist\...
call node scripts\pack.js
if errorlevel 1 (
  echo [error] pack 失败
  exit /b 1
)

echo.
echo [ok] 全部完成
echo.
echo   本地预览:  npx serve dist
echo   部署:      GitHub Pages 已配置自动部署
echo.

endlocal
