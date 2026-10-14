/**
 * Twikoo 前端（`twikoo` 包）。
 *
 * 2.0 起包的 `exports` 只放开了 `"."`（→ `dist/twikoo.min.js`，自带样式注入），
 * 深路径 `twikoo/dist/twikoo.nocss.js` 不再可导入，所以这里声明裸包名。
 */
declare module 'twikoo' {
  interface TwikooInitOptions {
    envId: string;
    el: string | HTMLElement;
    region?: string;
    path?: string;
    lang?: string;
    onCommentLoaded?: () => void;
  }

  interface TwikooRecentComment {
    id: string;
    nick: string;
    mailMd5: string;
    link: string;
    comment: string;
    commentText: string;
    url: string;
    created: number;
    avatar: string;
    relativeTime: string;
  }

  export function init(options: TwikooInitOptions): Promise<void>;
  export function getCommentsCount(options: { envId: string; region?: string; urls: string[] }): Promise<number[]>;
  export function getRecentComments(options: {
    envId: string;
    region?: string;
    pageSize?: number;
    includeReply?: boolean;
  }): Promise<TwikooRecentComment[]>;
}
