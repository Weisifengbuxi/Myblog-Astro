#!/usr/bin/env node
/**
 * 分类配置自检。
 *
 * 背景：`config/site.yaml` 的 categoryMap 曾把 `工具` / `教程` / `福利` 都映射到
 * slug `tools`。主题用 `slugToName`（反向 Map）从 URL 反查分类名，重复 slug 会
 * 让先写的被覆盖 —— 反查 `tools` 得到「福利」，而分类树里只有「工具」，
 * 于是 /categories/tools 标题变空、文章列表也匹配不到。
 * v7.4.0 把分类页改为按名称精确解析后，这个潜在问题才暴露出来。
 *
 * 本脚本静态检查 categoryMap，并核对构建产物里的分类页确实有标题与文章：
 *   1. 没有两个分类名映射到同一个 slug
 *   2. 构建出的 /categories/<slug> 页面不是空壳
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

const ROOT = 'D:\\myBlog-astro';
const config = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'site.yaml'), 'utf8'));
const categoryMap = config.categoryMap ?? {};

const failures = [];

// ---- 1. slug 唯一性 --------------------------------------------------------
const bySlug = new Map();
for (const [name, slug] of Object.entries(categoryMap)) {
  if (!bySlug.has(slug)) bySlug.set(slug, []);
  bySlug.get(slug).push(name);
}
const duplicates = [...bySlug.entries()].filter(([, names]) => names.length > 1);
if (duplicates.length) {
  for (const [slug, names] of duplicates) {
    failures.push(`slug "${slug}" 被多个分类名共用: ${names.join(' / ')} → 反查结果不确定`);
  }
  console.log(`✗ categoryMap 有 ${duplicates.length} 个重复 slug`);
} else {
  console.log(`✓ categoryMap 的 ${bySlug.size} 个 slug 全部唯一`);
}

// ---- 2. 用真实文章里出现的分类名核对 ---------------------------------------
const BLOG = path.join(ROOT, 'src', 'content', 'blog');
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

const usedNames = new Set();
for (const file of walk(BLOG)) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (!fm) continue;
  const parsed = yaml.parse(fm);
  const cats = parsed?.categories;
  if (!Array.isArray(cats)) continue;
  for (const chain of cats) {
    for (const name of Array.isArray(chain) ? chain : [chain]) usedNames.add(String(name));
  }
}

const unmapped = [...usedNames].filter((n) => !(n in categoryMap));
if (unmapped.length) {
  failures.push(`文章里用到但 categoryMap 未定义的分类名: ${unmapped.join(', ')} → URL 段会变成 undefined`);
  console.log(`✗ ${unmapped.length} 个分类名未在 categoryMap 中定义`);
} else {
  console.log(`✓ 文章用到的 ${usedNames.size} 个分类名都已映射`);
}

const unused = Object.keys(categoryMap).filter(
  (n) => !usedNames.has(n) && !Object.values(categoryMap).some((s) => s.includes('/') && s.split('/').includes(categoryMap[n]))
);
if (unused.length) {
  console.log(`  ℹ 未被子分类引用的顶层配置项（不影响，仅提示）: ${unused.join(', ')}`);
}

// ---- 3. 构建产物里的分类页不能是空壳 ---------------------------------------
const distCat = path.join(ROOT, 'dist', 'categories');
if (fs.existsSync(distCat)) {
  const pages = fs
    .readdirSync(distCat, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  let empty = 0;
  for (const page of pages) {
    const file = path.join(distCat, page, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? '';
    // 分类名解析失败时标题会退化为「分类下的文章」（前面没有分类名）
    if (/^分类下的文章/.test(title.replace(/^\s+/, ''))) {
      failures.push(`/categories/${page} 标题缺少分类名（反查失败）: "${title}"`);
      empty++;
    }
  }
  console.log(empty ? `✗ ${empty}/${pages.length} 个分类页标题异常` : `✓ ${pages.length} 个分类页标题均含分类名`);
} else {
  console.log('  ℹ 未找到 dist/categories（跳过构建产物检查）');
}

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\n分类配置检查通过。');
