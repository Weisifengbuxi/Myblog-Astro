/**
 * Motion configuration normalization.
 *
 * Single source of truth for `motion:` defaults in `config/site.yaml`.
 * Defaults are applied per field, so a partial YAML section keeps the defaults
 * for every field it does not mention.
 */

import type {
  ClickEffectKind,
  ClickShowTextConfig,
  MotionConfig,
  MotionLevel,
  ResolvedClickShowTextConfig,
  ResolvedMotionConfig,
} from './types';

export const MOTION_LEVELS: readonly MotionLevel[] = ['lively', 'subtle', 'reduced'];

/** Which click effect plays. `text` matches the previous blog. */
export const CLICK_EFFECT_KINDS: readonly ClickEffectKind[] = ['text', 'petals'];

export const MOTION_DEFAULTS: ResolvedMotionConfig = {
  level: 'lively',
  heroPetals: true,
  clickBurst: true,
  clickEffect: 'text',
};

export const CLICK_SHOW_TEXT_DEFAULTS: ResolvedClickShowTextConfig = {
  text: [],
  fontSize: '20px',
  colors: [],
};

export function isMotionLevel(value: unknown): value is MotionLevel {
  return MOTION_LEVELS.includes(value as MotionLevel);
}

export function isClickEffectKind(value: unknown): value is ClickEffectKind {
  return CLICK_EFFECT_KINDS.includes(value as ClickEffectKind);
}

/**
 * Resolve the raw `motion:` YAML section into a fully populated config.
 * Values of the wrong type fall back to the default for that field.
 */
export function normalizeMotionConfig(raw?: Partial<MotionConfig> | null): ResolvedMotionConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    level: isMotionLevel(source.level) ? source.level : MOTION_DEFAULTS.level,
    heroPetals: typeof source.heroPetals === 'boolean' ? source.heroPetals : MOTION_DEFAULTS.heroPetals,
    clickBurst: typeof source.clickBurst === 'boolean' ? source.clickBurst : MOTION_DEFAULTS.clickBurst,
    clickEffect: isClickEffectKind(source.clickEffect) ? source.clickEffect : MOTION_DEFAULTS.clickEffect,
  };
}

/** Keep only non-empty strings; also used to drop blank YAML list items. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

/**
 * Resolve the raw `clickShowText:` YAML section.
 *
 * An empty `text` pool disables the effect — the runtime checks the array
 * length rather than a separate `enable` flag, so there is one source of truth.
 */
export function normalizeClickShowTextConfig(raw?: Partial<ClickShowTextConfig> | null): ResolvedClickShowTextConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    text: stringList(source.text),
    fontSize:
      typeof source.fontSize === 'string' && source.fontSize.trim()
        ? source.fontSize.trim()
        : CLICK_SHOW_TEXT_DEFAULTS.fontSize,
    colors: stringList(source.colors),
  };
}
