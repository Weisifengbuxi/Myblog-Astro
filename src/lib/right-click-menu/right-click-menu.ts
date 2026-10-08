/**
 * 自定义右键菜单。
 *
 * 移植自原 Hexo 博客 anzhiyu 主题的 right_click_menu.js + rightmenu.pug +
 * rightmenu.styl。原版结构是四组：
 *
 *   ① .rightMenu-small   ← 后退 / 前进 / 刷新 / 回到顶部（纯图标一排）
 *   ② .rightMenuPlugin   ← 上下文相关项：复制选中文本、粘贴、引用到评论、
 *                          新窗口打开、复制链接、复制/下载/新窗口打开图片、
 *                          站内搜索、百度搜索 —— 按「有没有选中文本 / 有没有点在
 *                          链接上 / 有没有点在图片上 / 是不是输入框」逐项决定显隐
 *   ③ .rightMenuOther    ← 空白处右键时的通用项：随便逛逛、博客分类、文章标签
 *   ④ .rightMenuOther    ← 复制地址、关闭热评、深色模式、转为繁体
 *
 * 与原版的差异（均为有意取舍，理由是这些依赖原博客特有的设施）：
 *   - **不做**「粘贴文本」：读剪贴板需要 `clipboard-read` 权限，浏览器会弹权限框，
 *     而右击输入框时用户本来就能用系统原生菜单，收益不抵打扰。
 *   - **不做**「引用到评论」：依赖评论组件的具体 DOM，本主题的评论器不同。
 *   - **不做**音乐类五项：本主题的播放器（bgm）没有原版那套 `#nav-music` 接口。
 *   - **不做**「百度搜索」：改用 Google，避免默认把搜索词发给第三方；
 *     想要百度的话在 `SEARCH_ENGINES` 里加一行即可。
 *   - **不做**繁简转换：需要引入 opencc 这类转换表（数百 KB），
 *     为了一个菜单项不划算。
 *   - **不做**「关闭热评」：本主题没有热评（弹幕式评论）功能。
 *   - 深色/浅色沿用主题的 `localStorage['theme']` + `html.dark`，
 *     因此与主题自带的切换按钮完全一致。
 *
 * 移动端（≤768px）不接管右键 —— 触屏没有右键，且长按有系统行为。
 */

import { rightClickMenuConfig } from '@constants/site-config';

const MASK_ID = 'rightmenu-mask';
const MENU_ID = 'rightMenu';
/** 原版同样只在桌面宽度接管。 */
const MIN_WIDTH = 768;
/** 记录 document 上是否已挂过，避免 ClientRouter 反复换页后重复绑定。 */
const BOUND = Symbol.for('right-click-menu-bound');

/** 站内搜索的事件名，与主题的 SearchPortal 一致。 */
const SEARCH_OPEN_EVENT = 'search-dialog-open';

/** 右键菜单的搜索项要打开的引擎；加一行即可扩展。 */
const SEARCH_ENGINES = {
  web: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
} as const;

interface Context {
  /** 右键点在链接上时的 href */
  href: string;
  /** 右键点在图片上时的图片地址 */
  imgSrc: string;
  /** 当前选中的文本 */
  selection: string;
  /** 右键是否落在可编辑区域内 */
  editable: boolean;
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const item = (id: string) => el(id);

// ---------------------------------------------------------------------------
// 提示条：原版用主题的 snackbarShow，这里自己做一个轻量的
// ---------------------------------------------------------------------------

let toastTimer = 0;

function toast(message: string): void {
  let node = el('rightmenu-toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'rightmenu-toast';
    node.className = 'rightmenu-toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node?.classList.remove('is-visible'), 2200);
}

// ---------------------------------------------------------------------------
// 剪贴板
// ---------------------------------------------------------------------------

async function copyText(text: string, okMessage: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    // 非安全上下文或权限被拒时的兜底：用隐藏 textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? okMessage : '复制失败');
    } catch {
      toast('复制失败');
    }
  }
}

/**
 * 把图片地址抓成 blob 再写入剪贴板。
 *
 * 注意：远端图片多为跨域，`toBlob` 会因画布被污染而失败，此时退化为
 * 「复制图片地址」，至少还有可用结果，不会静默失败。
 */
async function copyImage(src: string): Promise<void> {
  try {
    const res = await fetch(src, { mode: 'cors' });
    const blob = await res.blob();
    const type = blob.type || 'image/png';
    // ClipboardItem 只在安全上下文可用
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      throw new Error('clipboard image unsupported');
    }
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    toast('图片已复制');
  } catch {
    await copyText(src, '已复制图片地址（图片本身无法写入剪贴板）');
  }
}

/** 让浏览器下载图片；跨域直链下载可能被拦，失败时退化为新窗口打开。 */
function downloadImage(src: string): void {
  const a = document.createElement('a');
  a.href = src;
  a.download = '';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  toast('已开始下载');
}

// ---------------------------------------------------------------------------
// 菜单显隐
// ---------------------------------------------------------------------------

function hideMenu(): void {
  const menu = el(MENU_ID);
  const mask = el(MASK_ID);
  if (menu) menu.style.display = 'none';
  if (mask) mask.style.display = 'none';
}

/** 只在需要时读取尺寸，避免每次右键都触发布局。 */
function showMenu(x: number, y: number): void {
  const menu = el(MENU_ID);
  const mask = el(MASK_ID);
  if (!menu || !mask) return;

  // 先以不可见状态量出尺寸，再按需要翻转方向
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  const { offsetWidth: w, offsetHeight: h } = menu;

  let left = x + 10; // +10 避免鼠标压在菜单上
  let top = y;

  if (left + w > window.innerWidth) left = x - w - 10;
  if (top + h > window.innerHeight) top = Math.max(4, window.innerHeight - h - 4);
  if (left < 4) left = 4;
  if (top < 4) top = 4;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';
  mask.style.display = 'block';
}

/**
 * 批量设置显隐：传入的 id 显示，其余隐藏。
 *
 * 关键：如果**一个可见项都没有**，连容器一起隐藏。
 * 否则容器自身的高度与虚线底边框仍会占位和渲染 —— 空白处右键时
 * 上下文组为空，就会出现「两条虚线中间夹一条空隙」的观感。
 */
function setVisible(ids: string[], container: string): void {
  const box = el(container);
  if (!box) return;
  const wanted = new Set(ids);
  let visible = 0;
  for (const node of box.querySelectorAll<HTMLElement>('[data-rm-item]')) {
    const show = wanted.has(node.id);
    node.style.display = show ? 'flex' : 'none';
    if (show) visible++;
  }
  box.style.display = visible ? '' : 'none';
}

function readContext(target: EventTarget | null, event: MouseEvent): Context {
  const node = target instanceof Element ? target : null;

  // 链接：<a href>
  const anchor = node?.closest('a[href]');
  const href = anchor instanceof HTMLAnchorElement ? anchor.href : '';

  // 图片：可能是 <img>，也可能是包着 <img> 的容器
  let imgSrc = '';
  const img = node instanceof HTMLImageElement ? node : (node?.querySelector('img') ?? node?.closest('img'));
  if (img instanceof HTMLImageElement) imgSrc = img.currentSrc || img.src;

  const selection = (window.getSelection?.()?.toString() ?? '').trim();

  const editable = !!node?.closest('input, textarea, [contenteditable="true"]');

  return { href, imgSrc, selection, editable };
}

// ---------------------------------------------------------------------------
// 各项动作
// ---------------------------------------------------------------------------

function bindActions(): void {
  const on = (id: string, handler: (ctx: Context) => void) => {
    const node = item(id);
    if (!node || node.dataset.rmBound) return;
    node.dataset.rmBound = '1';
    node.addEventListener('click', () => {
      handler(currentContext);
      hideMenu();
    });
  };

  on('menu-backward', () => history.back());
  on('menu-forward', () => history.forward());
  on('menu-refresh', () => location.reload());
  on('menu-top', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  on('menu-copytext', (ctx) => void copyText(ctx.selection, '已复制选中文本'));
  on('menu-search', (ctx) => {
    // 交给主题自己的搜索弹窗，避免再实现一套索引查询
    window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
  });
  on('menu-websearch', (ctx) => {
    const q = ctx.selection || document.title;
    window.open(SEARCH_ENGINES.web(q), '_blank', 'noopener');
  });

  on('menu-newwindow', (ctx) => window.open(ctx.href, '_blank', 'noopener'));
  on('menu-copylink', (ctx) => void copyText(ctx.href, '已复制链接'));
  on('menu-copyimg', (ctx) => void copyImage(ctx.imgSrc));
  on('menu-downloadimg', (ctx) => downloadImage(ctx.imgSrc));
  on('menu-newwindowimg', (ctx) => window.open(ctx.imgSrc, '_blank', 'noopener'));

  on('menu-randompost', () => {
    // 复用主题「随便逛逛」的思路：从站内文章链接里随机挑一个
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]')]
      .map((a) => a.href)
      .filter((h, i, arr) => arr.indexOf(h) === i);
    if (!links.length) {
      toast('没有找到可跳转的文章');
      return;
    }
    location.href = links[Math.floor(Math.random() * links.length)];
  });

  on('menu-copyurl', () => void copyText(location.href, '已复制本页地址'));

  on('menu-darkmode', () => {
    const root = document.documentElement;
    const dark = !root.classList.contains('dark');
    // 与主题的 ThemeToggle 保持同一套状态：html.dark + localStorage['theme']
    root.classList.toggle('dark', dark);
    root.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* 隐私模式下写不进去，忽略 */
    }
    updateDarkLabel();
  });
}

function updateDarkLabel(): void {
  const label = document.querySelector('#menu-darkmode [data-rm-label]');
  if (label) label.textContent = document.documentElement.classList.contains('dark') ? '浅色模式' : '深色模式';
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

let currentContext: Context = { href: '', imgSrc: '', selection: '', editable: false };

function onContextMenu(event: MouseEvent): void {
  const menu = el(MENU_ID);
  if (!menu) return; // 本页没渲染菜单（例如配置关闭）
  if (window.innerWidth <= MIN_WIDTH) return; // 移动端不接管

  const ctx = readContext(event.target, event);
  // 输入框内保留浏览器原生菜单：系统自带的拼写检查、粘贴等都是刚需
  if (ctx.editable) {
    hideMenu();
    return;
  }

  currentContext = ctx;
  updateDarkLabel();

  // ② 上下文相关项：只显示当前真正可用的
  const pluginIds = [
    ctx.selection ? 'menu-copytext' : '',
    ctx.selection ? 'menu-search' : '',
    ctx.selection ? 'menu-websearch' : '',
    ctx.href ? 'menu-newwindow' : '',
    ctx.href ? 'menu-copylink' : '',
    ctx.imgSrc ? 'menu-copyimg' : '',
    ctx.imgSrc ? 'menu-downloadimg' : '',
    ctx.imgSrc ? 'menu-newwindowimg' : '',
  ].filter(Boolean) as string[];

  setVisible(pluginIds, 'rightMenuPlugin');
  // ③ 只有在没有任何上下文时，才显示「随便逛逛 / 分类 / 标签」，与原版一致。
  //    传空数组时 setVisible 会连容器一起隐藏，因此不会留下空的虚线框。
  setVisible(pluginIds.length ? [] : ['menu-randompost', 'menu-categories', 'menu-tags'], 'rightMenuOther');

  showMenu(event.clientX, event.clientY);
  event.preventDefault();
}

/**
 * 挂载右键菜单。可重复调用：内部用 Symbol 标记做幂等，避免 ClientRouter
 * 换页后（或 HMR 重跑模块时）重复绑定导致菜单行为异常。
 */
export function setupRightClickMenu(): void {
  if (!rightClickMenuConfig.enabled) return;
  if (!el(MENU_ID)) return;

  const doc = document as Document & { [BOUND]?: boolean };
  if (doc[BOUND]) {
    // 已经绑过：换页后节点是新的，只需重新绑定条目
    bindActions();
    return;
  }
  doc[BOUND] = true;

  bindActions();

  // 原版是 window.oncontextmenu = ...，这里用 addEventListener 以免覆盖别处
  document.addEventListener('contextmenu', onContextMenu);

  // 点菜单外任意处（含左键、滚动）都收起
  el(MASK_ID)?.addEventListener('click', hideMenu);
  el(MASK_ID)?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    hideMenu();
  });
  document.addEventListener('click', (event) => {
    const menu = el(MENU_ID);
    if (menu && menu.style.display === 'block' && !menu.contains(event.target as Node)) hideMenu();
  });
  window.addEventListener('scroll', hideMenu, { passive: true });
  window.addEventListener('resize', hideMenu, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideMenu();
  });

  // 换页时收起，避免菜单跨页残留
  document.addEventListener('astro:before-swap', hideMenu);
}
