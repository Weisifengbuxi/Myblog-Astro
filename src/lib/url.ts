/** Encode path segments without escaping their `/` separators (legacy Hexo permalinks). */
export const encodeSlug = (slug: string) => slug?.split('/').map(encodeURIComponent).join('/') ?? '';

/**
 * 把 `http://` 资源地址升级成 `https://`。
 *
 * 混合内容（HTTPS 页面里请求 http 资源）会让浏览器把**整页**标记成「不安全」——
 * 而这两个头像来源都不受我们控制：友链头像来自 `config/site.yaml`，
 * 朋友圈头像来自定时任务抓取的 `public/fcircle/all.json`（别人的 RSS 里写 http
 * 就会漏进来，而且下次抓取会覆盖掉手工修改）。所以在**渲染时**统一升级，
 * 比逐个修数据可靠。
 *
 * 绝大多数图床/CDN 都支持 https；极少数只支持 http 的站点会加载失败，
 * 那种情况单独走 images.weserv.nl 之类的 https 代理即可。
 */
export function toSecureUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return /^http:\/\//i.test(trimmed) ? `https://${trimmed.slice('http://'.length)}` : trimmed;
}
