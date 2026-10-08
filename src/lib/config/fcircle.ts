import type { FcircleConfig, ResolvedFcircleConfig, RouterItem } from './types';

const FCIRCLE_PATH = '/fcircle';

export const FCIRCLE_DEFAULTS: ResolvedFcircleConfig = {
  enabled: false,
  title: '朋友圈',
  description: '看看友链们最近写了什么',
  pageSize: 30,
  topTips: '订阅友链最新文章',
  topBackground: '',
};

const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

/**
 * Resolve the raw `fcircle:` YAML section.
 *
 * Wrongly typed fields fall back to their default rather than throwing — a bad
 * config should not break the whole build. `enabled` defaults to **false**: the
 * page only appears once it is explicitly switched on, so an unconfigured fork
 * does not ship a half-working page.
 */
export function normalizeFcircleConfig(raw?: Partial<FcircleConfig> | null): ResolvedFcircleConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  const pageSize = Number(source.pageSize);

  return {
    enabled: source.enabled === true,
    title: str(source.title, FCIRCLE_DEFAULTS.title),
    description: str(source.description, FCIRCLE_DEFAULTS.description),
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : FCIRCLE_DEFAULTS.pageSize,
    topTips: str(source.topTips, FCIRCLE_DEFAULTS.topTips),
    topBackground: typeof source.topBackground === 'string' ? source.topBackground.trim() : '',
  };
}

/**
 * Drop the `/fcircle` navigation entry when the feature is disabled, so the menu
 * never links to a page that is not built.
 */
export function resolveFcircleNavigation(items: readonly RouterItem[], config: ResolvedFcircleConfig): RouterItem[] {
  if (config.enabled) return [...items];

  return items.flatMap((item): RouterItem[] => {
    const path = item.path?.split(/[?#]/, 1)[0].replace(/\/+$/, '');
    if (path === FCIRCLE_PATH) return [];

    if (!item.children) return [item];
    const children = resolveFcircleNavigation(item.children, config);
    // A group whose only child was the fcircle link collapses away entirely.
    if (!item.path && children.length === 0) return [];
    return [{ ...item, children }];
  });
}
