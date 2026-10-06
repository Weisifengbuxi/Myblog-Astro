#!/usr/bin/env node
/**
 * Hexo (anzhiyu) -> astro-koharu content migration.
 *
 * - reads D:\代码\myBlog-hexo\source\_posts\*.md
 * - rewrites frontmatter into the astro-koharu blog schema
 * - writes src/content/blog/<category-slug>/<filename>.md
 * - records abbrlink -> slug pairs so redirect stubs can be generated
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const HEXO = 'D:\\代码\\myBlog-hexo';
const POSTS_DIR = path.join(HEXO, 'source', '_posts');
const TARGET = 'D:\\myBlog-astro\\src\\content\\blog';
const MANIFEST = 'D:\\myBlog-astro\\.migration\\manifest.json';

/**
 * Source of truth for categories: Chinese category name -> full Chinese path.
 * astro-koharu's `categories` frontmatter is a list of name chains, e.g.
 * `[['学习笔记', '代码学习']]`, and each name must be a key of `categoryMap` in
 * config/site.yaml (otherwise `getCategoryLinks` produces an undefined URL
 * segment and the category page is never generated).
 */
const CATEGORY_PATHS = {
  学习笔记: ['学习笔记'],
  代码学习: ['学习笔记', '代码学习'],
  理论学习: ['学习笔记', '理论学习'],
  排序: ['学习笔记', '排序'],
  比赛: ['学习笔记', '比赛'],
  美化: ['学习笔记', '美化'],
  数学建模: ['学习笔记', '数学建模'],
  生活日常: ['生活日常'],
  生活: ['生活日常'],
  工具: ['工具'],
  教程: ['工具'],
  福利: ['工具'],
};

/**
 * Chinese category -> URL segment. Values must be a SINGLE path segment and must
 * match `categoryMap` in config/site.yaml. The parent prefix is added by
 * astro-koharu from the frontmatter name chain, e.g. [[学习笔记, 代码学习]]
 * -> /categories/note/code.
 */
const CATEGORY_MAP = {
  学习笔记: 'note',
  代码学习: 'code',
  理论学习: 'theory',
  排序: 'algorithm',
  比赛: 'contest',
  美化: 'beautify',
  数学建模: 'modeling',
  生活日常: 'life',
  生活: 'life',
  工具: 'tools',
  教程: 'tools',
  福利: 'tools',
};

/**
 * Every Chinese name that appears in a post's `categories` must exist as a key
 * of `categoryMap` in config/site.yaml AND of CATEGORY_MAP here, otherwise
 * `getCategoryLinks` emits an undefined URL segment and the category page 404s.
 */
const assertCategoryMapComplete = () => {
  const missing = new Set();
  for (const path of Object.values(CATEGORY_PATHS)) {
    for (const name of path) if (!CATEGORY_MAP[name]) missing.add(name);
  }
  if (missing.size) throw new Error(`CATEGORY_MAP is missing: ${[...missing].join(', ')}`);
};
assertCategoryMapComplete();

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

const iso = (v) => {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
const manifest = [];
const warnings = [];
const used = new Set();

for (const file of files) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  const { data: fm, content } = matter(raw);

  // --- categories -------------------------------------------------------------
  // astro-koharu expects either `categories: [Name]` or, for nesting, an array of
  // name arrays: `categories: [[Parent, Child]]`. Slash-joined strings such as
  // 'note/code' are NOT supported — `getCategoryLinks` maps each name through
  // categoryMap individually, so a slash string yields an undefined URL segment
  // and the category page is never generated.
  const rawCategories = asArray(fm.categories).map((c) => (Array.isArray(c) ? c.map(String) : [String(c)]));
  const categories = [];
  const unmapped = [];
  for (const chain of rawCategories) {
    // Resolve the first (only) Chinese name in the chain to its full Chinese path.
    const head = chain[0];
    const path = CATEGORY_PATHS[head];
    if (path) {
      categories.push([...path]);
    } else {
      categories.push(chain);
      unmapped.push(`${file}: unmapped category "${head}"`);
    }
  }
  warnings.push(...unmapped);

  const tags = asArray(fm.tags).map(String);
  const cover = typeof fm.cover === 'string' ? fm.cover : typeof fm.top_img === 'string' ? fm.top_img : undefined;
  const abbrlink = fm.abbrlink ? String(fm.abbrlink) : undefined;
  const slug = abbrlink ?? path.basename(file, '.md');
  if (used.has(slug)) warnings.push(`${file}: duplicate slug "${slug}"`);
  used.add(slug);

  const description =
    typeof fm.description === 'string' && fm.description.trim()
      ? fm.description.trim()
      : content
          .replace(/^---[\s\S]*?---/, '')
          .replace(/```[\s\S]*?```/g, ' ')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[#>*`_~\-]|{%[^%]*%}|:::[^\n]*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 150);

  const out = {
    title: fm.title ?? path.basename(file, '.md'),
    link: slug,
    date: iso(fm.date) ?? '2025-01-01T00:00:00.000Z',
    ...(iso(fm.updated) ? { updated: iso(fm.updated) } : {}),
    description,
    ...(categories.length ? { categories } : {}),
    ...(tags.length ? { tags } : {}),
    ...(cover ? { cover } : {}),
  };
  if (fm.math || fm.mathjax || fm.katex) out.math = true;
  if (fm.hidden === true) out.draft = true;
  if (fm.sticky === true || fm.top === true) out.sticky = true;
  if (fm.toc === false || fm.tocNumbering === false) out.tocNumbering = false;

  // Directory inside src/content/blog is organisational only; the URL comes from
  // `link`. Group under the top-level category's own directory name.
  const dirSlug = categories.length ? (CATEGORY_MAP[categories[0][0]] ?? 'note') : 'note';
  const outDir = path.join(TARGET, dirSlug);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, file);

  const body = matter.stringify(content.replace(/^\n+/, '\n'), out);
  fs.writeFileSync(outFile, body, 'utf8');

  const oldPath = `/posts/${abbrlink ?? ''}`;
  manifest.push({
    source: file,
    slug,
    newUrl: `/post/${slug}`,
    // Hexo permalink: posts/:abbrlink.html
    oldUrls: abbrlink ? [`/posts/${abbrlink}.html`, `/posts/${abbrlink}`] : [],
    title: out.title,
    categories,
    tags,
    draft: out.draft ?? false,
  });
  console.log(`✓ ${file}\n    -> ${path.relative(TARGET, outFile)}  (${oldPath}.html => /post/${slug})`);
}

fs.writeFileSync(
  MANIFEST,
  JSON.stringify({ generatedAt: new Date().toISOString(), userPostsOnly: true, posts: manifest }, null, 2),
  'utf8'
);
console.log(`\n${files.length} posts migrated.`);
if (warnings.length) console.log('\nWARNINGS:\n' + warnings.map((w) => '  ! ' + w).join('\n'));
