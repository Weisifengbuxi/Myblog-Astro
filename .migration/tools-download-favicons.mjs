// 一次性工具：把工具站的 favicon 下载到 public/img/tools/，避免依赖第三方图标服务
// （favicon.im / google s2 / ddg 在部分网络环境不可达，实测全部失败）。
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'D:\\myBlog-astro\\public\\img\\tools';
fs.mkdirSync(OUT, { recursive: true });

/** [输出文件名, 候选地址（按顺序尝试）] */
const targets = [
  ['imgse.ico', ['https://imgse.com/favicon.ico', 'https://imgse.com/static/favicon.ico']],
  ['pdfpai.ico', ['https://www.pdfpai.com/statics/images/favicon.ico', 'https://www.pdfpai.com/favicon.ico']],
  ['itdog.ico', ['https://www.itdog.cn/favicon.ico']],
  ['drawio.ico', ['https://www.drawio.com/favicon.ico']],
  ['geogebra.ico', ['https://www.geogebra.org/favicon.ico']],
  ['panmoe.ico', ['https://pan.moe/static/img/favicon.ico', 'https://pan.moe/favicon.ico']],
  ['51la.ico', ['https://v6.51.la/favicon.ico']],
  ['github.svg', ['https://github.githubassets.com/favicons/favicon.svg']],
];

const results = [];
for (const [filename, candidates] of targets) {
  let saved = false;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // 过滤掉把 HTML 错误页当成图标返回的情况
      const head = buf.subarray(0, 5).toString('latin1');
      if (head.startsWith('<!DOCT') || head.startsWith('<html') || buf.length < 40) continue;
      fs.writeFileSync(path.join(OUT, filename), buf);
      results.push([filename, `${buf.length} bytes`, url]);
      saved = true;
      break;
    } catch {
      /* 试下一个候选 */
    }
  }
  if (!saved) results.push([filename, '❌ 全部失败', candidates.join(' , ')]);
}

for (const [f, size, src] of results) console.log(`  ${f.padEnd(14)} ${size.padEnd(12)} ${src}`);
