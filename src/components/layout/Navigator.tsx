/**
 * Navigator Component
 *
 * Navigation header with scroll-based visibility control.
 * Uses useScrollTrigger hook for optimized scroll handling.
 */

import ThemeToggle from '@components/theme/ThemeToggle';
import { RESERVED_ROUTES } from '@constants/router';
import { configuredSeriesSlugs, enabledSeriesSlugs, routers } from '@constants/site-config';
import { useGlideIndicator } from '@hooks/useGlideIndicator';
import { useIsTablet } from '@hooks/useMediaQuery';
import { useScrollTrigger } from '@hooks/useScrollTrigger';
import { Icon } from '@iconify/react';
import { filterNavItems } from '@lib/utils';
import { memo, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { defaultLocale, localizedPath, resolveNavName, stripLocaleFromPath, t } from '@/i18n';
import DropdownNav from './DropdownNav';
import LanguageSwitcher from './LanguageSwitcher';
import { SearchTrigger } from './SearchTrigger';

interface NavigatorProps {
  currentPath: string;
  locale?: string;
}

// Pre-filter navigation items at module load (config is static)
const filteredRouters = filterNavItems(routers, configuredSeriesSlugs, enabledSeriesSlugs, RESERVED_ROUTES);

const navKey = (item: (typeof filteredRouters)[number]) => `nav:${item.name ?? item.path ?? item.nameKey ?? ''}`;
const languageMenuKey = 'language';

// Icon component for navigation items - uses @iconify/react for dynamic icons.
// Icon data loads asynchronously (Iconify API); the fixed-size wrapper reserves
// space so late icon rendering does not shift nav geometry (which would yank
// hover-opened dropdowns out from under the cursor).
function NavIcon({ name }: { name: string }) {
  return (
    <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <Icon icon={name} className="h-4 w-4" />
    </span>
  );
}

interface ButtonLinkProps {
  url: string;
  label: string;
  isActive: boolean;
  glideKey: string;
  onIntent: () => void;
  children: React.ReactNode;
}

function ButtonLink({ url, label, isActive, glideKey, onIntent, children }: ButtonLinkProps) {
  return (
    <a
      href={url}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      data-glide-key={glideKey}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      className="relative flex items-center px-3 py-2 text-base tracking-wider"
    >
      {children}
    </a>
  );
}

const Navigator = memo(function Navigator({ currentPath, locale = defaultLocale }: NavigatorProps) {
  const { isBeyond, direction } = useScrollTrigger({
    triggerDistance: 0.45,
    throttleMs: 80,
  });

  const isTablet = useIsTablet();
  // Built pages keep their trailing slash ("/friends/"); configured nav paths have none.
  const pagePath = currentPath.replace(/(.)\/$/, '$1');
  const strippedPath = stripLocaleFromPath(pagePath);
  const isPostPageMobile = isTablet && strippedPath.startsWith('/post/');

  const firstScrollRef = useRef(true);
  const [intent, setIntent] = useState<string | null>(null);
  // Share one open menu across pointer and keyboard sessions. A nav dropdown also holds the pill on its trigger.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const activeItem = filteredRouters.find((item) =>
    item.children?.length
      ? item.children.some((child) => child.path && strippedPath.startsWith(child.path))
      : item.path === strippedPath,
  );
  const activeKey = activeItem ? navKey(activeItem) : null;
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useGlideIndicator(navRef, indicatorRef, intent ?? (openKey === languageMenuKey ? null : openKey) ?? activeKey);

  useEffect(() => {
    // Portals live outside the persisted island; close them before Astro replaces the body.
    const closeForNavigation = () => {
      flushSync(() => {
        setOpenKey(null);
        setIntent(null);
      });
    };
    document.addEventListener('astro:before-preparation', closeForNavigation);
    document.addEventListener('astro:before-swap', closeForNavigation);
    return () => {
      document.removeEventListener('astro:before-preparation', closeForNavigation);
      document.removeEventListener('astro:before-swap', closeForNavigation);
    };
  }, []);

  // Apply with-background class based on scroll position
  useEffect(() => {
    document.getElementById('site-header')?.classList.toggle('with-background', isBeyond);
  }, [isBeyond]);

  // Handle header visibility based on scroll
  useEffect(() => {
    const siteHeader = document.getElementById('site-header');
    const mobileMenuContainer = document.getElementById('mobile-menu-container');

    // Skip first scroll
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      return;
    }

    // Post page mobile: keep header visible during scroll
    if (isPostPageMobile) {
      // Ensure header is visible
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');
      return;
    }

    // Normal behavior: hide on scroll down, show on scroll up
    if (direction === 'down') {
      siteHeader?.classList.add('-translate-y-full');
      mobileMenuContainer?.classList.add('-translate-y-full');
    } else if (direction === 'up') {
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');
    }
  }, [direction, isPostPageMobile]);

  return (
    <div className="tablet:col-start-3 flex grow tablet:grow-0 items-center tablet:justify-self-end">
      {/* Desktop navigation */}
      <nav
        ref={navRef}
        className="relative isolate flex tablet:hidden grow items-center"
        onPointerLeave={() => setIntent(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIntent(null);
        }}
      >
        <span ref={indicatorRef} aria-hidden="true" className="nav-indicator" />
        {filteredRouters.map((item) => {
          const displayName = resolveNavName(item.nameKey, item.name, locale);
          const key = navKey(item);
          if (item.children?.length) {
            return (
              <DropdownNav
                key={item.path ?? item.name}
                item={item}
                currentPath={pagePath}
                locale={locale}
                glideKey={key}
                onIntent={() => setIntent(key)}
                open={openKey === key}
                onOpenChange={(open) => setOpenKey((current) => (open ? key : current === key ? null : current))}
              />
            );
          }
          if (!item.path || !displayName) return null;
          const localizedUrl = item.localeIndependent ? item.path : localizedPath(item.path, locale);
          return (
            <ButtonLink
              key={item.path}
              url={localizedUrl}
              label={displayName}
              isActive={item.path === strippedPath}
              glideKey={key}
              onIntent={() => setIntent(key)}
            >
              {item.icon && <NavIcon name={item.icon} />}
              {displayName}
            </ButtonLink>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* 开往：随机拜访一位成员博客（移植自旧博客导航栏右侧的「开往」按钮） */}
        <a
          href="https://www.travellings.cn/go.html"
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={t(locale, 'nav.travellingsTitle')}
          title={t(locale, 'nav.travellingsTitle')}
          className="size-10 flex-center cursor-pointer rounded-full transition-[background-color,scale] duration-200 ease-out-quart hover:bg-current/15 active:scale-90"
        >
          {/* 图标尺寸对齐旁边的搜索按钮（size-7） */}
          <Icon icon="ri:train-line" className="size-7" />
        </a>
        <SearchTrigger />
        <div className="tablet:hidden flex-center">
          <LanguageSwitcher
            locale={locale}
            open={openKey === languageMenuKey}
            onOpenChange={(open) =>
              setOpenKey((current) => (open ? languageMenuKey : current === languageMenuKey ? null : current))
            }
          />
        </div>
        <ThemeToggle locale={locale} />
      </div>
    </div>
  );
});

export default Navigator;
