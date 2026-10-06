/**
 * Unified layout spacing constants
 *
 * This file defines standardized spacing values for consistent horizontal
 * and vertical spacing across all pages and components.
 */

/**
 * Content area padding for main content blocks
 */
export const CONTENT_PADDING = {
  // Standard content with top spacing
  standard: 'px-10 py-8 tablet:px-6 tablet:pt-6 tablet:pb-2',
  // Content without extra top spacing
  normal: 'px-6 py-4 tablet:px-6',
  // Compact content (for nested items)
  compact: 'px-4 py-2 tablet:px-2 tablet:py-1',
} as const;

/**
 * Max width constraints
 */
export const MAX_WIDTH = {
  // 主内容容器。
  //
  // 原值 max-w-7xl（80rem = 1280px）在 1600px 以上视口会留下很宽的左右留白
  // （实测 1600px 时左 156 / 右 708，1920px 时左 316 / 右 868），因为内容被居中、
  // 侧栏又是固定 256px，剩余宽度全落在右侧。
  //
  // 改为 min(视口 - 6rem, 110rem = 1760px)：
  //   - 宽屏下版心最多 1760px（1920 视口左右各 80px，1600 时各 48px）
  //   - 窄屏下不超过视口，且保底左右各 48px，避免贴边与横向滚动
  //   - 用 min() 而非纯 max-w-[110rem]，是为了小视口也安全
  //
  // 注意：版心变宽后文章卡片也会变宽。封面占比由 PostItem 的 calc(5x%) 决定，
  // 若觉得封面过宽/过窄，调那个比例即可。
  content: 'max-w-[min(100%-6rem,110rem)]',
} as const;

/**
 * Pagination settings
 */
export const PAGINATION = {
  // Posts per page for homepage and post listing
  pageSize: 10,
} as const;
