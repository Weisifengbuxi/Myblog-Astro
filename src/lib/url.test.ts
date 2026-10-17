/**
 * `toSecureUrl` 的行为：只升级 http://，其余原样返回。
 *
 * 背景：友链/朋友圈头像常由别人站点的 RSS 提供，写 http:// 会让整个页面被浏览器
 * 标记成「不安全」（混合内容），所以在渲染时统一升级。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toSecureUrl } from './url';

describe('toSecureUrl', () => {
  it('把 http:// 升级成 https://', () => {
    assert.equal(toSecureUrl('http://p2.music.126.net/a.jpg'), 'https://p2.music.126.net/a.jpg');
    assert.equal(toSecureUrl('http://example.com/x.png?param=1'), 'https://example.com/x.png?param=1');
  });

  it('已经是 https:// 的不动', () => {
    assert.equal(toSecureUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  });

  it('大写协议也升级', () => {
    assert.equal(toSecureUrl('HTTP://EXAMPLE.COM/A.JPG'), 'https://EXAMPLE.COM/A.JPG');
  });

  it('相对路径、协议相对、data: 都原样返回', () => {
    assert.equal(toSecureUrl('/img/cover/note.webp'), '/img/cover/note.webp');
    assert.equal(toSecureUrl('//sdk.51.la/x.js'), '//sdk.51.la/x.js');
    assert.equal(toSecureUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  });

  it('只去掉协议前的空白，其余字符保持原样', () => {
    assert.equal(toSecureUrl('  http://example.com/a b.jpg  '), 'https://example.com/a b.jpg');
  });

  it('空值返回 undefined', () => {
    assert.equal(toSecureUrl(undefined), undefined);
    assert.equal(toSecureUrl(null), undefined);
    assert.equal(toSecureUrl(''), undefined);
    assert.equal(toSecureUrl('   '), undefined);
  });
});
