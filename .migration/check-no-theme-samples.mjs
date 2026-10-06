#!/usr/bin/env node
/**
 * 防止「主题示例数据泄漏到成品站」的回归检查。
 *
 * 背景：`UniverseCanvas.astro` 曾直接 `import yamlConfig from '../../../config/site.yaml'`
 * 只为读 `universe` 段 — 这会把**整个** site.yaml 拉进该组件模块，导致 Astro 在
 * 客户端脚本里内联了作者的示例标题，页面标题一度渲染成「余弦 = cosine」。
 *
 * 这个脚本扫描构建产物，确保主题自带的示例值一个都不出现。
 * 任何组件都应从 `@constants/site-config` 读取规范化后的值，而不是直接导入 YAML 根。
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'D:\\myBlog-astro\\dist';

/** 主题自带 site.yaml 里的示例值 / 作者信息，绝不应出现在成品站里。 */
const THEME_SAMPLES = [
  '余弦の博客',
  'WA 的一声就哭了',
  '一个基于 Astro 的现代化博客主题',
  'koharu.cosine.ren',
  'blog.cosine.ren',
  'cosine',
  // 主题自带的 src/assets/svg/logo.svg 里是手写体 "Cosine"；
  // site.showLogo: true 会把它渲染到页头，必须替换 logo 或关掉开关。
  'Cosine',
  'your-username',
  'your@email.com',
  'your-umami-id',
  'stats.example.com',
];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const files = walk(DIST).filter((f) => /\.(html|js|json|xml|css)$/.test(f));
const hits = [];
for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const sample of THEME_SAMPLES) {
    if (text.includes(sample)) {
      hits.push({ file: path.relative(DIST, file), sample });
    }
  }
}

console.log(`扫描 ${files.length} 个构建产物文件`);

// 分组输出，避免同一示例在多页重复刷屏
const bySample = new Map();
for (const { file, sample } of hits) {
  if (!bySample.has(sample)) bySample.set(sample, new Set());
  bySample.get(sample).add(file);
}

if (hits.length === 0) {
  console.log('✓ 未发现主题示例数据泄漏');
} else {
  console.log(`\n✗ 发现 ${bySample.size} 类示例数据泄漏：`);
  for (const [sample, files] of bySample) {
    const list = [...files];
    console.log(`  「${sample}」 出现在 ${list.length} 个文件，例如 ${list.slice(0, 3).join(', ')}`);
  }
}

process.exit(hits.length ? 1 : 0);
