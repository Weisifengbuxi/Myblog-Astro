#!/usr/bin/env node
/**
 * 用真实浏览器截图，肉眼确认纪念日变灰的效果范围。
 *
 * 前提：把 --port 传入的地址已由 pnpm preview 提供，且 config/site.yaml 的
 * mourn.days 临时包含今天（否则不会触发）。
 *
 * 做法：用系统已安装的 Chrome（channel: 'chrome'），避免下载 Playwright 浏览器。
 * 读两张图：一张是触发 mourn 的，一张是正常状态；对比封面与正文区域的像素饱和度。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4322';
const OUT = 'D:\\myBlog-astro\\.migration\\_shots';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });

// 读取实际生效的样式，而不是只看 DOM
const state = await page.evaluate(() => {
  const root = document.documentElement;
  const cover = document.querySelector('.cover-hero');
  return {
    classes: [...root.classList],
    dataMourn: root.dataset.mourn ?? null,
    htmlFilter: getComputedStyle(root).filter,
    coverFilter: cover ? getComputedStyle(cover).filter : null,
  };
});

console.log('html 类名      :', state.classes.join(' ') || '(空)');
console.log('data-mourn     :', state.dataMourn);
console.log('html 计算 filter:', state.htmlFilter);
console.log('封面计算 filter :', state.coverFilter);

await page.screenshot({ path: path.join(OUT, 'home-mourn.png'), fullPage: false });

// 再看一篇文章页，确认整页模式对所有页面生效
await page.goto(`${BASE}/post/3be0a65`, { waitUntil: 'networkidle', timeout: 60_000 });
const postState = await page.evaluate(() => ({
  dataMourn: document.documentElement.dataset.mourn ?? null,
  htmlFilter: getComputedStyle(document.documentElement).filter,
}));
console.log('\n文章页 data-mourn:', postState.dataMourn, '| filter:', postState.htmlFilter);
await page.screenshot({ path: path.join(OUT, 'post-mourn.png'), fullPage: false });

await browser.close();
console.log(`\n截图已保存到 ${OUT}`);
