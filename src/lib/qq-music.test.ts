import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchQqLyric, fetchQqPlaylist, isQqLazyUrl, isQqPlaylistUrl, qqLazySongMid, resolveQqStream } from './qq-music';

// ── Fake browser environment ────────────────────────────────────────────────
// The QQ client talks JSONP, so the tests drive the same `<script>` mechanism a
// browser would: the fake document records each script URL, and the test answers
// it by invoking the `window` callback the URL declares.

interface JsonpRequest {
  callback: string;
  payload: {
    req_0?: { module?: string; method?: string; param?: Record<string, unknown> };
  };
}

const pendingRequests: JsonpRequest[] = [];
const fakeWindow = globalThis as unknown as Record<string, unknown>;
const storage = new Map<string, string>();

function installFakeDom() {
  pendingRequests.length = 0;
  storage.clear();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      head: {
        appendChild: (script: { src: string }) => {
          const url = new URL(script.src);
          pendingRequests.push({
            callback: url.searchParams.get('callback') ?? '',
            payload: JSON.parse(url.searchParams.get('data') ?? '{}'),
          });
        },
      },
      createElement: () => ({ remove: () => {}, referrerPolicy: '' }),
    },
  });
}

/** Answer the most recent JSONP request with `response`. */
function answerLast(response: unknown): JsonpRequest {
  const request = pendingRequests.at(-1);
  assert.ok(request, 'expected a pending JSONP request');
  const callback = fakeWindow[request.callback];
  assert.equal(typeof callback, 'function', `callback ${request.callback} was not registered`);
  (callback as (data: unknown) => void)(response);
  return request;
}

installFakeDom();

// ── URL classification ──────────────────────────────────────────────────────

test('QQ playlist links are recognised and song links are not', () => {
  assert.equal(isQqPlaylistUrl('https://y.qq.com/n/ryqq/playlist/4218963770'), true);
  assert.equal(isQqPlaylistUrl('https://y.qq.com/n/ryqq_v2/playlist/4218963770?ADTAG=h5_share'), true);
  assert.equal(isQqPlaylistUrl('https://y.qq.com/n/ryqq/album/002fRO0N4FftzY'), false);
  assert.equal(isQqPlaylistUrl('https://music.163.com/#/playlist?id=8676645748'), false);
});

test('lazy QQ urls round-trip the songmid', () => {
  assert.equal(isQqLazyUrl('qq:lazy:001lyrNA2DlM70'), true);
  assert.equal(qqLazySongMid('qq:lazy:001lyrNA2DlM70'), '001lyrNA2DlM70');
  assert.equal(isQqLazyUrl('https://example.com/a.mp3'), false);
  assert.equal(qqLazySongMid('https://example.com/a.mp3'), null);
});

// ── Playlist ────────────────────────────────────────────────────────────────

const playlistResponse = {
  req_0: {
    code: 0,
    data: {
      songlist: [
        {
          id: 229396085,
          mid: '001lyrNA2DlM70',
          name: '忘与忘川',
          singer: [{ name: '叶里' }],
          album: { mid: '001yNkX623ZoKA', id: 23732099 },
          pay: { pay_play: 0 },
        },
        {
          id: 127570280,
          mid: '001csVKf12pKXN',
          name: 'I Really Want to Stay at Your House',
          singer: [{ name: 'Rosa Walton' }, { name: 'Hallie Coggins' }],
          album: { mid: '001yNkX623ZoKA' },
          pay: { pay_play: 1 },
        },
      ],
    },
  },
};

test('a playlist request carries the playlist id, and tracks map to songs', async () => {
  installFakeDom();
  const promise = fetchQqPlaylist('4218963770');
  const request = answerLast(playlistResponse);

  assert.equal(request.payload.req_0?.module, 'music.srfDissInfo.aiDissInfo');
  assert.equal(request.payload.req_0?.method, 'uniform_get_Dissinfo');
  assert.equal(request.payload.req_0?.param?.disstid, 4218963770);

  const songs = await promise;
  assert.equal(songs.length, 2);

  // Free track → lazy placeholder that the player resolves on click.
  const [free, paid] = songs;
  assert.equal(free.name, '忘与忘川');
  assert.equal(free.artist, '叶里');
  assert.equal(free.url, 'qq:lazy:001lyrNA2DlM70');
  assert.equal(free.vip, false);
  assert.match(free.pic, /T002R300x300M000001yNkX623ZoKA\.jpg/);
  assert.match(free.sourceUrl ?? '', /songDetail\/001lyrNA2DlM70$/);

  // Paid track → listed, flagged, never given a stream URL.
  assert.equal(paid.name, 'I Really Want to Stay at Your House');
  assert.equal(paid.artist, 'Rosa Walton / Hallie Coggins');
  assert.equal(paid.url, '');
  assert.equal(paid.vip, true);
});

test('playlist metadata is cached so repeat loads skip the request', async () => {
  installFakeDom();
  const first = fetchQqPlaylist('4218963770');
  answerLast(playlistResponse);
  await first;
  assert.equal(pendingRequests.length, 1);

  const second = await fetchQqPlaylist('4218963770');
  assert.equal(second.length, 2);
  // Served from cache — no second JSONP request.
  assert.equal(pendingRequests.length, 1);
});

test('a track without a mid is skipped instead of rendering a broken row', async () => {
  installFakeDom();
  const promise = fetchQqPlaylist('42');
  answerLast({ req_0: { code: 0, data: { songlist: [{ name: 'no mid' }, { mid: 'abc', name: 'ok' }] } } });
  const songs = await promise;
  assert.deepEqual(
    songs.map((song) => song.name),
    ['ok'],
  );
});

// ── Stream ──────────────────────────────────────────────────────────────────

const VKEY = 'C400001lyrNA2DlM70.m4a?guid=10000&vkey=ABC__v21e297fb4&uin=&fromtag=3';

test('a stream response becomes an HTTPS url using the API-provided host', async () => {
  installFakeDom();
  const promise = resolveQqStream('001lyrNA2DlM70');
  const request = answerLast({
    req_0: { code: 0, data: { sip: ['http://aqqmusic.tc.qq.com/'], midurlinfo: [{ purl: VKEY }] } },
  });

  // `filename` must stay unset: setting it makes the CDN 404 most tracks.
  assert.equal(request.payload.req_0?.module, 'vkey.GetVkeyServer');
  assert.equal(request.payload.req_0?.method, 'CgiGetVkey');
  assert.deepEqual(request.payload.req_0?.param?.songmid, ['001lyrNA2DlM70']);
  assert.equal(request.payload.req_0?.param?.filename, undefined);

  assert.equal(await promise, `https://aqqmusic.tc.qq.com/${VKEY}`);
});

test('a paid track (empty purl) resolves to null rather than a broken url', async () => {
  installFakeDom();
  const promise = resolveQqStream('001csVKf12pKXN');
  answerLast({ req_0: { code: 0, data: { sip: ['http://aqqmusic.tc.qq.com/'], midurlinfo: [{ purl: '', result: 104003 }] } } });
  assert.equal(await promise, null);
});

test('resolved streams are cached for reuse within their short lifetime', async () => {
  installFakeDom();
  const first = resolveQqStream('001lyrNA2DlM70');
  answerLast({ req_0: { code: 0, data: { sip: ['http://aqqmusic.tc.qq.com/'], midurlinfo: [{ purl: VKEY }] } } });
  await first;
  assert.equal(pendingRequests.length, 1);

  const second = await resolveQqStream('001lyrNA2DlM70');
  assert.equal(second, `https://aqqmusic.tc.qq.com/${VKEY}`);
  assert.equal(pendingRequests.length, 1);
});

// ── Lyrics ──────────────────────────────────────────────────────────────────

test('base64 lyrics are decoded to plain LRC text', async () => {
  installFakeDom();
  const lrc = '[ti:忘与忘川]\n[ar:叶里]\n[00:01.00]第一句';
  const base64 = Buffer.from(lrc, 'utf8').toString('base64');

  const promise = fetchQqLyric('001lyrNA2DlM70');
  const request = answerLast({ req_0: { data: { lyric: base64 } } });
  assert.equal(request.payload.req_0?.module, 'music.musichallSong.PlayLyricInfo');
  assert.equal(request.payload.req_0?.param?.songMID, '001lyrNA2DlM70');

  assert.equal(await promise, lrc);
});

test('malformed lyrics degrade to an empty string', async () => {
  installFakeDom();
  const promise = fetchQqLyric('001lyrNA2DlM70');
  answerLast({ req_0: { data: { lyric: '!!!not-base64!!!' } } });
  assert.equal(await promise, '');
});
