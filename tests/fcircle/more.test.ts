import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the first page is the batch size, so 「显示更多」 reveals exactly one more page per click', async () => {
  const component = await read('src/components/friends/FriendsCircle.astro');

  assert.match(component, /const batchSize = Math\.max\(1, fcircleConfig\.pageSize\)/);
  assert.match(component, /const initialCount = Math\.min\(batchSize, allPosts\.length\)/);
  assert.match(component, /deferred\.slice\(revealed, revealed \+ batch\)/);
});

test('the overflow stays in the HTML but hidden, and a scriptless visitor still sees every entry', async () => {
  const component = await read('src/components/friends/FriendsCircle.astro');

  // Outreach pages are crawlable and survive a failed bundle: only CSS hides them.
  assert.match(component, /data-deferred=\{index >= initialCount \? 'true' : undefined\}/);
  assert.match(component, /:global\(html\[data-motion\]\) \.fcircle-item\[data-deferred\]/);
  // `<html data-motion>` is written pre-paint by BootScripts; without it nothing is hidden
  // and the button (which could not work anyway) is dropped.
  assert.match(component, /:global\(html:not\(\[data-motion\]\)\) \.fcircle-more/);
  assert.doesNotMatch(component, /<noscript>/);
});

test('the control announces progress, hands focus over when it retires, and re-binds after a page swap', async () => {
  const component = await read('src/components/friends/FriendsCircle.astro');

  assert.match(component, /data-fcircle-more-button/);
  assert.match(component, /aria-controls=\{listId\}/);
  assert.match(component, /data-fcircle-status aria-live="polite" tabindex="-1"/);
  assert.match(component, /status\.textContent = formatFcircleLabel\(left > 0 \? shownLabel : doneLabel/);
  assert.match(component, /button\.hidden = left === 0/);
  // Without an explicit rule the component's own `display` would beat the UA `[hidden]` style.
  assert.match(component, /\.fcircle-more-button\[hidden\]/);
  assert.match(component, /if \(finished\) status\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /document\.addEventListener\('astro:page-load', initFcircleMore\)/);
  assert.match(component, /root\.dataset\.fcircleReady === 'true'/);
});

test('revealed entries fade in with the site motion level and respect reduced motion', async () => {
  const component = await read('src/components/friends/FriendsCircle.astro');

  assert.match(component, /item\.dataset\.fcircleAppended = 'true'/);
  assert.match(
    component,
    /@media screen and \(prefers-reduced-motion: no-preference\) \{\s*:global\(html:is\(\[data-motion='lively'\], \[data-motion='subtle'\]\)\) \.fcircle-item\[data-fcircle-appended\]/,
  );
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
});
