import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { rehypeShokaAttrs } from './rehype-shoka-attrs';
import { remarkShokaPreprocess } from './remark-shoka-preprocess';

/** 含公式 + Shoka 属性语法的管线：复现列表项里行内公式被属性语法截断的老问题。 */
const createMathAttrsProcessor = () =>
  createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeShokaAttrs, rehypeKatex],
  });

const mediaBlock = `{% media audio %}
- name: 测试单曲
  songid: "127570280"
{% endmedia %}`;

test('the site markdown pipeline keeps the QQ Music outchain iframe intact', async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkShokaPreprocess, {}]],
  });
  const { code } = await processor.render(mediaBlock);
  assert.match(code, /class="qq-outchain-player"/);
  assert.match(code, /<iframe /);
  assert.match(code, /i\.y\.qq\.com\/n2\/m\/outchain\/player\/index\.html\?songid=127570280/);
  // The raw HTML must not be escaped into visible text.
  assert.doesNotMatch(code, /&lt;iframe/);
});

test('the site markdown pipeline attaches the configured Meting endpoint', async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkShokaPreprocess, { audioApiUrl: 'https://api.example.com/' }]],
  });
  const { code } = await processor.render(
    '{% media audio %}\n- title: 歌单\n  list:\n    - https://music.163.com/#/playlist?id=1\n{% endmedia %}',
  );
  assert.match(code, /data-api="https:\/\/api\.example\.com\/"/);
});

test('列表项里的行内公式不会被 Shoka 属性语法截断', async () => {
  // 曾经的 bug：rehype-shoka-attrs 会把 li 里 <code class="language-math"> 的
  // 末尾 {…} 当成属性块剥掉，\frac{a}{b} 于是变成 \frac{a}，KaTeX 报 ParseError。
  const processor = await createMathAttrsProcessor();
  const { code } = await processor.render('- 条件概率公式：$P(A|B)=\\dfrac{P(A\\cap B)}{P(B)}$\n');
  assert.doesNotMatch(code, /katex-error/);
  assert.match(code, /class="katex"/);
});

test('列表项末尾的属性语法仍然生效', async () => {
  const processor = await createMathAttrsProcessor();
  const { code } = await processor.render('- 标题{.red}\n');
  assert.match(code, /<li class="red">/);
  assert.doesNotMatch(code, /\{\.red\}/);
});
