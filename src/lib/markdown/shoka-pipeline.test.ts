import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkShokaPreprocess } from './remark-shoka-preprocess';

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
