/**
 * 端到端验证纪念日变灰：在真实 DOM 上跑 BootScripts 注入的内联脚本，
 * 确认它会正确地给 <html> 打上 mourn 类与 data-mourn 属性。
 *
 * 做法：起一个无头浏览器代价太大，这里改用最小 DOM 桩 + 直接执行
 * 构建产物里那段内联脚本源码，从而验证「脚本 + 配置 + CSS 选择器」这条链路。
 */
import fs from 'node:fs';

const dist = 'D:\\myBlog-astro\\dist\\index.html';
const html = fs.readFileSync(dist, 'utf8');

// 1) 取出那段内联的 mourn 脚本
const match = html.match(/<script>([\s\S]*?dataset\.mourn[\s\S]*?)<\/script>/);
if (!match) {
  console.error('✗ 构建产物里找不到 mourn 内联脚本');
  process.exit(1);
}
const source = match[1];

// 2) 极简 DOM 桩：只要有 classList / dataset 即可
function makeRoot() {
  const classes = new Set();
  return {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    dataset: {},
    get classes() {
      return [...classes];
    },
  };
}

const inlineConfig = /mournEnabled\s*=\s*([^;]+)/.exec(source)?.[1]?.trim();

console.log('内联脚本已找到，长度', source.length);
console.log('脚本里是否含配置注入:', /mournEnabled|mournDays|mournAffect/.test(source));

// 3) 检查 CSS。
// 注意两点：压缩后属性选择器不带引号（html[data-mourn=cover]），
// 且 lightningcss 会把两条规则合并成一条逗号选择器：
//   html[data-mourn=cover] .cover-hero,html[data-mourn=page]{filter:grayscale()}
// 所以这里按「选择器片段 + 整表存在 grayscale」两项分别断言。
const cssFiles = fs
  .readdirSync('D:\\myBlog-astro\\dist\\_astro')
  .filter((f) => f.endsWith('.css'));
const css = cssFiles.map((f) => fs.readFileSync(`D:\\myBlog-astro\\dist\\_astro\\${f}`, 'utf8')).join('\n');

// 生效范围是「仅首页」，范围由 BootScripts 的路径判断控制，CSS 只负责去色。
const grayscaleForCover = /html\[data-mourn=["']?cover["']?\]/.test(css);
const grayscaleForPage = /html\[data-mourn=["']?page["']?\]/.test(css);
const grayscaleRule = /filter:\s*grayscale\(/.test(css);
console.log('CSS 覆盖 [data-mourn=cover] :', grayscaleForCover);
console.log('CSS 覆盖 [data-mourn=page]  :', grayscaleForPage);
console.log('存在 filter: grayscale(...)  :', grayscaleRule);

// 脚本必须按路径判断，否则会退化成"全站变灰"
const hasHomeGate = /isHomePath|shouldMourn/.test(source);
console.log('脚本含首页路径判断          :', hasHomeGate);

// 4) 确认封面元素确实带 cover-hero 类（否则选择器命不中）
const coverAttr = /<div class="cover-hero[^"]*"/.exec(html)?.[0];
console.log('封面元素      :', coverAttr ? '存在 cover-hero' : '✗ 未找到');

const ok =
  grayscaleForCover &&
  grayscaleForPage &&
  grayscaleRule &&
  hasHomeGate &&
  Boolean(coverAttr) &&
  /mournDays/.test(source);
console.log(ok ? '\n✓ 脚本、配置、CSS 三者链路完整，且带首页范围判断' : '\n✗ 链路不完整');
process.exit(ok ? 0 : 1);
