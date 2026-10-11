/**
 * Meting API client — resolves music platform URLs to playable audio streams.
 *
 * Ported from Shoka player.js URL parsing + Meting API integration.
 * Supports NetEase Cloud Music and QQ Music.
 */

const DEFAULT_API = 'https://163.hyc.moe/';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
  /**
   * True when the track is behind QQ Music's paywall: it stays in the list for
   * completeness but has no playable stream (`url` stays empty) until a VIP
   * cookie is involved.
   */
  vip?: boolean;
  /** Page to open when a `vip` track cannot be played here. */
  sourceUrl?: string;
}

interface ParsedUrl {
  server: string;
  type: string;
  id: string;
}

// URL parsing rules (ported from Shoka player.js:30-47)
// QQ Music's modern share URLs use `songDetail/<mid>`; the legacy `/song/<mid>`
// form is kept for older links. `\w+` stops at the first non-word character, so
// tracking parameters (`?ADTAG=...`) are ignored.
const URL_RULES: [RegExp, string, string][] = [
  [/music\.163\.com.*song.*id=(\d+)/, 'netease', 'song'],
  [/music\.163\.com.*album.*id=(\d+)/, 'netease', 'albumlist'],
  [/music\.163\.com.*playlist.*id=(\d+)/, 'netease', 'playlist'],
  [/music\.163\.com.*discover\/toplist.*id=(\d+)/, 'netease', 'playlist'],
  [/y\.qq\.com.*songDetail\/(\w+)/, 'tencent', 'song'],
  [/y\.qq\.com.*song\/(\w+)/, 'tencent', 'song'],
  [/y\.qq\.com.*album\/(\w+)/, 'tencent', 'albumlist'],
  [/y\.qq\.com.*playsquare\/(\w+)/, 'tencent', 'playlist'],
  [/y\.qq\.com.*playlist\/(\w+)/, 'tencent', 'playlist'],
  // QQ Music mobile/web share links carry the id as a query parameter instead of
  // a path segment, e.g. `.../playlist.html?id=4218963770`.
  [/y\.qq\.com.*playlist.*[?&]id=(\d+)/, 'tencent', 'playlist'],
  [/y\.qq\.com.*song.*[?&]songid=(\d+)/, 'tencent', 'song'],
  [/y\.qq\.com.*album.*[?&]albumid=(\w+)/, 'tencent', 'albumlist'],
];

/** Parse a music platform URL into server/type/id triple. */
export function parseMusicUrl(url: string): ParsedUrl | null {
  for (const [regex, server, type] of URL_RULES) {
    const match = url.match(regex);
    if (match?.[1]) {
      return { server, type, id: match[1] };
    }
  }
  return null;
}

// =============================================================================
// QQ Music official outchain player (no backend required)
// =============================================================================

/**
 * QQ Music's official embed player.
 *
 * `i.y.qq.com/n2/m/outchain/player/index.html?songid=<numeric id>&songtype=0`
 * plays a **single song** without any Meting API, cookie, or self-hosted
 * service, because QQ Music resolves the stream with its own outchain grant.
 * Playlists and albums are NOT supported by this endpoint (it answers
 * `请粘贴正确链接`), so this is strictly a per-song primitive.
 *
 * `songid` is the numeric id — not the alphanumeric `songmid` used by Meting.
 */
const QQ_OUTCHAIN_BASE = 'https://i.y.qq.com/n2/m/outchain/player/index.html';

/**
 * Extract the numeric `songid` needed by QQ Music's outchain player.
 *
 * Accepts the formats a user can actually copy from the site, so they can paste
 * a normal song page URL instead of hunting for a private numeric id:
 * - `https://i.y.qq.com/v8/playsong.html?songid=127570280&songtype=0` (share link)
 * - `https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV` → resolved via Meting
 * - a bare numeric id (`127570280`)
 *
 * The `songDetail` variant only carries an alphanumeric mid, so it needs a
 * Meting lookup and therefore returns `null` here; use
 * {@link resolveQqOutchainSongId} when an async resolution is acceptable.
 */
export function qqOutchainSongId(link: string): string | null {
  const value = link.trim();
  if (/^\d+$/.test(value)) return value;
  // Share URLs carry the numeric id as `songid` (e.g. `playsong.html?songid=`).
  const query = value.match(/[?&]songid=(\d+)(?!\w)/);
  if (query?.[1]) return query[1];
  // Meting media URLs for Tencent carry the *alphanumeric* mid, not the numeric
  // id (`?server=tencent&type=url&id=003gWfQ04LBELl`), so they cannot be used
  // here. Only an all-digit `id` is a genuine `songid`.
  if (/[?&]type=url\b/.test(value)) {
    const metingId = value.match(/[?&]id=(\d+)(?!\w)/);
    if (metingId?.[1]) return metingId[1];
  }
  return null;
}

/** Build the QQ Music outchain player URL for a numeric song id. */
export function qqOutchainUrl(songId: string): string {
  return `${QQ_OUTCHAIN_BASE}?songid=${encodeURIComponent(songId)}&songtype=0`;
}

/**
 * Resolve any supported QQ Music song link to the numeric outchain `songid`.
 *
 * Bare numeric ids and `songid=` links resolve synchronously. `songDetail/<mid>`
 * links canNOT be resolved: Tencent's API only ever exposes the alphanumeric
 * mid, and the numeric outchain id is an unrelated internal value (verified: two
 * different mids for the same song both return the same numeric id). Those links
 * therefore yield `null`, and callers fall back to a plain link.
 */
export async function resolveQqOutchainSongId(link: string, apiUrl?: string): Promise<string | null> {
  const direct = qqOutchainSongId(link);
  if (direct) return direct;

  // A `songDetail` link is kept as documentation of the intent: it cannot be
  // converted, so it resolves to null rather than a wrong id.
  const parsed = parseMusicUrl(link);
  if (parsed?.server !== 'tencent' || parsed.type !== 'song') return null;
  void apiUrl;
  return null;
}

interface CacheEntry {
  data: MetingSong[];
  timestamp: number;
}

function getCacheKey(server: string, type: string, id: string): string {
  return `meting:${server}:${type}:${id}`;
}

function getFromCache(key: string): MetingSong[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: MetingSong[]): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — non-critical, skip silently
  }
}

function isMetingSong(obj: unknown): obj is MetingSong {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.artist === 'string' && typeof o.url === 'string';
}

/** Some HTTPS Meting servers return HTTP links whose redirects fail browser CORS checks. */
function normalizeMediaUrls(songs: MetingSong[], apiUrl: URL): MetingSong[] {
  if (apiUrl.protocol !== 'https:') return songs;

  const normalize = (source: string): string => {
    if (!source?.startsWith('http://')) return source;
    try {
      const url = new URL(source);
      if (url.host !== apiUrl.host) return source;
      url.protocol = 'https:';
      return url.href;
    } catch {
      return source;
    }
  };

  return songs.map((song) => ({
    ...song,
    url: normalize(song.url),
    pic: normalize(song.pic),
    lrc: normalize(song.lrc),
  }));
}

/** Fetch songs from Meting API for a single parsed URL. */
export async function fetchMeting(server: string, type: string, id: string, apiUrl?: string): Promise<MetingSong[]> {
  const url = new URL(apiUrl || DEFAULT_API);
  const cacheKey = getCacheKey(server, type, id);
  const cached = getFromCache(cacheKey);
  if (cached) return normalizeMediaUrls(cached, url);

  const params = new URLSearchParams({ server, type, id });
  url.search = params.toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meting API error: ${response.status}`);

  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  const songs = normalizeMediaUrls(data.filter(isMetingSong), url);
  if (songs.length > 0) setCache(cacheKey, songs);
  return songs;
}

/** Resolve multiple music URLs into a flat song list. */
export async function resolvePlaylist(urls: string[], apiUrl?: string): Promise<MetingSong[]> {
  const results = await Promise.allSettled(
    urls.map((url) => {
      const parsed = parseMusicUrl(url);
      if (!parsed) return Promise.resolve([]);
      return fetchMeting(parsed.server, parsed.type, parsed.id, apiUrl);
    }),
  );

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
