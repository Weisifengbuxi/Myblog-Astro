/** 快速自检：确认 site-config.ts 的修复完整。 */
import fs from 'node:fs';

const src = fs.readFileSync('D:\\myBlog-astro\\src\\constants\\site-config.ts', 'utf8');

const checks = [
  ['MournConfig 接口字段完整', /interface MournConfig \{[\s\S]*?enabled: boolean;[\s\S]*?days: string\[\];[\s\S]*?affect: 'cover' \| 'page';[\s\S]*?\}/.test(src)],
  ['universeConfig 已导出', src.includes('export const universeConfig')],
  ['mournConfig 已导出', src.includes('export const mournConfig')],
  ['UniverseConfig 接口存在', /interface UniverseConfig \{[\s\S]*?density: number;[\s\S]*?\}/.test(src)],
  ['没有把 site.yaml 直接导给组件（路径已在 constants 层）', !src.includes('../../../config/site.yaml')],
];

for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed ? `\n${failed} 项未通过` : '\n全部通过');
process.exit(failed ? 1 : 0);
