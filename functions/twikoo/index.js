/**
 * Twikoo 评论代理（EdgeOne Pages Function）。
 *
 * 为什么用 EdgeOne 而不是 Cloudflare：`*.workers.dev` 在国内被 DNS 污染（解析到
 * Facebook/Dropbox 的 IP，连接超时），国内访客根本连不上；而 EdgeOne 就在本站的
 * 部署平台上，国内节点可达，也不需要动 DNS。
 *
 * 作用：
 * 1. 前端改成同源地址 `https://www.weisifengbuxi.top/twikoo` —— 请求不再跨域，
 *    彻底躲开 CORS / 混合内容这类问题；
 * 2. 隐藏 Vercel 源站，只暴露本站域名；
 * 3. 可选限速：在 EdgeOne Pages 绑定 KV 到环境变量 `RATE_LIMIT_KV` 后，
 *    同一 IP 每分钟超过 60 次直接 429，刷接口的流量不会打到 Vercel；
 * 4. 后端挂了/被暂停时返回结构化 502，而不是把裸错误抛给访客。
 *
 * 路由：/functions/twikoo/index.js → /twikoo，/functions/twikoo/[[default]].js → /twikoo/*。
 */
/** 默认源站。想换后端（比如迁到 Netlify / 新 Vercel 项目）时，
 *  不用改代码：在 EdgeOne Pages 项目里加个环境变量 TWIKOO_ORIGIN 即可覆盖。 */
const DEFAULT_ORIGIN = 'https://twikoo.weisifengbuxi.top';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? request.headers.get('eo-client-ip') ?? 'unknown';
}

/** 绑定了 KV 才限速；没绑定就原样放行，不影响功能。 */
async function isRateLimited(request, env) {
  const kv = env?.RATE_LIMIT_KV;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return false;

  const bucket = Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  const key = `twikoo:${clientIp(request)}:${bucket}`;
  try {
    const current = Number((await kv.get(key)) ?? 0);
    if (current >= RATE_LIMIT_MAX) return true;
    await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2 });
    return false;
  } catch {
    // KV 抖动时宁可放行，别把评论锁死
    return false;
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function onRequestGet() {
  return json({ code: 405, message: 'Twikoo 代理只接受 POST 请求' }, 405);
}

export async function onRequestPost({ request, env }) {
  if (await isRateLimited(request, env)) {
    return json({ code: 429, message: '请求过于频繁，请稍后再试' }, 429);
  }

  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json');
  const ua = request.headers.get('user-agent');
  if (ua) headers.set('User-Agent', ua);
  const ip = clientIp(request);
  if (ip && ip !== 'unknown') headers.set('X-Forwarded-For', ip);

  // 先缓冲再转发：Twikoo 的请求体是几 KB 的 JSON，缓冲没有压力，
  // 而直接透传 ReadableStream 在部分运行时（如 Node 的 fetch）需要 duplex 选项，容易踩坑。
  let payload;
  try {
    payload = await request.arrayBuffer();
  } catch {
    return json({ code: 400, message: '请求体读取失败' }, 400);
  }

  try {
    const origin = env?.TWIKOO_ORIGIN?.trim() || DEFAULT_ORIGIN;
    const upstream = await fetch(origin, { method: 'POST', headers, body: payload });
    const outHeaders = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) outHeaders.set(key, value);
    outHeaders.delete('set-cookie');
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch {
    return json({ code: 502, message: '评论服务暂时不可用' }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  return onRequestGet();
}
