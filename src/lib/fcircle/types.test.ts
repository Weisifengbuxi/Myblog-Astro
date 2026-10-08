import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { formatRelative, parseFcirclePayload, postTime, sortByTimeDesc } from './types';

/**
 * Friend-Circle-Lite 的真实 schema（取自子代理实测的 HTTP 200 响应）。
 * 元素**恰好 5 个键**，没有 `updated`、没有 `summary`、没有 `content`。
 */
const FCLITE_SAMPLE = {
  statistical_data: {
    friends_num: 202,
    active_num: 169,
    error_num: 33,
    article_num: 299,
    last_updated_time: '2026-10-08 14:22:43',
  },
  article_data: [
    {
      title: 'AI配音只会普通话？3 招让它说粤语、四川话、东北话',
      created: '2026-10-08 11:23',
      link: 'https://blog.lusyoe.com/article/ai-dubbing-dialect-accent-guide',
      author: '青萍叙事',
      avatar: 'https://p.liiiu.cn/i/2025/05/25/6833098ecb573.webp',
    },
    {
      title: 'Vibe Coding 写 Rust',
      created: '2026-10-08 03:47',
      link: 'https://xingwangzhe.fun/posts/cjk/',
      author: '姓王者',
      avatar: 'https://p.liiiu.cn/i/2024/12/30/6772bf7e3b6ea.webp',
    },
  ],
};

/** hexo-circle-of-friends 后端：同样两个顶层键，但元素带 floor/updated，且可能有 AI 摘要。 */
const BACKEND_SAMPLE = {
  statistical_data: {
    friends_num: 1,
    active_num: 1,
    error_num: 0,
    article_num: 4,
    last_updated_time: '2025-07-27 20:33:37',
  },
  article_data: [
    {
      floor: 1,
      title: '公共api尚未组建，敬请期待',
      created: '2025-07-28',
      updated: '2025-07-28',
      link: 'https://github.com/Rock-Candy-Tea/hexo-circle-of-friends',
      author: 'friend-circle',
      avatar: 'https://example.com/logo.png',
      summary: 'AI 摘要内容',
    },
  ],
};

test('parses the Friend-Circle-Lite schema', () => {
  const { posts, stat } = parseFcirclePayload(FCLITE_SAMPLE);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, 'AI配音只会普通话？3 招让它说粤语、四川话、东北话');
  assert.equal(posts[0].author, '青萍叙事');
  assert.equal(posts[0].avatar, 'https://p.liiiu.cn/i/2025/05/25/6833098ecb573.webp');
  // FCLite 不带这些字段，必须是 undefined 而不是空字符串以外的意外值
  assert.equal(posts[0].updated, undefined);
  assert.equal(posts[0].summary, undefined);

  assert.deepEqual(stat, {
    friends: 202,
    active: 169,
    error: 33,
    article: 299,
    lastUpdated: '2026-10-08 14:22:43',
  });
});

test('parses the hexo-circle-of-friends backend schema, including optional summary', () => {
  const { posts } = parseFcirclePayload(BACKEND_SAMPLE);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].updated, '2025-07-28');
  assert.equal(posts[0].summary, 'AI 摘要内容');
});

test('accepts the simpler wrappers and a bare array', () => {
  const post = { title: 't', link: 'https://a.example/1' };
  assert.equal(parseFcirclePayload([post]).posts.length, 1);
  assert.equal(parseFcirclePayload({ data: [post] }).posts.length, 1);
  assert.equal(parseFcirclePayload({ posts: [post] }).posts.length, 1);
});

test('drops entries without a title or link instead of throwing', () => {
  const { posts } = parseFcirclePayload({
    article_data: [
      { title: 'ok', link: 'https://a.example/1' },
      { title: '', link: 'https://a.example/2' },
      { title: 'no link', link: '' },
      null,
      'garbage',
    ],
  });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, 'ok');
});

test('a malformed payload degrades to empty rather than throwing', () => {
  for (const bad of [null, undefined, 42, 'text', {}]) {
    const { posts } = parseFcirclePayload(bad);
    assert.deepEqual(posts, []);
  }
});

test('parses the space-separated FCLite timestamp', () => {
  // "2026-10-08 11:23" is implementation-defined for Date.parse; the parser
  // normalizes the space to T first.
  const t = postTime({ title: 't', link: 'l', author: 'a', created: '2026-10-08 11:23' });
  assert.ok(t > 0, `expected a real timestamp, got ${t}`);
  assert.equal(new Date(t).getFullYear(), 2026);
  assert.equal(new Date(t).getMonth(), 9); // October
});

test('sorts newest first and keeps undated posts last', () => {
  const posts = [
    { title: 'old', link: 'l1', author: 'a', created: '2020-01-01' },
    { title: 'new', link: 'l2', author: 'a', created: '2026-10-08 11:23' },
    { title: 'undated', link: 'l3', author: 'a' },
  ];
  assert.deepEqual(
    sortByTimeDesc(posts).map((p) => p.title),
    ['new', 'old', 'undated'],
  );
});

test('formatRelative covers the ranges and never returns blank', () => {
  const now = Date.parse('2026-10-08T12:00:00');
  const at = (s: string) => ({ title: 't', link: 'l', author: 'a', created: s });
  assert.equal(formatRelative(at('2026-10-08 11:59'), now), '1 分钟前');
  assert.equal(formatRelative(at('2026-10-08 09:00'), now), '3 小时前');
  assert.equal(formatRelative(at('2026-10-01 12:00'), now), '7 天前');
  // Unparseable input falls back to the raw string, not an empty label.
  assert.equal(formatRelative(at('不是时间'), now), '不是时间');
});

test('the committed all.json (if present) parses cleanly', (t) => {
  const file = path.join(process.cwd(), 'public', 'fcircle', 'all.json');
  if (!fs.existsSync(file)) {
    t.skip('all.json 尚未生成（先跑 .migration/fetch-fcircle.mjs）');
    return;
  }
  const { posts, stat } = parseFcirclePayload(JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.ok(posts.length > 0, 'expected at least one post');
  // Every kept post must be renderable.
  for (const p of posts) {
    assert.ok(p.title.length > 0);
    assert.match(p.link, /^https?:\/\//);
  }
  assert.ok(stat && stat.article !== undefined);
});
