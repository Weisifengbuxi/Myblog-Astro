#!/usr/bin/env node
/**
 * 抓取「友链」各站的 RSS，生成 `public/fcircle/all.json`（友链朋友圈数据）。
 *
 * 为什么自己写而不是直接用 Friend-Circle-Lite 的上游 Action：
 *   1. 输出格式由我们掌控，Astro 页面读的就是这份 JSON，不受上游字段变动影响；
 *   2. 零依赖 —— 只用 Node 内置能力，不需要在仓库里加 XML 解析库；
 *   3. 已实测过每个友链的真实 feed 路径（见 FEED_PATHS 的探测顺序）。
 *
 * 用法：
 *   node .migration/fetch-fcircle.mjs            # 正常抓取
 *   node .migration/fetch-fcircle.mjs --dry      # 只打印统计，不写文件
 *
 * 输入：`config/fcircle-friends.json`
 *   { "friends": [ ["站点名称", "https://站点/", "https://头像"], ... ] }
 *   —— 与原 Hexo 博客 source/friend.json 完全同格式，可直接复用。
 *
 * 输出：`public/fcircle/all.json`，**兼容 Friend-Circle-Lite 的 schema**（已按其真实
 * 实例核对过字段），因此这份产物也能直接喂给别的 fcircle 前端：
 *
 *   {
 *     "statistical_data": {
 *       "friends_num": 17, "active_num": 15, "error_num": 2,
 *       "article_num": 260, "last_updated_time": "2026-10-08 14:22:43"
 *     },
 *     "article_data": [
 *       { "title": "…", "created": "2026-10-08 11:23",
 *         "link": "https://…", "author": "站点名",
 *         "avatar": "https://…" }, …
 *     ]
 *   }
 *
 * 注意 FCLite 的 `article_data` 元素**恰好 5 个键**（title/created/link/author/avatar），
 * 没有 `content`、没有 `site` —— 这点是照真实实例核对的，别自作主张多加字段。
 * `created` 为 `"YYYY-MM-DD HH:MM"`（只到分钟）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRIENDS_FILE = path.join(ROOT, 'config', 'fcircle-friends.json');
const OUT_DIR = path.join(ROOT, 'public', 'fcircle');
const OUT_FILE = path.join(OUT_DIR, 'all.json');
const DRY = process.argv.includes('--dry');

/** 常见的 feed 路径，按命中率排序（实测多数站点在第 2~3 个命中）。 */
const FEED_PATHS = ['/atom.xml', '/rss.xml', '/feed', '/index.xml', '/feed.xml', '/rss/', '/feed/atom'];

const MAX_ITEMS_PER_SITE = 20; // 每站最多收录多少篇，避免个别高产站点刷屏
const MAX_TOTAL = 500; // 总量上限，防止 all.json 过大拖慢构建
const REQUEST_TIMEOUT_MS = 15000;

const USER_AGENT = 'Mozilla/5.0 (compatible; fcircle-aggregator/1.0)';

// ---------------------------------------------------------------------------
// XML helpers（零依赖的最小可用实现）
// ---------------------------------------------------------------------------

const decode = (s) =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

const tag = (xml, ...names) => {
  for (const n of names) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i').exec(xml);
    if (m) {
      const v = decode(m[1]).trim();
      if (v) return v;
    }
  }
  return '';
};

/**
 * Atom puts the author inside `<author><name>…</name></author>`; RSS puts it in
 * `<dc:creator>`. Several feeds ship an empty `<author/>`, in which case the
 * caller falls back to the site name from the friend list.
 */
const authorName = (body) => {
  const a = /<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/i.exec(body);
  if (a) {
    const n = tag(a[1], 'name');
    if (n) return n;
  }
  return tag(body, 'dc:creator', 'creator');
};

/** 解析 RSS 2.0 / Atom 条目。字段名在两种格式间差异较大，这里统一归一。 */
function parseFeed(xml) {
  const isAtom = /<entry[\s>]/i.test(xml);
  return xml
    .split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)
    .slice(1)
    .map((body) => {
      const link = isAtom
        ? /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)/i.exec(body)?.[1] ||
          /<link\b[^>]*\bhref=["']([^"']+)/i.exec(body)?.[1] ||
          tag(body, 'link')
        : tag(body, 'link') || /<link\b[^>]*\bhref=["']([^"']+)/i.exec(body)?.[1];

      return {
        title: tag(body, 'title'),
        link: (link || '').trim(),
        created: tag(body, 'published', 'pubDate', 'updated', 'dc:date'),
        author: authorName(body),
      };
    })
    .filter((i) => i.title && /^https?:\/\//i.test(i.link));
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 依次尝试常见路径，返回第一个看起来像 feed 的响应。 */
async function discoverFeed(origin) {
  for (const p of FEED_PATHS) {
    const xml = await getText(origin + p);
    if (xml && /<rss|<feed|<rdf:RDF/i.test(xml.slice(0, 600))) return xml;
  }
  // 兜底：读首页里的 <link rel="alternate" type="application/rss+xml">
  const home = await getText(origin + '/');
  if (home) {
    const m = /<link\b[^>]*type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i.exec(home);
    const href = m && /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (href) {
      const abs = new URL(href, origin + '/').href;
      const xml = await getText(abs);
      if (xml && /<rss|<feed|<rdf:RDF/i.test(xml.slice(0, 600))) return xml;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readFriends() {
  if (!fs.existsSync(FRIENDS_FILE)) {
    console.error(`找不到友链清单：${FRIENDS_FILE}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.friends;
  if (!Array.isArray(list)) {
    console.error('friend 清单格式应为 { "friends": [[名称, 站点, 头像], ...] }');
    process.exit(1);
  }
  return list
    .map((entry) => {
      const [name, site, avatar] = Array.isArray(entry) ? entry : [];
      if (!name || !site) return null;
      try {
        return { name: String(name), site: String(site), avatar: avatar ? String(avatar) : undefined, origin: new URL(String(site)).origin };
      } catch {
        console.warn(`  跳过（URL 非法）: ${name} ${site}`);
        return null;
      }
    })
    .filter(Boolean);
}

const friends = readFriends();
console.log(`友链 ${friends.length} 个，开始抓取…\n`);

const data = [];
let okCount = 0;
let errorCount = 0;

for (const friend of friends) {
  const xml = await discoverFeed(friend.origin);
  if (!xml) {
    console.log(`  ✗ ${friend.name.padEnd(20)} 未找到可用 feed`);
    errorCount++;
    continue;
  }

  const items = parseFeed(xml).slice(0, MAX_ITEMS_PER_SITE);
  if (!items.length) {
    console.log(`  ✗ ${friend.name.padEnd(20)} feed 里没有条目`);
    errorCount++;
    continue;
  }

  okCount++;
  console.log(`  ✓ ${friend.name.padEnd(20)} ${String(items.length).padStart(2)} 条`);

  for (const it of items) {
    data.push({
      title: it.title,
      created: it.created || undefined,
      link: it.link,
      // 很多 feed 不带作者，用友链清单里的站点名兜底
      author: it.author || friend.name,
      avatar: friend.avatar || '',
    });
  }
}

// 按时间倒序；解析不出时间的排在最后
const timeOf = (s) => {
  const t = Date.parse(s || '');
  return Number.isFinite(t) ? t : 0;
};
data.sort((a, b) => timeOf(b.created) - timeOf(a.created));

/** FCLite 的 `created` 是 `"YYYY-MM-DD HH:MM"`（本地时间，只到分钟）。 */
const toFcliteTime = (raw) => {
  const d = new Date(raw || '');
  if (!Number.isFinite(d.getTime())) return '2024-01-01 00:00';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const now = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const payload = {
  statistical_data: {
    friends_num: friends.length,
    active_num: okCount,
    error_num: errorCount,
    article_num: Math.min(data.length, MAX_TOTAL),
    last_updated_time: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`,
  },
  // 只保留 FCLite 规定的 5 个键，顺序也照它来
  article_data: data.slice(0, MAX_TOTAL).map((a) => ({
    title: a.title,
    created: toFcliteTime(a.created),
    link: a.link,
    author: a.author,
    avatar: a.avatar,
  })),
};

console.log(
  `\n成功 ${okCount}/${friends.length} 个友链，失败 ${errorCount}，共 ${payload.article_data.length} 篇文章`,
);

if (DRY) {
  console.log('(--dry 模式，未写入文件)');
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`已写入 ${path.relative(ROOT, OUT_FILE)}`);
}

// 一个都没抓到时以非零退出，让 CI 显式失败而不是静默提交空数据
if (okCount === 0) {
  console.error('\n所有友链都抓取失败，请检查网络或 friend 清单。');
  process.exit(1);
}
