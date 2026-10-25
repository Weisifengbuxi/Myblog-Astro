import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { rehypeTableScroll, TABLE_SCROLL_CLASS } from './rehype-table-scroll';

const render = async (markdown: string) => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [rehypeTableScroll],
  });
  const { code } = await processor.render(markdown);
  return code;
};

test('rehype-table-scroll 把表格包进 .table-scroll 容器', async () => {
  const code = await render('| 符号 | 含义 |\n| --- | --- |\n| θ | 参数 |\n');
  assert.match(code, new RegExp(`<div class="${TABLE_SCROLL_CLASS}">[\\s\\S]*?<table>`));
  assert.match(code, /<\/table><\/div>/);
  // 只能包一层
  assert.equal((code.match(/table-scroll/g) ?? []).length, 1);
});

test('rehype-table-scroll 不影响普通段落与代码块', async () => {
  const code = await render('普通段落\n\n```js\nconst a = 1;\n```\n');
  assert.doesNotMatch(code, /table-scroll/);
  assert.match(code, /<pre>/);
});
