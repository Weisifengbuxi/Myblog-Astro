import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResolvedClickShowTextConfig } from '@lib/config/types';
import { holdClickText, pickClickColor, setupClickText } from './click-text';

/** Mirrors the checked-in clickShowText: section (社会主义核心价值观). */
const TEST_CONFIG: ResolvedClickShowTextConfig = {
  text: ['富强', '民主', '文明', '和谐', '自由', '平等', '公正', '法治', '爱国', '敬业', '诚信', '友善'],
  fontSize: '20px',
  colors: [],
};

/**
 * The effect reads `clickShowTextConfig` from `config/site.yaml` at import time,
 * so these tests assert the *behaviour* wired to real config (the 12 社会主义核心
 * 价值观 words, 20px, random colours) rather than re-declaring the pool.
 */

class FakeFlight {
  cancelCount = 0;
  pauseCount = 0;
  playCount = 0;
  private reject!: (error: Error) => void;
  finished = new Promise<void>((_resolve, reject) => {
    this.reject = reject;
  });

  cancel() {
    this.cancelCount += 1;
    this.reject(new Error('cancelled'));
  }

  pause() {
    this.pauseCount += 1;
  }

  play() {
    this.playCount += 1;
  }
}

interface Keyframe {
  opacity?: number | string;
  scale?: string;
  translate?: string;
}

class FakeElement extends EventTarget {
  isConnected = true;
  className = '';
  textContent = '';
  dataset = { motion: 'lively' };
  children: FakeElement[] = [];
  keyframes: Keyframe[] = [];
  style: Record<string, unknown> & {
    setProperty: () => void;
    removeProperty: (name: string) => void;
  };

  constructor(readonly flights: FakeFlight[]) {
    super();
    this.style = {
      setProperty: () => {},
      removeProperty: (name: string) => {
        if (name === 'view-transition-name') this.style.viewTransitionName = '';
      },
    };
  }

  closest(selector: string) {
    return selector.startsWith('a[href]') ? this : null;
  }

  /** Used as the fallback anchor for keyboard-activated clicks (0/0 coords). */
  getBoundingClientRect() {
    return { left: 100, top: 200, width: 40, height: 20, right: 140, bottom: 220, x: 100, y: 200 };
  }

  setAttribute() {}

  append(child: FakeElement) {
    this.children.push(child);
  }

  replaceChildren() {
    this.children = [];
  }

  remove() {
    this.isConnected = false;
  }

  animate(keyframes: Keyframe[]) {
    const flight = new FakeFlight();
    this.keyframes = keyframes;
    this.flights.push(flight);
    return flight;
  }
}

interface Harness {
  flights: FakeFlight[];
  root: FakeElement;
  documentEvents: EventTarget & { documentElement: FakeElement; hidden: boolean; createElement: () => FakeElement };
  press: (x?: number, y?: number) => void;
  restore: () => void;
}

function setupDom(): Harness {
  const previous = new Map(
    ['document', 'window', 'Element', 'MutationObserver', 'getComputedStyle'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );

  const flights: FakeFlight[] = [];
  const root = new FakeElement(flights);
  const documentEvents = new EventTarget();
  const documentMock = Object.assign(documentEvents, {
    documentElement: root,
    body: new FakeElement(flights),
    hidden: false,
    createElement: () => new FakeElement(flights),
  });
  const media = Object.assign(new EventTarget(), { matches: false });
  class FakeMutationObserver {
    constructor() {}
    observe() {}
    disconnect() {}
  }

  Object.defineProperties(globalThis, {
    document: { value: documentMock, configurable: true },
    window: { value: { matchMedia: () => media }, configurable: true },
    Element: { value: FakeElement, configurable: true },
    MutationObserver: { value: FakeMutationObserver, configurable: true },
    getComputedStyle: { value: () => ({ fontSize: '20px' }), configurable: true },
  });

  const press = (x = 20, y = 30, button = 0) => {
    const event = new Event('click');
    Object.defineProperties(event, {
      target: { value: new FakeElement(flights) },
      button: { value: button },
      detail: { value: 1 },
      clientX: { value: x },
      clientY: { value: y },
    });
    documentEvents.dispatchEvent(event);
  };

  return {
    flights,
    root,
    documentEvents: documentMock,
    press,
    restore: () => {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

/** The layer the effect appends to <html>. */
const layerOf = (root: FakeElement) => root.children[0];

/**
 * Install a fresh fake DOM and wire the effect up on it.
 *
 * `setupClickText` is called per test because the module keeps its layer
 * reference for the lifetime of a page; registering twice is exactly what
 * happens when a page is loaded more than once.
 */
function withEffect(run: (dom: Harness) => void | Promise<void>) {
  const dom = setupDom();
  return Promise.resolve()
    .then(() => {
      setupClickText(TEST_CONFIG);
      return run(dom);
    })
    .finally(() => dom.restore());
}

test('a click spawns exactly one word from the configured pool', () =>
  withEffect((dom) => {
    dom.press();

    assert.equal(dom.flights.length, 1);
    const layer = layerOf(dom.root);
    assert.equal(layer.className, 'click-text-layer');
    assert.equal(layer.children.length, 1);

    const word = layer.children[0];
    assert.equal(word.className, 'click-text');
    // 12 社会主义核心价值观 words; assert membership rather than a fixed pick.
    const pool = '富强民主文明和谐自由平等公正法治爱国敬业诚信友善';
    assert.equal(word.textContent.length, 2);
    assert.ok(pool.includes(word.textContent), `unexpected word: ${word.textContent}`);
  }));

test('each click gets a fresh random colour', () =>
  withEffect((dom) => {
    const colors = new Set<string>();
    for (let i = 0; i < 40; i++) {
      dom.press(i, i);
      const layer = layerOf(dom.root);
      colors.add(String(layer.children[layer.children.length - 1].style.color));
    }
    // 40 hsl() hues from a 360-value space: collisions are possible but the
    // point is that the colour is not a single constant.
    assert.ok(colors.size > 5, `expected varied colours, got ${colors.size}`);
    for (const color of colors) assert.match(color, /^hsl\(\d+ \d+% \d+%\)$/);
  }));

test('a configured colour pool replaces the random colours', () =>
  withEffect((dom) => {
    // Re-register with a pinned palette; setup is idempotent per page.
    setupClickText({ ...TEST_CONFIG, colors: ['#ff0000'] });
    dom.press();
    const word = layerOf(dom.root).children[0];
    assert.equal(word.style.color, '#ff0000');
  }));

test('the word animates out from the pointer and fades away', () =>
  withEffect((dom) => {
    dom.press(120, 240);
    const word = layerOf(dom.root).children[0];
    const [start, , , end] = word.keyframes;

    assert.equal(start.opacity, 0);
    assert.match(String(start.translate), /calc\(120px - 50%\)/);
    assert.match(String(start.translate), /calc\(240px - 50%\)/);
    assert.equal(end.opacity, 0);
    // Drifts upward: the final y offset must be above the click point.
    const finalY = Number(/calc\((-?[\d.]+)px - 50%\)/.exec(String(end.translate))?.[1]);
    assert.ok(finalY < 240, `expected upward drift, got y=${finalY}`);
  }));

test('clicks cancel on motion/visibility changes and cannot resume after transition readiness', () =>
  withEffect(async (dom) => {
    dom.press();
    assert.equal(dom.flights.length, 1);

    let ready!: () => void;
    const transitionReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    holdClickText({ ready: transitionReady } as ViewTransition);
    assert.ok(dom.flights.every((flight) => flight.pauseCount === 1));

    dom.root.dataset.motion = 'reduced';
    dom.documentEvents.dispatchEvent(new Event('visibilitychange'));
    ready();
    await transitionReady;
    assert.ok(dom.flights.every((flight) => flight.cancelCount === 1 && flight.playCount === 0));

    dom.root.dataset.motion = 'lively';
    dom.documentEvents.dispatchEvent(new Event('visibilitychange'));
    dom.press();
    assert.equal(dom.flights.length, 2);

    dom.documentEvents.hidden = true;
    dom.documentEvents.dispatchEvent(new Event('visibilitychange'));
    assert.ok(dom.flights.every((flight) => flight.cancelCount === 1));
    dom.press();
    assert.equal(dom.flights.length, 2);
  }));

test('an empty word pool disables the effect', async () => {
  const dom = setupDom();
  try {
    setupClickText({ ...TEST_CONFIG, text: [] });
    dom.press();
    assert.equal(dom.flights.length, 0);
    assert.equal(dom.root.children.length, 0);
  } finally {
    dom.restore();
  }
});

test('a keyboard-activated button anchors the word to its centre', () =>
  withEffect((dom) => {
    // Enter/Space on a button emits `click` with 0/0 coordinates.
    dom.press(0, 0);
    const word = layerOf(dom.root).children[0];
    // FakeElement#getBoundingClientRect → 100,200 40×20, so the centre is 120,210.
    assert.match(String(word.keyframes[0].translate), /calc\(120px - 50%\)/);
    assert.match(String(word.keyframes[0].translate), /calc\(210px - 50%\)/);
  }));

test('secondary mouse buttons do not spawn a word', () =>
  withEffect((dom) => {
    dom.press(10, 10, 2);
    assert.equal(dom.flights.length, 0);
    assert.equal(dom.root.children.length, 0);
  }));
