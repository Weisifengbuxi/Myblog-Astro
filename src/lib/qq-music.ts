/**
 * QQ Music client — reads playlists and resolves playable streams straight from
 * QQ Music's own public endpoints, with **no backend and no login**.
 *
 * Why this exists: the Meting API is the usual way to resolve QQ Music here, but
 * every public Meting instance returns an empty stream for `server=tencent`
 * (verified: `{"error":"upstream url empty"}` / 0-byte responses), because it
 * builds the `filename` itself and the CDN then rejects the request. Talking to
 * QQ Music directly avoids that: omitting `filename` lets QQ pick the real media
 * file, and free tracks come back as real audio.
 *
 * Transport: `u.y.qq.com` sends **no CORS headers**, so a plain `fetch()` from
 * the browser would be blocked. It does support JSONP, and a `<script>` tag is
 * exempt from CORS — so JSONP is the transport here.
 *
 * Mixed content: the API hands back `http://` CDN hosts. Every URL is forced to
 * `https://`, which the same `vkey` accepts (verified byte-for-byte identical
 * downloads).
 *
 * Paywall: for a paid track QQ returns `purl: ""` (result 104003) and the trial
 * file is an empty 100-byte shell, so paid tracks cannot be played without a VIP
 * cookie on a server. They are still listed, flagged with `vip: true`.
 */

import type { MetingSong } from './meting';
import { parseMusicUrl } from './meting';

const MUSICU_ENDPOINT = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const CACHE_TTL = 6 * 60 * 60 * 1000; // playlist metadata: 6 hours
/** Stream URLs embed a signed `vkey`; keep them only briefly. */
const STREAM_CACHE_TTL = 10 * 60 * 1000;

/**
 * Marks a `url` that still needs a stream lookup at play time.
 *
 * Playlist metadata is fetched eagerly (one request for the whole list) but
 * streams are resolved lazily on click: that keeps the page to a single request
 * instead of one per song, and avoids holding hundreds of expiring `vkey`s.
 */
export const QQ_LAZY_URL_PREFIX = 'qq:lazy:';

let jsonpCounter = 0;

/** Whether a URL still needs its QQ stream resolved. */
export function isQqLazyUrl(url: string): boolean {
  return url.startsWith(QQ_LAZY_URL_PREFIX);
}

/** The songmid carried by a placeholder URL. */
export function qqLazySongMid(url: string): string | null {
  return isQqLazyUrl(url) ? url.slice(QQ_LAZY_URL_PREFIX.length) : null;
}

/**
 * Call `musicu.fcg` over JSONP.
 *
 * The endpoint requires `format=jsonp` **and** a `callback` name; without a
 * callback it answers with raw JSON, which a script tag cannot consume.
 */
function callMusicu<T>(payload: unknown, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('QQ Music JSONP requires a browser environment'));
      return;
    }

    const callbackName = `__qqMusicCb${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement('script');
    const globalScope = globalThis as unknown as Record<string, unknown>;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      script.remove();
      // The callback lives on the global object; delete it to avoid leaking one
      // key per request.
      delete globalScope[callbackName];
    };

    globalScope[callbackName] = (data: unknown) => {
      cleanup();
      resolve(data as T);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('QQ Music request failed'));
    };

    const params = new URLSearchParams({
      format: 'jsonp',
      callback: callbackName,
      data: JSON.stringify(payload),
    });
    script.src = `${MUSICU_ENDPOINT}?${params.toString()}`;
    script.referrerPolicy = 'no-referrer';

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('QQ Music request timed out'));
    }, timeoutMs);

    document.head.appendChild(script);
  });
}

function readCache<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - entry.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}

// =============================================================================
// Playlist
// =============================================================================

interface QqSinger {
  name?: string;
}

interface QqTrack {
  id?: number;
  mid?: string;
  name?: string;
  title?: string;
  interval?: number;
  singer?: QqSinger[];
  album?: { mid?: string; id?: number };
  pay?: { pay_play?: number };
}

interface QqPlaylistResponse {
  req_0?: {
    code?: number;
    data?: { songlist?: QqTrack[]; total_song_num?: number };
  };
}

/** Whether a playlist URL belongs to QQ Music. */
export function isQqPlaylistUrl(url: string): boolean {
  const parsed = parseMusicUrl(url);
  return parsed?.server === 'tencent' && parsed.type === 'playlist';
}

/** Build the standard album cover URL from an album mid. */
function albumCover(albumMid: string | undefined): string {
  return albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg?max_age=2592000` : '';
}

function trackToSong(track: QqTrack): MetingSong | null {
  const mid = track.mid;
  if (!mid) return null;

  const vip = (track.pay?.pay_play ?? 0) === 1;
  return {
    name: track.name || track.title || '未知曲目',
    artist: (track.singer ?? [])
      .map((s) => s.name)
      .filter(Boolean)
      .join(' / '),
    // Placeholder: resolved on click. Paid tracks never resolve.
    url: vip ? '' : `${QQ_LAZY_URL_PREFIX}${mid}`,
    pic: albumCover(track.album?.mid),
    lrc: '',
    vip,
    sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
  };
}

/**
 * Load a QQ Music playlist into the player's track shape.
 *
 * One JSONP request returns the whole list (verified: 332 tracks, 659 KB). Free
 * tracks get a lazy placeholder URL; paid tracks are flagged `vip`.
 */
export async function fetchQqPlaylist(playlistId: string): Promise<MetingSong[]> {
  const cacheKey = `qq:playlist:${playlistId}`;
  const cached = readCache<QqTrack[]>(cacheKey, CACHE_TTL);
  const tracks = cached ?? (await fetchQqPlaylistTracks(playlistId));
  if (!cached && tracks.length > 0) writeCache(cacheKey, tracks);
  return tracks.map(trackToSong).filter((song): song is MetingSong => song !== null);
}

async function fetchQqPlaylistTracks(playlistId: string): Promise<QqTrack[]> {
  const response = await callMusicu<QqPlaylistResponse>({
    req_0: {
      module: 'music.srfDissInfo.aiDissInfo',
      method: 'uniform_get_Dissinfo',
      param: {
        disstid: Number(playlistId),
        enc_host_uin: '',
        tag: 1,
        userinfo: 1,
        song_begin: 0,
        // Large enough for the whole playlist in a single round trip.
        song_num: 1000,
      },
    },
    comm: { ct: 24, cv: 0 },
  });

  return response.req_0?.data?.songlist ?? [];
}

// =============================================================================
// Stream + lyrics
// =============================================================================

interface QqVkeyResponse {
  req_0?: {
    code?: number;
    data?: {
      sip?: string[];
      midurlinfo?: { purl?: string; result?: number }[];
    };
  };
}

interface QqLyricResponse {
  req_0?: { data?: { lyric?: string } };
}

/**
 * Resolve a songmid to a playable, HTTPS audio URL.
 *
 * `filename` is deliberately omitted: QQ then picks the correct media file.
 * Supplying one (e.g. `M500<mid>.mp3`) makes many tracks answer with a non-empty
 * `purl` that the CDN rejects with 404, so this must stay unset.
 *
 * Returns `null` for paid/unavailable tracks (`purl` empty, result 104003).
 */
export async function resolveQqStream(songMid: string): Promise<string | null> {
  const cacheKey = `qq:stream:${songMid}`;
  const cached = readCache<string>(cacheKey, STREAM_CACHE_TTL);
  if (cached) return cached;

  const response = await callMusicu<QqVkeyResponse>({
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: '10000',
        songmid: [songMid],
        songtype: [0],
        uin: '0',
        loginflag: 1,
        platform: '20',
      },
    },
    comm: { uin: 0, format: 'json', ct: 24, cv: 0 },
  });

  const info = response.req_0?.data?.midurlinfo?.[0];
  const purl = info?.purl;
  if (!purl) return null;

  // The API returns plain `http://` hosts; the same vkey works over HTTPS,
  // which is required to avoid mixed-content blocking on an HTTPS site.
  const host = (response.req_0?.data?.sip?.[0] ?? 'https://aqqmusic.tc.qq.com/').replace(/^http:\/\//, 'https://');
  const url = `${host.endsWith('/') ? host : `${host}/`}${purl}`;

  writeCache(cacheKey, url);
  return url;
}

/**
 * Fetch lyrics for a songmid, decoded to plain LRC text.
 *
 * QQ Music returns the LRC base64-encoded, and the player expects either plain
 * LRC text or a URL — so the decoding happens here.
 */
export async function fetchQqLyric(songMid: string): Promise<string> {
  const cacheKey = `qq:lyric:${songMid}`;
  const cached = readCache<string>(cacheKey, CACHE_TTL);
  if (cached !== null) return cached;

  const response = await callMusicu<QqLyricResponse>({
    req_0: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: { songMID: songMid, songID: 0 },
    },
    comm: { ct: 24, cv: 0 },
  });

  const lyric = decodeBase64(response.req_0?.data?.lyric ?? '');
  writeCache(cacheKey, lyric);
  return lyric;
}

/** Decode QQ Music's base64 LRC payload; malformed input yields an empty string. */
function decodeBase64(value: string): string {
  if (!value) return '';
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Resolve every QQ playlist URL found in a list of encoded groups.
 *
 * Each group's list may mix Meting URLs (handled elsewhere) with QQ Music
 * playlist links; only the QQ links are consumed here, preserving group order.
 */
export async function resolveQqPlaylists(
  groups: { title?: string; list: string[] }[],
): Promise<{ title?: string; songs: MetingSong[] }[]> {
  return Promise.all(
    groups.map(async (group) => {
      const qqUrls = group.list.filter(isQqPlaylistUrl);
      const songs = (
        await Promise.all(
          qqUrls.map(async (url) => {
            const parsed = parseMusicUrl(url);
            return parsed ? fetchQqPlaylist(parsed.id) : [];
          }),
        )
      ).flat();
      return { title: group.title, songs };
    }),
  );
}
