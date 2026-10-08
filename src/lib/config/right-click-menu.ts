import type { ResolvedRightClickMenuConfig, RightClickMenuConfig } from './types';

export const RIGHT_CLICK_MENU_DEFAULTS: ResolvedRightClickMenuConfig = {
  enabled: false,
};

/**
 * Resolve the raw `rightClickMenu:` YAML section.
 *
 * Defaults to **false** so an unconfigured fork does not take over the browser's
 * context menu — replacing a native browser affordance should be opt-in.
 * A wrongly typed value falls back to the default instead of throwing.
 */
export function normalizeRightClickMenuConfig(raw?: Partial<RightClickMenuConfig> | null): ResolvedRightClickMenuConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  return { enabled: source.enabled === true };
}
