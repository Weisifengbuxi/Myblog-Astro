import { useEffect, useRef, useState } from 'react';
import { commentConfig } from '@/constants/site-config';
import { useTranslation } from '@/hooks/useTranslation';
import { getHtmlLang, getLocaleFromUrl } from '@/i18n/utils';
import themeStyles from '@/styles/components/twikoo.css?inline';

// Config is module-level static data parsed from YAML at build time - won't change at runtime
const config = commentConfig.twikoo;

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
