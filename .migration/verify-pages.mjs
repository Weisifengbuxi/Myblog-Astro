#!/usr/bin/env node
/**
 * Verifies the migrated custom pages render their data-driven content.
 * Run against `pnpm preview` (default http://localhost:4322).
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:4322';

const checks = [
  { path: '/cookies', contains: ['Cookies政策', '什么是 Cookies', 'busuanzi', '第三方 Cookies'] },
  { path: '/privacy', contains: ['隐私政策', '网络身份标识信息', 'userAgentIp', 'busuanzi'] },
  { path: '/copyright', contains: ['版权协议说明', '禁止演绎', '署名-非商业性使用-禁止演绎'] },
  { path: '/wechat', contains: ['公众号', '运营模式'] },

  // Album index -> cards for each category album
  { path: '/album', contains: ['世界各地风景', '我的日常', '游戏荣誉', '张照片'] },
  // Album detail -> records + photos + lightbox markup
  { path: '/wordScenery', contains: ['湘潭的一角', '湖南湘潭', '再吃一口就减肥', 'album-lightbox', '64329399db122.webp'] },
  { path: '/dailyPhoto', contains: ['老妹的画', '643293997b92b.jpeg'] },
  { path: '/gamePhotos', contains: ['辅助单排从星耀四连胜上王者', '赛季最后一天圆了荣耀梦', 'wzjt2.jpg'] },

  // Equipment
  { path: '/equipment', contains: ['生产力', 'Legion Y7000P', 'HUAWEI MatePad Pro', 'HUAWEI FreeBuds 5', 'pVDjcfP.jpg'] },

  // Essay timeline
  { path: '/essay', contains: ['咸鱼的日常生活', '终于上完雅思了', '过生日鸭', 'docs.anheyu.com', 'jiangzhuang111.jpg'] },

  // Charts: derived from real posts
  { path: '/charts', contains: ['文章总数', '标签总数', '分类总数', '文章发布统计', '学习笔记'] },

  // Air conditioner widget：基础结构 + 制冷/制热模式按钮
  // 注意：静音按钮已按需求移除（按键音常开），故不再断言 data-ac-sound，
  // 反而要确认它没有回来。
  {
    path: '/air-conditioner',
    contains: ['data-ac', '26 度是适宜温度', 'ac-controls', '开机', 'data-ac-modebtn', '切制热', 'aria-pressed', 'ac-panel'],
    notContains: ['data-ac-sound'],
  },

  // Footer strip on every page
  { path: '/', contains: ['页脚导航', '友链申请', '最新评论', '相册集', 'Cookies政策', '隐私政策', '版权协议'] },

  // Grouped footer: 4 titled columns (footerLinkGroups), rendered vertically.
  {
    path: '/',
    contains: ['footer-groups', 'footer-group-title', 'footer-group-links', '关于', '我的', '工具', '协议'],
  },

  // Header utility-tools button (ported from the original blog's .back-home-button).
  // Renders on every page with the toolsMenu config; lists the external tools.
  { path: '/', contains: ['tools-menu', 'tools-menu-btn', 'tools-menu-panel', '网页', '项目', '路过图床', 'ITDOG'] },
  { path: '/about', contains: ['tools-menu-btn'] },

  // Friend-link gate
  { path: '/link', contains: ['friendlink-gate', 'checkbox1', 'checkbox5', '免责声明', '本站添加的友链要求', 'friendlink-gate-open'] },

  // 友链朋友圈：数据在构建时读 public/fcircle/all.json 并渲染成静态列表，
  // 所以页面 HTML 里必须已经有真实条目（而不是运行时再请求后端）。
  { path: '/fcircle', contains: ['fcircle-list', 'fcircle-item', 'fcircle-stat', '共聚合'] },
  // 导航里应出现朋友圈入口
  { path: '/', contains: ['/fcircle'] },

  // Messages board (Twikoo unreachable -> graceful message, never a crash)
  { path: '/messages', contains: ['comments-page', 'GET_RECENT_COMMENTS', '最新评论'] },
];

const failures = [];
let passed = 0;

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
  for (const needle of check.contains) {
    if (!body.includes(needle)) failures.push(`${check.path} — missing: ${needle}`);
  }
  for (const needle of check.notContains ?? []) {
    if (body.includes(needle)) failures.push(`${check.path} — unexpected: ${needle}`);
  }
  passed++;
}

// Every footer link must resolve (no 404 in the strip).
const pages = [
  '/about', '/link', '/messages', '/album', '/dailyPhoto', '/wordScenery', '/gamePhotos',
  '/equipment', '/essay', '/charts', '/air-conditioner', '/cookies', '/privacy', '/copyright', '/wechat',
];
let footerOk = 0;
for (const p of pages) {
  const res = await fetch(BASE + p, { redirect: 'manual' });
  if (res.status === 200) footerOk++;
  else failures.push(`footer link ${p} — status ${res.status}`);
}

console.log(`pages checked      : ${passed}/${checks.length}`);
console.log(`footer links live  : ${footerOk}/${pages.length}`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll custom-page checks passed.');
