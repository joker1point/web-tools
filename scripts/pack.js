#!/usr/bin/env node
/**
 * pack.js - 一键打包所有 Web 工具到 dist/
 *
 * 收集以下内容到 dist/ 目录，可直接用任何静态服务器托管：
 *   - index.html, remove-hash.html, html-preview.html  (顶层静态工具)
 *   - api-dashboard/  (React + Vite 编译产物)
 *
 * 用法: node scripts/pack.js
 *       npm run build
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const DIST       = path.join(ROOT, 'dist');
const REACT_DIST = path.join(ROOT, 'react-vite', 'dist');

const STATIC_TOOLS = ['index.html', 'remove-hash.html', 'html-preview.html'];

const log = (msg) => console.log(`\x1b[36m[pack]\x1b[0m ${msg}`);
const ok  = (msg) => console.log(`\x1b[32m[ok]\x1b[0m   ${msg}`);

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  log('清理旧的 dist/ 目录...');
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  // 1) 复制顶层静态工具
  for (const file of STATIC_TOOLS) {
    const src = path.join(ROOT, file);
    if (await exists(src)) {
      await fs.copyFile(src, path.join(DIST, file));
      ok(`复制 ${file}`);
    } else {
      console.warn(`[skip] ${file} 不存在`);
    }
  }

  // 2) 复制 React 编译产物
  if (!(await exists(REACT_DIST))) {
    console.error('\n[error] react-vite/dist 不存在，请先执行 npm run build:react');
    process.exit(1);
  }
  await copyDir(REACT_DIST, path.join(DIST, 'api-dashboard'));
  ok('复制 react-vite/dist → dist/api-dashboard/');

  // 3) 生成 manifest.json
  const manifest = {
    name: 'Web Tools',
    version: '1.1.0',
    builtAt: new Date().toISOString(),
    tools: [
      { name: '文本清理替换工具', entry: 'remove-hash.html', type: 'static' },
      { name: 'HTML 实时渲染预览', entry: 'html-preview.html', type: 'static' },
      { name: 'LLM API 联通测试 Dashboard', entry: 'api-dashboard/index.html', type: 'spa', framework: 'React 18 + Vite 5' },
    ],
  };
  await fs.writeFile(
    path.join(DIST, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  ok('生成 manifest.json');

  // 4) 统计
  const size = await getDirSize(DIST);
  ok(`打包完成 → dist/  (${(size / 1024).toFixed(1)} KB)`);
  log('本地预览: npx serve dist');
}

async function getDirSize(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await getDirSize(p);
    else {
      const stat = await fs.stat(p);
      total += stat.size;
    }
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
