/**
 * Click effect: a word springs out of the pointer and floats away.
 *
 * Ported from the previous blog's `ClickShowText` (anzhiyu consumed
 * butterfly-extsrc's `click-show-text.min.js` with `data-text`,
 * `data-fontsize` and `data-random`). That build had no colour randomization,
 * so this reimplements the effect and adds one: **every click gets a fresh
 * random colour** unless `clickShowText.colors` pins a palette.
 *
 * The word pool is the 社会主义核心价值观 from the original config, which is why
 * `motion.clickEffect` defaults to `text`.
 *
 * Shares the click-burst layer contract with the petal burst: the layer lives on
 * <html> so it survives ClientRouter swaps, carries a view-transition-name while
 * words are airborne so a navigation shows it live rather than frozen, and holds
 * still while the page itself is frozen.
 */

import type { ResolvedClickShowTextConfig } from '@lib/config/types';
import { readMotionLevel, subscribeMotionLevel } from '@lib/motion-level';

const INTERACTIVE = 'a[href], button, [role="button"], summary, label[for]';
const EXCLUDED = 'input, textarea, select, [contenteditable="true"], [data-no-click-text]';
const LAYER_NAME = 'click-text';
const LAYER_CLASS = 'click-text-layer';

let layer: HTMLDivElement | null = null;
const flights = new Set<Animation>();

/**
 * Config for the active instance.
 *
 * Injected through {@link setupClickText} rather than imported directly: it keeps
 * this module free of the YAML import chain, so the behaviour can be unit-tested
 * under plain `node --test` (see `click-text.test.ts`).
 */
let config: ResolvedClickShowTextConfig | null = null;

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Reuse one hidden probe to read the configured font-size back as pixels. */
let fontProbe: HTMLSpanElement | null = null;
function fontSizePx(): number {
  const raw = config?.fontSize ?? '20px';
  const parsed = Number.parseFloat(raw);
  if (/^\s*[\d.]+px\s*$/.test(raw) && Number.isFinite(parsed)) return parsed;

  // A non-px unit (rem/em/…): measure it once against a hidden element.
  if (!fontProbe) {
    fontProbe = document.createElement('span');
    fontProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px';
    document.body.append(fontProbe);
  }
  fontProbe.style.fontSize = raw;
  const measured = Number.parseFloat(getComputedStyle(fontProbe).fontSize);
  return Number.isFinite(measured) ? measured : 20;
}

/**
 * Colours for the glyph. Configured pool wins; otherwise generate a fresh
 * random hue per click with saturated, mid-light colours that stay legible on
 * both the light page and the dark cover.
 */
export function pickClickColor(): string {
  const pool = config?.colors ?? [];
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.round(random(72, 96));
  const lightness = Math.round(random(46, 62));
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function pickWord(): string {
  const pool = config?.text ?? [];
  return pool[Math.floor(Math.random() * pool.length)];
}

function ensureLayer(): HTMLDivElement {
  if (layer?.isConnected) return layer;
  const next = document.createElement('div');
  next.className = LAYER_CLASS;
  next.setAttribute('aria-hidden', 'true');
  // Start from a clean slate — a stale layer could still hold cancelled words.
  next.replaceChildren();
  document.documentElement.append(next);
  layer = next;
  return next;
}

/**
 * Spring the word out of (x, y): a quick pop, a drift upward, then a fade.
 *
 * `translate` keeps the glyph centred on the pointer and carries the drift;
 * `scale` and `rotate` are baked into separate properties so the browser can
 * composite them without re-running layout.
 */
function floatWordAt(x: number, y: number): void {
  const host = ensureLayer();
  host.style.viewTransitionName = LAYER_NAME;

  const size = fontSizePx();
  const driftX = random(-26, 26);
  const driftY = -(size * random(3.2, 4.6));
  const tilt = random(-18, 18);
  const duration = random(900, 1250);

  const word = document.createElement('span');
  word.className = 'click-text';
  word.textContent = pickWord();
  word.style.fontSize = `${size}px`;
  word.style.color = pickClickColor();
  host.append(word);

  // The keyframes own `translate`, so they also carry the centring offset
  // (`-50%`); setting it inline as well would just be overridden.
  const centred = (px: number, py: number) => `calc(${px}px - 50%) calc(${py}px - 50%)`;

  const animation = word.animate(
    [
      { offset: 0, opacity: 0, scale: '0.4', rotate: '0deg', translate: centred(x, y) },
      { offset: 0.22, opacity: 1, scale: '1.08' },
      { offset: 0.42, opacity: 1, scale: '1' },
      {
        offset: 1,
        opacity: 0,
        scale: '0.92',
        rotate: `${tilt}deg`,
        translate: centred(x + driftX, y + driftY),
      },
    ],
    { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
  );

  flights.add(animation);
  animation.finished
    .catch(() => {})
    .finally(() => {
      word.remove();
      flights.delete(animation);
      if (flights.size === 0) host.style.removeProperty('view-transition-name');
    });
}

/** Freeze airborne words while a view transition has the page frozen, then resume. */
export function holdClickText(transition: ViewTransition): void {
  if (flights.size === 0) return;
  for (const flight of flights) flight.pause();
  const resume = () => {
    for (const flight of flights) flight.play();
  };
  transition.ready.then(resume, resume);
}

/**
 * Wire the click effect up. No-op when the word pool is empty, so removing
 * `clickShowText.text` from the config disables it without touching code.
 */
export function setupClickText(options: ResolvedClickShowTextConfig): void {
  // Drop any layer left over from a previous registration (a reload, or a test
  // suite running several cases in one process) so each setup starts clean.
  layer?.replaceChildren();
  layer = null;
  config = options;
  if (!options.text.length) return;

  const stopWhenDisabled = () => {
    if (!document.hidden && readMotionLevel() === 'lively') return;
    for (const flight of flights) flight.cancel();
    flights.clear();
    layer?.replaceChildren();
    layer?.style.removeProperty('view-transition-name');
  };
  subscribeMotionLevel(stopWhenDisabled);
  document.addEventListener('visibilitychange', stopWhenDisabled);
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(INTERACTIVE) || target.closest(EXCLUDED)) return;
      if (document.hidden || readMotionLevel() !== 'lively') return;
      floatWordAt(event.clientX, event.clientY);
    },
    { passive: true },
  );
  document.addEventListener('astro:before-swap', (event) => holdClickText(event.viewTransition));
}
