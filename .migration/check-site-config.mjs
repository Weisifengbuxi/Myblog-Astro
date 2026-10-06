/**
 * 站点配置自检。
 *
 * 覆盖两类曾经踩过的问题：
 *   1. site-config.ts 的结构完整性（曾因误编辑把 MournConfig 接口删空）
 *   2. `site.title` / `site.alternate` 的语义 —— 这两个字段很容易写反：
 *        title     应为「母语全名」（用于 RSS 标题、SEO、分享卡片）
 *        alternate 应为「英文短名」（用于页头 Logo 文字、页脚 @ handle）
 *      写反的后果不明显：RSS 标题会变成英文名，页头 logo 显示中文名。
 *      这类问题构建不会报错，只能靠断言兜住。
 */
import fs from 'node:fs';
import yaml from 'yaml';

const ROOT = 'D:\\myBlog-astro';
const src = fs.readFileSync(`${ROOT}\\src\\constants\\site-config.ts`, 'utf8');
const config = yaml.parse(fs.readFileSync(`${ROOT}\\config\\site.yaml`, 'utf8'));
const site = config.site ?? {};

const checks = [
  ['MournConfig 接口字段完整', /interface MournConfig \{[\s\S]*?enabled: boolean;[\s\S]*?days: string\[\];[\s\S]*?affect: 'cover' \| 'page';[\s\S]*?\}/.test(src)],
  ['universeConfig 已导出', src.includes('export const universeConfig')],
  ['mournConfig 已导出', src.includes('export const mournConfig')],
  ['UniverseConfig 接口存在', /interface UniverseConfig \{[\s\S]*?density: number;[\s\S]*?\}/.test(src)],
  ['没有把 site.yaml 直接导给组件（路径已在 constants 层）', !src.includes('../../../config/site.yaml')],

  // ---- site.title / alternate 语义 ----------------------------------------
  // title 是母语名，必然含中日韩字符；alternate 是英文名，应为纯 ASCII。
  // 这两条组合起来即可判定是否写反，无需再与 name 比较
  // （name 本来就是母语名，和 title/alternate 是否互换无关）。
  ['site.title 使用母语名称（含中文）', /[\u4e00-\u9fff]/.test(String(site.title ?? ''))],
  ['site.alternate 为 ASCII 短名', site.alternate === undefined || /^[\x20-\x7e]+$/.test(String(site.alternate))],
];

// ---- 构建产物断言：RSS 频道标题必须是母语 title ------------------------------
const rssPath = `${ROOT}\\dist\\rss.xml`;
if (fs.existsSync(rssPath)) {
  const rss = fs.readFileSync(rssPath, 'utf8');
  const channelTitle = /<channel><title>(.*?)<\/title>/.exec(rss)?.[1] ?? '';
  const expected = String(site.title ?? '');
  checks.push([
    `RSS 频道标题为 site.title（实际 "${channelTitle}"）`,
    channelTitle === expected,
  ]);
} else {
  console.log('  ℹ 未找到 dist/rss.xml（跳过 RSS 标题检查，先跑 pnpm build）');
}

for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed ? `\n${failed} 项未通过` : '\n全部通过');
process.exit(failed ? 1 : 0);
