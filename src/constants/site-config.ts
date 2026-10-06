/**
 * Site configuration assembly layer.
 *
 * Re-exports the normalized values from `@lib/config/site` and maps the
 * remaining YAML sections onto their runtime shapes. Nothing under `src/lib/**`
 * may import this module — depend on `@lib/config/*` instead.
 */

import { resolveEditorNavigation } from '@lib/config/editor';
import { normalizeMomentsConfig, resolveMomentsNavigation } from '@lib/config/moments';
import {
  contentConfig,
  editorConfig,
  enabledLocaleCodes,
  enabledSeriesSlugList,
  featuredSeriesList,
  i18nConfig,
  motionConfig,
  siteConfig,
} from '@lib/config/site';
import type {
  AnalyticsConfig,
  BangumiConfig,
  BgmAudioGroup,
  ChristmasConfig,
  CommentConfig,
  DevConfig,
  RouterItem,
  SocialConfig,
} from '@lib/config/types';
import { createUmamiStatsConfig } from '@lib/umami-stats';
import type { UmamiStatsConfig } from '@/types/umami-stats';
import yamlConfig from '../../config/site.yaml';
import { DEFAULT_ROUTERS, RESERVED_ROUTES } from './router';

export { contentConfig, editorConfig, i18nConfig, motionConfig, siteConfig };

export const socialConfig: SocialConfig = yamlConfig.social ?? {};

/**
 * Footer navigation links ("小页面" strip shown at the bottom of every page).
 * Managed through the `footerLinks` list in config/site.yaml.
 */
export const footerLinks: { name: string; path: string }[] = Array.isArray(yamlConfig.footerLinks)
  ? yamlConfig.footerLinks.filter((item): item is { name: string; path: string } => Boolean(item?.name && item?.path))
  : [];

// ICP filing config — normalize string shorthand to { text } object
export const icpConfig: { text: string; link?: string } | undefined = (() => {
  const raw = yamlConfig.site.icp;
  if (!raw) return undefined;
  if (typeof raw === 'string') return { text: raw };
  return raw;
})();

export interface FooterFiling {
  text: string;
  link?: string;
}

export interface FooterBadge extends FooterFiling {
  /** Shield image URL; when present the entry renders as an image badge. */
  image?: string;
}

/**
 * Footer filings (ICP / 公安网安备) and badge links.
 *
 * `site.icp` above is the theme's own single-entry field and keeps working.
 * These two carry the rest of what the previous Hexo blog showed at the bottom:
 * the 公安网安备 entry, and the little shield badges (萌ICP etc.).
 *
 * Config shape (config/site.yaml):
 *   filings:
 *     - text: 晋ICP备-2025067606号
 *       link: https://beian.miit.gov.cn/
 *     - text: 晋公网安备14010502990310号
 *       link: https://beian.mps.gov.cn/#/
 *   badges:
 *     - text: 萌ICP备20250740号
 *       link: https://icp.gov.moe/?keyword=20250740
 *       image: https://example.com/shield.svg
 */
const rawFilings = (yamlConfig as { filings?: unknown }).filings;
export const footerFilings: FooterFiling[] = Array.isArray(rawFilings)
  ? rawFilings.filter((f): f is FooterFiling => Boolean(f && typeof f.text === 'string' && f.text))
  : [];

const rawBadges = (yamlConfig as { badges?: unknown }).badges;
export const footerBadges: FooterBadge[] = Array.isArray(rawBadges)
  ? rawBadges.filter((b): b is FooterBadge => Boolean(b && typeof b.text === 'string' && b.text))
  : [];

/**
 * Starfield / meteor background effect (config/site.yaml -> `universe:`).
 *
 * Read here rather than imported directly by the component: `config/site.yaml`
 * values must be normalized in one place, and a component that imports the YAML
 * root would pull in the theme author's sample values for every other key.
 */
export interface UniverseConfig {
  enabled: boolean;
  /** Particle count = ceil(density × viewport width). */
  density: number;
  /** Restrict the effect to dark mode. */
  onlyDark: boolean;
}

const rawUniverse = (yamlConfig as { universe?: { enabled?: unknown; density?: unknown; onlyDark?: unknown } }).universe;
export const universeConfig: UniverseConfig = {
  enabled: rawUniverse?.enabled === true,
  density: typeof rawUniverse?.density === 'number' && rawUniverse.density > 0 ? rawUniverse.density : 0.216,
  onlyDark: rawUniverse?.onlyDark !== false,
};

export interface MournConfig {
  enabled: boolean;
  /** Dates in `M-D` form, e.g. `['4-5', '5-12']`. Quoting them is recommended. */
  days: string[];
  /** `cover` grayscales only the page banner; `page` grayscales the whole page. */
  affect: 'cover' | 'page';
}

/**
 * Mourning-day grayscale (纪念日/哀悼日变灰).
 *
 * Ported from the previous Hexo blog's anzhiyu `mourn` option, which ran
 * `document.documentElement.style.filter = 'grayscale(1)'` on the home page's
 * first pagination page only (`is_home_first_page()`).
 *
 * Two deliberate differences here:
 *
 *  1. `affect` selects the scope. `page` (default) reproduces the original
 *     whole-page filter; `cover` restricts it to the page banner.
 *  2. The scope is expressed as a class written pre-paint by BootScripts rather
 *     than an inline `filter` on <html>, so the effect never flashes in colour
 *     first.
 */
const rawMourn = (yamlConfig as { mourn?: { enabled?: boolean; days?: unknown; affect?: unknown } }).mourn;
export const mournConfig: MournConfig = {
  enabled: rawMourn?.enabled ?? false,
  days: Array.isArray(rawMourn?.days)
    ? rawMourn.days.map((d) => (typeof d === 'string' ? d.trim() : typeof d === 'number' ? String(d) : '')).filter(Boolean)
    : [],
  affect: rawMourn?.affect === 'cover' ? 'cover' : 'page',
};

const { title, alternate, subtitle } = siteConfig;

export const seoConfig = {
  title: `${alternate ? `${alternate} = ` : ''}${title}${subtitle ? ` = ${subtitle}` : ''}`,
  description: siteConfig.description,
  keywords: siteConfig?.keywords?.join(',') ?? '',
  url: siteConfig.site,
};

const BUILT_IN_COVERS = Array.from({ length: 21 }, (_, i) => `/img/cover/${i + 1}.webp`);
export const defaultCoverList = yamlConfig?.defaultCoverList?.length ? yamlConfig.defaultCoverList : BUILT_IN_COVERS;

// Map YAML comment config
export const commentConfig: CommentConfig = yamlConfig.comment || {};

// Map YAML analytics config
export const analyticsConfig: AnalyticsConfig = yamlConfig.analytics || {};

const _umami = analyticsConfig?.umami;

/** Pre-computed site-wide pageview stats config. null when disabled or token missing. */
export const umamiSiteStatsConfig: UmamiStatsConfig | null =
  _umami?.enabled && _umami.statistics_display?.token && _umami.statistics_display?.footer_site_stats
    ? createUmamiStatsConfig(_umami)
    : null;

/** Create per-page article stats config. Returns null when disabled or token missing. */
export function createArticleStatsConfig(href: string): UmamiStatsConfig | null {
  return _umami?.enabled && _umami.statistics_display?.token && _umami.statistics_display?.article_page_views
    ? createUmamiStatsConfig(_umami, href)
    : null;
}

// Map YAML christmas config with defaults
export const christmasConfig: ChristmasConfig = yamlConfig.christmas || {
  enabled: false,
  features: {
    snowfall: true,
    christmasColorScheme: true,
    christmasCoverDecoration: true,
    christmasHat: true,
    readingTimeSnow: true,
  },
  snowfall: {
    speed: 0.5,
    intensity: 0.7,
    mobileIntensity: 0.4,
    maxLayers: 6,
    maxIterations: 8,
    mobileMaxLayers: 4,
    mobileMaxIterations: 6,
  },
};

// Map YAML bgm config
export const bgmConfig: { enabled: boolean; metingApi?: string; audio: BgmAudioGroup[] } = {
  enabled: yamlConfig.bgm?.enabled ?? (yamlConfig.bgm?.audio?.length ?? 0) > 0,
  metingApi: yamlConfig.bgm?.metingApi,
  audio: yamlConfig.bgm?.audio ?? [],
};

// Bangumi media tracking config — null when disabled (section commented out in YAML)
export const bangumiConfig: BangumiConfig | null = yamlConfig.bangumi ?? null;

/** Validated opt-in moments configuration. Disabled when the YAML section is absent. */
export const momentsConfig = normalizeMomentsConfig(yamlConfig.moments, {
  reservedRoutes: RESERVED_ROUTES,
  localeCodes: enabledLocaleCodes,
  seriesSlugs: enabledSeriesSlugList,
});

const momentsRouters = resolveMomentsNavigation(
  resolveEditorNavigation(yamlConfig.navigation ?? DEFAULT_ROUTERS, editorConfig),
  momentsConfig,
);

// Navigation routers with resolved feature placeholders and auto-injected bangumi entry
export const routers: RouterItem[] = bangumiConfig
  ? [
      ...momentsRouters,
      {
        name: bangumiConfig.label,
        nameKey: bangumiConfig.label ? undefined : 'nav.bangumi',
        path: '/bangumi',
        icon: bangumiConfig.icon ?? 'ri:bilibili-fill',
      },
    ]
  : momentsRouters;

// Map YAML dev tools config with defaults (dev only)
export const devConfig: DevConfig = {
  localProjectPath: yamlConfig.dev?.localProjectPath ?? '',
  contentRelativePath: yamlConfig.dev?.contentRelativePath ?? 'src/content/blog',
  editors: yamlConfig.dev?.editors ?? [],
};

/** All configured series slugs (lowercase) */
export const configuredSeriesSlugs = new Set(featuredSeriesList.map((series) => series.slug));

/** Only enabled series slugs (lowercase) */
export const enabledSeriesSlugs = new Set(enabledSeriesSlugList);
