/**
 * 友链朋友圈（fcircle）数据类型与本地数据读取。
 *
 * 数据来源：一个由 GitHub Actions 定时生成的 `all.json` —— 抓取「友链」里各站的
 * RSS，汇总成一份文章列表。上游是 Friend-Circle-Lite
 * (https://github.com/xiowoku/Friend-Circle-Lite)；原 Hexo 博客用的是它的
 * 「轻量版」（`friends_lite`），后端在 fcircle.weisifengbuxi.top，该域名证书已过期，
 * 因此改为在博客仓库内用 Actions 生成，不再依赖独立后端。
 *
 * 由于数据是构建时读取的（`public/fcircle/all.json`），页面不依赖任何运行时接口，
 * 也就不存在 CORS、证书、或第三方服务挂掉的问题。
 */

/** 单条友链文章。字段与 Friend-Circle-Lite 的 all.json 对齐。 */
export interface FcirclePost {
  /** 文章标题 */
  title: string;
  /** 文章链接 */
  link: string;
  /** 作者（Friend-Circle-Lite 用的是友链**站点名**，未必是 RSS 里的作者） */
  author: string;
  /** 作者头像 */
  avatar?: string;
  /**
   * 发布时间。FCLite 为 `"YYYY-MM-DD HH:MM"`（只到分钟、本地时间）；
   * hexo-circle-of-friends 可能是纯日期 `"YYYY-MM-DD"` 或 ISO。原样保留，排序时再解析。
   */
  created?: string;
  /** 更新时间：仅 hexo-circle-of-friends 后端会带，FCLite 没有这个字段 */
  updated?: string;
  /** AI 摘要：仅后端开了 AI 摘要才有，必须容错 */
  summary?: string;
}

/** 统计信息，对应 FCLite 的 `statistical_data`。 */
export interface FcircleStat {
  friends?: number;
  active?: number;
  error?: number;
  article?: number;
  /** 数据生成时间 */
  lastUpdated?: string;
}

/** 解析后的朋友圈数据。 */
export interface FcirclePayload {
  posts: FcirclePost[];
  stat?: FcircleStat;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const int = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * 把一条记录规整成 {@link FcirclePost}。
 *
 * 上游存在**两套不兼容的 schema**：
 *   - Friend-Circle-Lite：`{ statistical_data, article_data[] }`，元素恰好
 *     `title/created/link/author/avatar` 5 个键，没有 `updated`/`summary`
 *   - hexo-circle-of-friends 后端 `/all`：同样两个顶层键，但元素多了 `floor`/`updated`，
 *     开了 AI 摘要时还有 `summary`
 *
 * 两者顶层结构一致，差异只在元素字段，所以这里做一次宽松归一：
 * 缺字段一律降级而不是抛错，一份坏数据不该让整站构建失败。
 */
function normalizePost(raw: unknown): FcirclePost | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const link = str(r.link) || str(r.url);
  const title = str(r.title) || str(r.name);
  // 标题或链接缺失的条目直接丢弃：渲染出来也是一个点不动的空壳
  if (!link || !title) return null;

  return {
    title,
    link,
    author: str(r.author) || str(r.owner) || '佚名',
    avatar: str(r.avatar) || str(r.authorAvatar) || undefined,
    created: str(r.created) || str(r.pubDate) || str(r.published) || undefined,
    updated: str(r.updated) || undefined,
    summary: str(r.summary) || str(r.ai_summary) || undefined,
  };
}

/**
 * 解析 all.json。兼容三种包装：
 *   - FCLite / hexo-circle-of-friends：`{ statistical_data, article_data }`
 *   - 简化写法：`{ data: [...] }` 或 `{ posts: [...] }`
 *   - 裸数组
 */
export function parseFcirclePayload(raw: unknown): FcirclePayload {
  const obj = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(obj.article_data)
      ? (obj.article_data as unknown[])
      : Array.isArray(obj.data)
        ? (obj.data as unknown[])
        : Array.isArray(obj.posts)
          ? (obj.posts as unknown[])
          : [];

  const posts = list.map(normalizePost).filter((p): p is FcirclePost => p !== null);

  const s =
    obj.statistical_data && typeof obj.statistical_data === 'object'
      ? (obj.statistical_data as Record<string, unknown>)
      : undefined;
  const stat: FcircleStat | undefined = s
    ? {
        friends: int(s.friends_num),
        active: int(s.active_num),
        error: int(s.error_num),
        article: int(s.article_num),
        lastUpdated: str(s.last_updated_time) || undefined,
      }
    : undefined;

  return { posts, stat };
}

/**
 * 解析时间。
 *
 * FCLite 写的是 `"2026-10-08 11:23"` —— 带空格的本地时间。按 ECMAScript 规范
 * 这种字符串属于实现相关格式，Chrome/Safari 都能解析，但为稳妥起见显式把空格
 * 换成 `T`（变成合法的 ISO 本地时间）再解析。纯日期 `"2026-10-08"` 与 ISO 直接可用。
 */
export function postTime(post: FcirclePost): number {
  const raw = post.updated || post.created;
  if (!raw) return 0;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  const isoish = Date.parse(raw.replace(' ', 'T'));
  return Number.isFinite(isoish) ? isoish : 0;
}

/** 按时间倒序，稳定的次级排序用标题，避免同一时间多次构建顺序抖动。 */
export function sortByTimeDesc(posts: FcirclePost[]): FcirclePost[] {
  return [...posts].sort((a, b) => postTime(b) - postTime(a) || a.title.localeCompare(b.title));
}

/**
 * 把 `"2026-10-08 11:23"` 显示成相对时间（如「3 天前」）。
 * 解析不出来时原样返回，至少不会显示成空白。
 */
export function formatRelative(post: FcirclePost, now = Date.now()): string {
  const t = postTime(post);
  if (!t) return post.created ?? '';
  const diff = now - t;
  if (diff < 0) return post.created ?? '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 个月前`;
  return `${Math.floor(month / 12)} 年前`;
}
