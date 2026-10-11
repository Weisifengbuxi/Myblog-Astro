/**
 * HTML renderers for Shoka preprocessor output.
 *
 * Generates HTML strings for friend links, audio players, and video embeds.
 * Separated from the preprocessor to keep parsing and rendering concerns distinct.
 */

import { qqOutchainUrl, resolveQqOutchainSongId } from '../meting';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Validate and sanitize a CSS color value (hex, named, hsl, rgb only) */
export function sanitizeCssColor(color: string): string | null {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^(rgb|hsl)a?\([\d\s,%./]+\)$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]+$/.test(trimmed)) return trimmed;
  return null;
}

export interface FriendLinkData {
  site: string;
  url: string;
  owner?: string;
  desc?: string;
  image?: string;
  color?: string;
}

/**
 * One entry inside `{% media audio %}`.
 *
 * Accepted shapes:
 * - Meting playlist group: `title` + `list` of platform URLs
 * - Meting single song: `name` + `url`
 * - QQ Music outchain single song: `name` + `songid` (numeric id or a share link
 *   that carries `songid=`), rendered with QQ Music's official embed player
 *
 * A QQ Music **playlist** link is deliberately not expanded: the official embed
 * only accepts a per-song numeric id, and QQ Music exposes only alphanumeric
 * mids for playlist tracks, so no playlist can be converted automatically.
 */
export interface MediaItem {
  name?: string;
  url?: string;
  title?: string;
  list?: string[];
  /** Numeric QQ Music song id, or a link carrying `songid=`. */
  songid?: string;
}

interface AudioGroup {
  title?: string;
  list: string[];
}

interface MediaSong {
  name?: string;
  songId: string;
}

/**
 * Rendering options for `{% media audio %}`.
 *
 * `apiUrl` is forwarded to the player as `data-api` so the client resolves
 * playlists through the configured Meting instance (e.g. a self-hosted one with
 * Tencent/QQ Music cookies) instead of the public demo endpoint.
 */
export interface AudioMediaOptions {
  apiUrl?: string;
}

export function renderFriendLinks(items: FriendLinkData[]): string {
  const jsonData = escapeHtml(JSON.stringify(items));
  const cards = items
    .map((item) => {
      const safeColor = item.color ? sanitizeCssColor(item.color) : null;
      const colorStyle = safeColor ? ` style="border-color: ${escapeHtml(safeColor)}"` : '';
      const image = item.image
        ? `<img class="avatar" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.site)}" loading="lazy" />`
        : '';
      const desc = item.desc ? `<div class="desc">${escapeHtml(item.desc)}</div>` : '';
      return `<a class="friend-link-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"${colorStyle}>${image}<div class="info"><div class="name">${escapeHtml(item.site)}</div>${desc}</div></a>`;
    })
    .join('\n');
  return `<div class="friend-links-grid" data-links="${jsonData}">\n${cards}\n</div>`;
}

/**
 * Render `{% media audio %}` into either the Meting player, QQ Music outchain
 * embeds, or both.
 *
 * QQ Music outchain entries require a numeric `songid` that QQ Music does not
 * expose for a `songDetail` link, so such an entry falls back to a plain link
 * instead of disappearing. The async signature leaves room for the resolver to
 * grow a lookup in the future.
 */
export async function renderAudioMedia(items: MediaItem[], options: AudioMediaOptions = {}): Promise<string> {
  const groups: AudioGroup[] = [];
  const singles: MediaSong[] = [];
  const unresolved: { name?: string; link: string }[] = [];

  for (const item of items) {
    // `songid` and `url` resolve one item each, so they must be checked before
    // the `list` branch (a YAML entry could carry both `songid` and `list`).
    if (item.songid) {
      const songId = await resolveQqOutchainSongId(item.songid, options.apiUrl);
      // A failed lookup must not silently drop the song: fall back to a link.
      if (songId) singles.push({ name: item.name, songId });
      else unresolved.push({ name: item.name, link: item.songid });
    } else if (item.url) {
      groups.push({ list: [item.url] });
    } else if (item.list && Array.isArray(item.list)) {
      groups.push({ title: item.title, list: item.list });
    }
  }

  const html: string[] = [];

  if (groups.length > 0) {
    const dataSrc = escapeHtml(JSON.stringify(groups));
    const apiAttr = options.apiUrl ? ` data-api="${escapeHtml(options.apiUrl)}"` : '';
    html.push(`<div data-audio-player data-src="${dataSrc}"${apiAttr}></div>`);
  }

  const embeds = singles.map((song) => {
    const caption = song.name ? `<div class="qq-outchain-caption">${escapeHtml(song.name)}</div>` : '';
    return `<div class="qq-outchain-item">\n${caption}\n<iframe src="${escapeHtml(qqOutchainUrl(song.songId))}" width="100%" height="65" frameborder="0" loading="lazy" referrerpolicy="no-referrer" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-presentation" title="${escapeHtml(song.name || 'QQ 音乐外链播放器')}"></iframe>\n</div>`;
  });

  // Unresolved entries become plain links inside the same list so the reader can
  // still reach the song on QQ Music.
  const fallbacks = unresolved.map((entry) => {
    const label = entry.name ? `${escapeHtml(entry.name)}：` : '';
    const href = escapeHtml(/^https?:\/\//.test(entry.link) ? entry.link : `https://y.qq.com/n/ryqq/songDetail/${entry.link}`);
    return `<div class="qq-outchain-item qq-outchain-item--link">${label}<a href="${href}" target="_blank" rel="noopener noreferrer">在 QQ 音乐中打开</a></div>`;
  });

  if (embeds.length > 0 || fallbacks.length > 0) {
    html.push(`<div class="qq-outchain-player">\n${[...embeds, ...fallbacks].join('\n')}\n</div>`);
  }

  if (html.length > 0) return html.join('\n');

  // Nothing was configured at all — emit an actionable hint instead of an empty block.
  if (items.length === 0) return '';
  return `<div class="qq-outchain-empty">⚠️ 未能生成播放器：QQ 音乐外链需要 <code>songid</code>（数字 ID 或带 <code>songid=</code> 的分享链接，逐首填写），Meting 歌单需要 <code>url</code> 或 <code>list</code>。</div>`;
}

export function renderVideoMedia(items: MediaItem[]): string {
  const tracks = items
    .filter((item): item is MediaItem & { url: string } => !!item.url)
    .map((item) => ({ name: item.name || '', url: item.url }));

  if (tracks.length === 0) return '';
  const dataSrc = escapeHtml(JSON.stringify(tracks));
  return `<div data-video-player data-src="${dataSrc}"></div>`;
}
