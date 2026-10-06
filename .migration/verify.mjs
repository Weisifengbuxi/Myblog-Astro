#!/usr/bin/env node
/**
 * Verification harness: fetches key routes from a running server and asserts
 * that migrated content, converted syntax and legacy redirects all render.
 *
 * Run against `pnpm preview --port 4322`:
 *   node .migration/verify.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:4322';

const checks = [
  { path: '/', contains: ['未似风不息', '学习技术 分享生活', '科目二', '海洋保育', 'avatar.jpg'] },
  { path: '/', notContains: ['{%', ';;;'] },
  { path: '/about', contains: ['关于本人', '北师香港浸会大学', '雅思', '另类的朋友圈', '可以让我'] },
  { path: '/friends', contains: ['友情链接', '张洪Heo', '杜老师说'] },
  { path: '/archives', contains: ['归档'] },
  { path: '/categories/note', contains: ['学习笔记'] },
  { path: '/categories/note/code', contains: ['代码学习', '递归与链表'] },
  { path: '/categories/note/theory', contains: ['理论学习', '逻辑门'] },
  { path: '/categories/life', contains: ['生活日常', '海洋保育'] },
  { path: '/categories/tools', contains: ['工具'] },
  // Converted containers must render as real markup, never raw syntax.
  {
    path: '/post/627a00f2',
    contains: ['note-block', 'tab1', 'katex'],
    notContains: ['{%', ';;;', '<!-- tab'],
  },
  {
    path: '/post/3be0a65',
    contains: ['java', '递归'],
    notContains: ['{%', ';;;', '```JAVA'],
  },
  { path: '/rss.xml', contains: ['未似风不息'] },
  { path: '/sitemap-index.xml', contains: ['sitemap'] },
  { path: '/robots.txt', contains: ['Sitemap'] },

  // ---- migrated utility / info pages (see also verify-pages.mjs) -------------
  { path: '/cookies', contains: ['Cookies政策', '什么是 Cookies'] },
  { path: '/privacy', contains: ['隐私政策', 'userAgentIp'] },
  { path: '/copyright', contains: ['版权协议说明', '禁止演绎'] },
  { path: '/wechat', contains: ['公众号'] },
  { path: '/link', contains: ['friendlink-gate', 'checkbox1'] },
  { path: '/messages', contains: ['comments-page'] },
  { path: '/album', contains: ['世界各地风景', '游戏荣誉'] },
  { path: '/wordScenery', contains: ['湘潭的一角'] },
  { path: '/dailyPhoto', contains: ['老妹的画'] },
  { path: '/gamePhotos', contains: ['赛季最后一天圆了荣耀梦'] },
  { path: '/equipment', contains: ['Legion Y7000P'] },
  { path: '/essay', contains: ['咸鱼的日常生活'] },
  { path: '/charts', contains: ['文章总数', '文章发布统计'] },
  { path: '/air-conditioner', contains: ['data-ac'] },

  // ---- background effects ----------------------------------------------------
  // Meteor/starfield canvas must be mounted on every page.
  { path: '/', contains: ['universe-canvas', 'data-density=', 'data-only-dark='] },
  // Sakura on the cover is disabled (motion.heroPetals: false); the petal-burst
  // click effect is a separate feature and stays enabled.
  { path: '/', notContains: ['cover-petals'] },
  { path: '/post/3be0a65', contains: ['universe-canvas'] },

  // ---- homepage cover intro text ---------------------------------------------
  // 首页头图的开场文字（站名 + 副标题）带淡出动画类，且只在首页渲染。
  // 其它页面传了 title 走另一分支，不应出现该类。
  { path: '/', contains: ['cover-intro-fade'] },
  { path: '/archives', notContains: ['cover-intro-fade'] },
  { path: '/about', notContains: ['cover-intro-fade'] },

  // ---- footer filings --------------------------------------------------------
  // 备案信息必须出现在页脚（迁移自原 Hexo 博客 footer.linkList）
  {
    path: '/',
    contains: [
      '晋ICP备-2025067606号',
      'https://beian.miit.gov.cn/',
      '晋公网安备14010502990310号',
      'https://beian.mps.gov.cn/#/',
      '萌ICP备20250740号',
      'icp.gov.moe',
    ],
  },
  // 备案在每一页都要有，不只在首页
  {
    path: '/post/3be0a65',
    contains: ['晋ICP备-2025067606号', '晋公网安备14010502990310号', '萌ICP备20250740号'],
  },
];

// Draft posts are excluded from production builds, so they have no live route.
const manifest = JSON.parse(
  await (await import('node:fs/promises')).readFile(new URL('./manifest.json', import.meta.url), 'utf8')
);
const posts = manifest.posts ?? [];
const livePosts = posts.filter((p) => p.draft !== true);
const draftPosts = posts.filter((p) => p.draft === true);

for (const post of livePosts) {
  checks.push({ path: post.newUrl, contains: [] });
}

let pass = 0;
const failures = [];

for (const check of checks) {
  let body;
  try {
    const res = await fetch(BASE + check.path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.text();
  } catch (err) {
    failures.push(`${check.path} — fetch failed: ${err.message}`);
    continue;
  }
  for (const needle of check.contains ?? []) {
    if (!body.includes(needle)) failures.push(`${check.path} — missing: ${needle}`);
  }
  for (const needle of check.notContains ?? []) {
    if (body.includes(needle)) failures.push(`${check.path} — unexpected: ${needle}`);
  }
  pass++;
}

// Legacy permalinks must redirect to the new canonical URL. Draft posts have no
// live page, so their old URLs redirect to the home page instead.
let redirectOk = 0;
const redirectTotal = posts.length * 2;
for (const post of posts) {
  const expected = post.draft === true ? '/' : post.newUrl;
  for (const oldUrl of post.oldUrls ?? []) {
    const res = await fetch(BASE + oldUrl, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    const html = res.status === 200 ? await res.text() : '';
    const ok =
      (res.status >= 300 && res.status < 400 && loc.includes(expected)) ||
      (res.status === 200 && html.includes(`url=${expected}`) && html.includes('noindex'));
    if (ok) redirectOk++;
    else failures.push(`${oldUrl} — redirect to ${expected} not found (status ${res.status})`);
  }
}

console.log(`routes checked : ${pass}/${checks.length}`);
console.log(`redirects ok   : ${redirectOk}/${redirectTotal}`);
console.log(`draft posts    : ${draftPosts.length} (${draftPosts.map((p) => p.slug).join(', ') || 'none'}) → homepage`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll checks passed.');
