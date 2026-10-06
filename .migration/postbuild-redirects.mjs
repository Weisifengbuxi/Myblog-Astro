#!/usr/bin/env node
/**
 * Post-build: flatten legacy `.html` redirect stubs.
 *
 * Astro's static adapter writes every redirect as `<dest>/index.html`. For the
 * Hexo-era permalink `/posts/<abbrlink>.html` the real request path is the file
 * itself, so `<dest>/index.html` would 404 on plain static hosts (nginx, GitHub
 * Pages, EdgeOne). Here we move it to `<dest>` verbatim and drop the now-empty
 * directory.
 *
 * Also removes the redirect stubs from the generated sitemap: they are 301s,
 * so listing them invites duplicate-content indexing.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const MANIFEST = path.resolve('.migration', 'manifest.json');

if (!fs.existsSync(MANIFEST)) {
  console.log('[postbuild] no migration manifest, nothing to flatten');
  process.exit(0);
}
const { posts = [] } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const htmlRedirects = posts.flatMap((p) => (p.oldUrls ?? []).filter((u) => u.endsWith('.html')));

let moved = 0;
for (const url of htmlRedirects) {
  // url is already e.g. "/posts/e4925c7a.html"; Astro emitted the stub at
  // "dist/posts/e4925c7a.html/index.html". Move that file to "dist" + url.
  //
  // On Windows a plain rename() fails with EPERM because the destination name
  // is still the name of the directory holding the source, so fall back to
  // read -> remove directory -> write.
  const dir = path.join(DIST, url.replace(/^\//, ''));
  const indexFile = path.join(dir, 'index.html');
  const target = path.join(DIST, url.replace(/^\//, ''));
  if (!fs.existsSync(indexFile)) continue;
  try {
    fs.renameSync(indexFile, target);
    fs.rmdirSync(dir);
  } catch {
    const html = fs.readFileSync(indexFile, 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.writeFileSync(target, html, 'utf8');
  }
  moved++;
}
console.log(`[postbuild] flattened ${moved}/${htmlRedirects.length} .html redirect stubs`);

// ---- strip redirect stubs from the sitemap ---------------------------------
// Redirects are 301s/noindex stubs and must not be indexed. Derive the origin
// from config/site.yaml so this keeps working if the domain changes.
const yaml = (await import('yaml')).default;
const siteUrl = new URL(
  yaml.parse(fs.readFileSync(path.resolve('config/site.yaml'), 'utf8')).site.url
).origin;

const stubPaths = new Set(
  posts.flatMap((p) => (p.oldUrls ?? []).map((u) => `${siteUrl}${u}`))
);
const sitemaps = fs.readdirSync(DIST).filter((f) => /^sitemap.*\.xml$/.test(f));
let stripped = 0;
for (const name of sitemaps) {
  const file = path.join(DIST, name);
  const xml = fs.readFileSync(file, 'utf8');
  const out = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
    const loc = /<loc>(.*?)<\/loc>/.exec(block)?.[1];
    if (loc && stubPaths.has(loc)) {
      stripped++;
      return '';
    }
    return block;
  });
  if (out !== xml) {
    // A sitemap index intentionally has no <url> entries, so only write real changes.
    fs.writeFileSync(file, out.replace(/\n{2,}/g, '\n'), 'utf8');
  }
}
console.log(`[postbuild] removed ${stripped} redirect URLs from sitemap`);
