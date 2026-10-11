import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { fetchMeting, type MetingSong, qqOutchainSongId, qqOutchainUrl, resolveQqOutchainSongId } from './meting';

const song: MetingSong = {
  name: 'Test song',
  artist: 'Test artist',
  url: 'http://163.hyc.moe?server=netease&type=url&id=42',
  pic: 'http://163.hyc.moe?server=netease&type=pic&id=42',
  lrc: 'http://163.hyc.moe?server=netease&type=lrc&id=42&format=lrc',
};

// A single store installed once for the whole file: `fetchMeting` caches into
// localStorage, so re-creating the store per test would let one test's cached
// playlist leak into the next one.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

function mockMeting(t: TestContext, songs: MetingSong[]) {
  // Each test starts from a cold cache so a previous test's cached playlist can
  // never satisfy the request under test.
  storage.clear();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(songs));
  return { storage, fetch };
}

test('HTTPS Meting responses use HTTPS for lyrics and media on the API host', async (t) => {
  mockMeting(t, [song]);
  const [resolved] = await fetchMeting('netease', 'playlist', '42');
  for (const field of ['url', 'pic', 'lrc'] as const) {
    const expected = new URL(song[field]);
    expected.protocol = 'https:';
    assert.equal(resolved[field], expected.href);
  }
});

test('old cached HTTP lyric addresses are repaired without refetching the playlist', async (t) => {
  const { storage, fetch } = mockMeting(t, []);
  storage.set('meting:netease:playlist:42', JSON.stringify({ data: [song], timestamp: Date.now() }));
  const [resolved] = await fetchMeting('netease', 'playlist', '42');
  assert.equal(new URL(resolved.lrc).protocol, 'https:');
  assert.equal(fetch.mock.callCount(), 0);
});

test('custom HTTPS APIs upgrade their own lyric URLs and preserve other hosts and ports', async (t) => {
  mockMeting(t, [
    {
      ...song,
      lrc: 'http://music.example/api/?type=lrc&id=42',
      url: 'http://cdn.example/song.mp3',
      pic: 'http://music.example:8080/cover.jpg',
    },
  ]);
  const [resolved] = await fetchMeting('netease', 'playlist', '42', 'https://music.example/api/');
  assert.equal(resolved.lrc, 'https://music.example/api/?type=lrc&id=42');
  assert.equal(resolved.url, 'http://cdn.example/song.mp3');
  assert.equal(resolved.pic, 'http://music.example:8080/cover.jpg');
});

test('an explicitly configured HTTP API keeps its HTTP resource URLs', async (t) => {
  mockMeting(t, [song]);
  const [resolved] = await fetchMeting('netease', 'playlist', '42', 'http://163.hyc.moe/');
  assert.deepEqual(resolved, song);
});

test('inline lyrics, relative assets, and absent lyrics remain unchanged', async (t) => {
  const inline = { ...song, lrc: '[00:00.00]Inline lyrics', pic: '/cover.jpg', url: 'https://163.hyc.moe/song.mp3' };
  const noLyrics = { ...song, lrc: '', pic: '', url: '/song.mp3' };
  mockMeting(t, [inline, noLyrics]);
  const resolved = await fetchMeting('netease', 'playlist', '42');
  assert.deepEqual(resolved, [inline, noLyrics]);
});

test('QQ Music song links resolve to the numeric outchain song id', () => {
  // Share link copied from the QQ Music web player.
  assert.equal(qqOutchainSongId('https://i.y.qq.com/v8/playsong.html?songid=127570280&songtype=0'), '127570280');
  // Bare numeric id.
  assert.equal(qqOutchainSongId('  127570280  '), '127570280');
  // A Meting media URL whose id happens to be all digits is a genuine song id.
  assert.equal(qqOutchainSongId('https://163.hyc.moe/?server=tencent&type=url&id=127570280'), '127570280');
  // Tencent mids are alphanumeric, so they must never be truncated into an id.
  assert.equal(qqOutchainSongId('https://163.hyc.moe/?server=tencent&type=url&id=003gWfQ04LBELl'), null);
  // `songDetail` only carries an alphanumeric mid, so no numeric id is derivable.
  assert.equal(qqOutchainSongId('https://y.qq.com/n/ryqq/songDetail/001csVKf12pKXN'), null);
  // An unrelated `id=` must not be mistaken for a song id.
  assert.equal(qqOutchainSongId('https://example.com/watch?id=127570280'), null);
  assert.equal(qqOutchainSongId('not a song'), null);
});

test('the outchain URL encodes the numeric song id', () => {
  assert.equal(qqOutchainUrl('127570280'), 'https://i.y.qq.com/n2/m/outchain/player/index.html?songid=127570280&songtype=0');
});

test('a songDetail link cannot be converted to a numeric outchain id', async (t) => {
  // QQ Music only exposes alphanumeric mids for these links; resolving must not
  // invent an id, and must not call the API for one.
  const { fetch } = mockMeting(t, []);
  assert.equal(await resolveQqOutchainSongId('https://y.qq.com/n/ryqq/songDetail/001csVKf12pKXN'), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('explicit numeric ids pass through without an API call', async (t) => {
  const { fetch } = mockMeting(t, []);
  assert.equal(await resolveQqOutchainSongId('127570280'), '127570280');
  assert.equal(await resolveQqOutchainSongId('https://i.y.qq.com/v8/playsong.html?songid=127570280&songtype=0'), '127570280');
  assert.equal(fetch.mock.callCount(), 0);
});
