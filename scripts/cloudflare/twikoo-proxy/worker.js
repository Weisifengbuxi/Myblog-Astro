/**
 * Twikoo 反向代理（Cloudflare Worker，免费版够用）。
 *
 * 目的：把评论请求先过一层 Cloudflare —— Bot Fight Mode、速率限制、隐藏 Vercel 源站，
 * 避免爬虫/刷接口的流量直接吃满 Vercel Hobby 的 Edge Requests 额度（1M/月）。
 *
 * 部署与接入步骤见同目录 README.md。部署前只需要改下面这一行 ORIGIN。
 */

/**
 * Twikoo 后端真实地址。两种接法二选一，**别把 ORIGIN 写成 Worker 自己的入口域名**，
 * 否则请求会在 Worker 上自己调自己，浏览器最终看到 508/522：
 *
 * 1) 前端 envId 直接用 Worker 的 workers.dev 地址（推荐，DNS 不用动）
 *    → ORIGIN 填现有的 https://twikoo.weisifengbuxi.top
 *    链路：浏览器 → workers.dev（Cloudflare）→ twikoo.weisifengbuxi.top（Vercel）
 *
 * 2) 前端 envId 仍用 twikoo.weisifengbuxi.top，并在 EdgeOne DNS 里把 twikoo
 *    这条记录 CNAME 到 workers.dev（域名更好看，但要多改一条 DNS）
 *    → ORIGIN 必须填 Vercel 项目自带的 https://twikoo-xxxx.vercel.app
 *    链路：浏览器 → twikoo.weisifengbuxi.top（CNAME 到 Worker）→ vercel.app（Vercel）
 */
const ORIGIN = 'https://REPLACE_WITH_YOUR_TWIKOO_ORIGIN';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 跨域预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Twikoo 的 API 只有一个 POST 端点；其余路径一律 404，顺手挡掉扫描器
    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '')) {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    // 速率限制：wrangler.toml 里配了 [[unsafe.bindings]] 的 RATE_LIMITER 才会生效
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response(JSON.stringify({ code: 429, message: '请求过于频繁，请稍后再试' }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }

    const upstream = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') ?? 'application/json');
    // 转发真实访客 IP，Twikoo 用它做评论频率限制与地区判断
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Forwarded-For', clientIp);
    headers.set('User-Agent', request.headers.get('User-Agent') ?? 'twikoo-proxy');

    let res;
    try {
      res = await fetch(upstream, { method: 'POST', headers, body: request.body });
    } catch {
      return new Response(JSON.stringify({ code: 502, message: '评论服务暂时不可用' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const outHeaders = new Headers(res.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) outHeaders.set(key, value);
    outHeaders.delete('set-cookie');

    return new Response(res.body, { status: res.status, headers: outHeaders });
  },
};
