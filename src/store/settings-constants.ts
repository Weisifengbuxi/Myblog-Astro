/**
 * Settings defaults, localStorage keys, and on-demand webfont metadata.
 *
 * Single source of truth shared by the settings store and the FOUC-prevention script in
 * Layout.astro. Kept free of nanostores so Layout.astro can import it at build time without
 * pulling store side effects into the SSR bundle.
 */

export const FONT_PRESETS = ['round', 'system', 'serif', 'wenkai', 'dingtalk'] as const;
export type FontPreset = (typeof FONT_PRESETS)[number];

export const READER_DEFAULTS = {
  fontPreset: 'round' as FontPreset,
  fontSize: 16,
  lineHeight: 1.8,
  measure: null as number | null,
  justify: false,
};

/** Starting point when the user leaves automatic width through the stepper. */
export const READER_CUSTOM_MEASURE = 65;

/** Prevent malformed localStorage values from creating oversized inline styles. */
export const READER_FONT_FAMILY_MAX_LENGTH = 128;

export const GENERAL_DEFAULTS = {
  scrollProgress: true,
  bgmWidget: true,
  wave: true,
};

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const STORAGE_KEYS = {
  fontPreset: 'reader-font-preset',
  fontFamily: 'reader-font-family',
  fontSize: 'reader-font-size',
  lineHeight: 'reader-line-height',
  measure: 'reader-measure',
  justify: 'reader-justify',
  scrollProgress: 'site-scroll-progress',
  bgmWidget: 'site-bgm-widget',
  motionLevel: 'site-motion-level',
  /** Boolean switch replaced by `motionLevel`; a stored `'true'` still maps to the reduced level. */
  legacyMasterMotion: 'site-master-motion',
  wave: 'site-wave',
} as const;

/**
 * Webfonts injected on demand: nothing is requested until the matching preset is selected.
 *
 * - `wenkai`（霞鹜文楷）来自 jsDelivr 的官方 webfont 包。
 * - `dingtalk`（钉钉进步体）自托管在 `public/fonts/DingTalkJinBuTi/`：文件的 unicode-range
 *   切片是渐进的（只下载页面真正用到的字形块），且不受 jsDelivr 在国内不可达的影响。
 */
export const FONT_STYLESHEETS: Partial<Record<FontPreset, { id: string; href: string }>> = {
  wenkai: { id: 'lxgw-wenkai-webfont', href: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css' },
  dingtalk: { id: 'dingtalk-jinbuti-webfont', href: '/fonts/DingTalkJinBuTi/result.css' },
};
