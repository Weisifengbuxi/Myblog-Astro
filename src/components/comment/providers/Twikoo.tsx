import { useEffect, useRef, useState } from 'react';
import { commentConfig } from '@/constants/site-config';
import { useTranslation } from '@/hooks/useTranslation';
import { getHtmlLang, getLocaleFromUrl } from '@/i18n/utils';
import themeStyles from '@/styles/components/twikoo.css?inline';

// Config is module-level static data parsed from YAML at build time - won't change at runtime
const config = commentConfig.twikoo;

/** 探活超时：后端起不来时别让评论区一直转圈 */
const BACKEND_PROBE_TIMEOUT_MS = 6000;
/** 探活结果缓存时长：同一会话里翻文章不必每页都多打一次请求 */
const BACKEND_PROBE_CACHE_MS = 5 * 60 * 1000;
const BACKEND_PROBE_CACHE_KEY = 'twikoo-backend-reachable';

function readProbeCache(): boolean | null {
  try {
    const raw = sessionStorage.getItem(BACKEND_PROBE_CACHE_KEY);
    if (!raw) return null;
    const { at, ok } = JSON.parse(raw) as { at: number; ok: boolean };
    if (typeof at !== 'number' || Date.now() - at > BACKEND_PROBE_CACHE_MS) return null;
    return Boolean(ok);
  } catch {
    return null;
  }
}

function writeProbeCache(ok: boolean) {
  try {
    sessionStorage.setItem(BACKEND_PROBE_CACHE_KEY, JSON.stringify({ at: Date.now(), ok }));
  } catch {
    // 隐私模式下 sessionStorage 可能不可写，忽略即可
  }
}

/**
 * 评论后端探活。
 *
 * Twikoo 的 `init()` 遇到网络/跨域失败不会抛异常，而是把它自己渲染成一行红字
 * （例如后端部署被停用时返回 402 且没有 CORS 头，浏览器只报「请求被跨域策略拦截 status 0」），
 * 访客看到的那串技术错误既吓人又没信息量。所以先自己发一次 GET_CONFIG：
 * 拿不到响应、或拿到 402/5xx，就当作后端不可用，直接走组件自己的友好提示。
 *
 * 结果按会话缓存 5 分钟，避免每打开一篇文章就多一次请求（评论后端是按请求量计费的）。
 */
async function isBackendReachable(envId: string): Promise<boolean> {
  const cached = readProbeCache();
  if (cached !== null) return cached;

  try {
    const res = await fetch(envId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'GET_CONFIG' }),
      signal: AbortSignal.timeout(BACKEND_PROBE_TIMEOUT_MS),
    });
    const ok = !(res.status === 402 || res.status >= 500);
    writeProbeCache(ok);
    return ok;
  } catch {
    writeProbeCache(false);
    return false;
  }
}

function TwikooSkeleton() {
  return (
    <div className="twikoo-skeleton animate-pulse space-y-4 px-4" aria-hidden="true">
      {/* Avatar + meta inputs row */}
      <div className="flex gap-3">
        <div className="size-10 shrink-0 rounded-full bg-muted" />
        <div className="flex flex-1 gap-2">
          <div className="h-10 flex-1 rounded bg-muted" />
          <div className="hidden h-10 flex-1 rounded bg-muted sm:block" />
          <div className="hidden h-10 flex-1 rounded bg-muted sm:block" />
        </div>
      </div>
      {/* Textarea */}
      <div className="h-[150px] rounded bg-muted" />
      {/* Action row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="size-6 rounded bg-muted" />
          <div className="size-6 rounded bg-muted" />
        </div>
        <div className="h-9 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function Twikoo() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!config || !containerRef.current) return;
    let active = true;

    const initTwikoo = async () => {
      if (!containerRef.current) return;
      setStatus('loading');
      // Clear container to avoid duplicate init (Twikoo has no destroy/update API)
      containerRef.current.innerHTML = '';

      // 后端不可用就先别挂 Twikoo，免得访客看到「请求被跨域策略拦截」这类原始报错
      const reachable = await isBackendReachable(config.envId);
      if (!active) return;
      if (!reachable) {
        console.warn('[Twikoo] Comment backend unreachable, showing fallback notice.');
        setStatus('error');
        return;
      }

      const locale = getLocaleFromUrl(window.location.pathname);
      try {
        // 2.0 的包 `exports` 只放开 "."（→ dist/twikoo.min.js，加载时把自带样式注入 <head>），
        // 深路径的 nocss.js / twikoo.css 已经不可导入，所以这里直接引裸包名。
        // 动态 import：UMD 产物约 350KB 且加载时就访问 document，懒加载最省事。
        const { init } = await import('twikoo');
        if (!containerRef.current) return;
        await init({
          envId: config.envId,
          el: containerRef.current,
          region: config.region,
          path: config.path ?? window.location.pathname,
          lang: config.lang ?? getHtmlLang(locale),
        });
        if (active) setStatus('ready');
      } catch (error) {
        console.error('[Twikoo] Failed to initialize:', error);
        if (active) setStatus('error');
      }
    };

    void initTwikoo();
    return () => {
      active = false;
    };
  }, []);

  if (!config) return null;

  return (
    <>
      {/*
        只放主题自己的覆盖样式：Twikoo 2.0 的基础样式由包在加载时注入 <head>，
        本组件渲染的 <style> 在 body 里、文档顺序更靠后，同优先级下覆盖照样生效。
      */}
      <style>{themeStyles}</style>
      <div className="px-4">
        {status === 'loading' && <TwikooSkeleton />}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 text-center">
            <p className="text-muted-foreground text-sm">{t('comment.error')}</p>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-opacity hover:opacity-90"
              onClick={() => window.location.reload()}
            >
              {t('comment.retry')}
            </button>
          </div>
        )}
        <div ref={containerRef} id="tcomment" className={status === 'ready' ? undefined : 'hidden'} />
      </div>
    </>
  );
}
