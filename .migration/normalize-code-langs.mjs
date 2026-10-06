#!/usr/bin/env node
/**
 * Normalises fenced-code language identifiers to lowercase.
 *
 * Hexo/anzhiyu tolerated ```JAVA; Shiki is case-sensitive and logs
 * `The language "JAVA" doesn't exist, falling back to "plaintext"` while also
 * losing syntax highlighting. Only the info string's first token is touched, and
 * only when lowercasing it yields a language Shiki actually bundles.
 */
import fs from 'node:fs';
import path from 'node:path';

const BLOG = 'D:\\myBlog-astro\\src\\content\\blog';

// Languages used across the migrated posts (lowercased -> canonical Shiki id).
const ALIASES = {
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  python: 'python',
  py: 'python',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  cmd: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  sql: 'sql',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  kotlin: 'kotlin',
  swift: 'swift',
  ini: 'ini',
  toml: 'toml',
  diff: 'diff',
  text: 'text',
  plaintext: 'text',
  markdown: 'markdown',
  md: 'markdown',
  latex: 'latex',
  tex: 'latex',
  mermaid: 'mermaid',
  vhdl: 'vhdl',
  verilog: 'verilog',
  asm: 'asm',
  makefile: 'makefile',
  dockerfile: 'dockerfile',
  nginx: 'nginx',
  graphql: 'graphql',
  r: 'r',
  matlab: 'matlab',
  vba: 'vba',
  jsx: 'jsx',
  tsx: 'tsx',
  vue: 'vue',
  svelte: 'svelte',
  scss: 'scss',
  less: 'less',
  pug: 'pug',
  jade: 'pug',
  styl: 'stylus',
  stylus: 'stylus',
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

const changed = [];
for (const file of walk(BLOG)) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/^([ \t]*)(`{3,}|~{3,})([^\n`]*)$/gm, (m, indent, fence, info) => {
    if (!info.trim()) return m;
    // Split the info string into language + the rest (e.g. title="...").
    const match = /^(\s*)([^\s{]+)([\s\S]*)$/.exec(info);
    if (!match) return m;
    const [, lead, lang, rest] = match;
    const lower = lang.toLowerCase();
    const canonical = ALIASES[lower];
    if (!canonical || canonical === lang) return m;
    return `${indent}${fence}${lead}${canonical}${rest}`;
  });
  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    changed.push(path.relative(BLOG, file));
  }
}

console.log(`normalised code fences in ${changed.length} file(s):`);
console.log(changed.map((c) => '  ' + c).join('\n'));
