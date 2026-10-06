#!/usr/bin/env node
/**
 * Post-processes the migrated Markdown so that Hexo/anzhiyu tag plugins
 * render correctly under astro-koharu.
 *
 * Handled:
 *   {% image URL %}                 -> ![alt](URL)
 *   {% link T, URL, ... %}          -> [T](URL)
 *   {% note TYPE no-icon %}...{% endnote %} -> :::TYPE no-icon ... :::
 *   {% label TEXT COLOR %}          -> `TEXT`
 *   {% checkbox [attrs,] TEXT %}    -> - [ ] / - [x] TEXT
 *   {% raw %}...{% endraw %}        -> unwrapped
 *   {% tabs X %} / {% endtabs %}    -> ;;;tab1 X / ;;;
 *   <!-- tab NAME--> / <!-- endtab --> -> ;;;tab1 NAME / ;;;
 *   {% del ... %} / {% psw ... %}   -> ~~...~~ / !!!...!!
 *   /posts/<abbrlink>.html          -> /post/<abbrlink>
 *   </br>                           -> newline
 */
import fs from 'node:fs';
import path from 'node:path';

const BLOG = 'D:\\myBlog-astro\\src\\content\\blog';
const report = [];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

/** Strip surrounding quotes. */
const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

function convertTags(src, stats) {
  const hit = (k) => {
    stats[k] = (stats[k] ?? 0) + 1;
  };

  // --- {{% raw %}} / {% raw %}: unwrap protected HTML --------------------------
  src = src.replace(/\{%-?\s*raw\s*-?%\}/g, () => (hit('raw'), ''));
  src = src.replace(/\{%-?\s*endraw\s*-?%\}/g, () => (hit('raw'), ''));

  // --- {% image URL[, width=NN%] %} ------------------------------------------
  // Note: anchored on the literal `image ` keyword and the closing `%}` rather
  // than on `[^%]+`, because the width argument itself contains a `%`
  // (`width=95%`), which would otherwise stop the match early and leave the tag
  // unrendered.
  //
  // Hexo's `width=` only feeds its lightbox script; emitting it as a Shoka
  // attribute would produce an invalid `width` attribute on the wrapping <p>
  // (the syntax applies to the block, not the <img>). Instead, images that
  // requested a width are centred in a <div>, matching the convention already
  // used throughout these posts.
  src = src.replace(/\{%-?\s*image\s+([\s\S]*?)\s*%\}/g, (_, body) => {
    hit('image');
    const [rawUrl, ...rest] = body.split(',');
    const url = rawUrl.trim();
    const attrs = rest.join(',').trim();
    const alt = decodeURIComponent((url.split('/').pop() ?? 'image').split('?')[0]);
    const img = `![${alt}](${url})`;
    const hasWidth = /width\s*=/i.test(attrs);
    if (hasWidth) hit('image-width');
    return hasWidth ? `\n<div class="text-center">\n\n${img}\n\n</div>\n` : img;
  });

  // --- {% link TITLE, URL, ... %} --------------------------------------------
  src = src.replace(/\{%-?\s*link\s+([^%]+?)\s*-?%\}/g, (_, body) => {
    hit('link');
    const parts = body.split(',').map((p) => p.trim());
    const title = parts[0];
    const url = (parts[1] ?? '').replace(/\s+/g, '');
    return url ? `[${title}](${url})` : title;
  });

  // --- {% note TYPE no-icon %} ... {% endnote %} -----------------------------
  src = src.replace(
    /\{%-?\s*note\s+([^%]+?)\s*-?%\}([\s\S]*?)\{%-?\s*endnote\s*-?%\}/g,
    (_, args, body) => {
      hit('note');
      const a = args.trim().split(/\s+/);
      const style = a[0] || 'default';
      const noIcon = a.includes('no-icon') ? ' no-icon' : '';
      return `:::${style}${noIcon}\n${body.trim()}\n:::`;
    }
  );

  // --- {% label TEXT COLOR %} -------------------------------------------------
  src = src.replace(/\{%-?\s*label\s+([^%]+?)\s*-?%\}/g, (_, body) => {
    hit('label');
    const parts = body.trim().split(/\s+/);
    if (parts.length > 1) parts.pop(); // drop the colour argument
    return `\`${parts.join(' ')}\``;
  });

  // --- {% checkbox [color] [checked|times], TEXT %} ---------------------------
  src = src.replace(/\{%-?\s*checkbox\s+([^%]+?)\s*-?%\}/g, (_, body) => {
    hit('checkbox');
    const parts = body.split(',').map((p) => p.trim());
    const text = parts.pop() ?? '';
    const attrs = (parts[0] ?? '').toLowerCase();
    const done = attrs.includes('checked');
    return `- [${done ? 'x' : ' '}] ${text}`;
  });

  // --- {% del ... %} / {% psw ... %} -----------------------------------------
  src = src.replace(/\{%-?\s*del\s+([^%]*?)\s*-?%\}/g, (_, t) => (hit('del'), `~~${t}~~`));
  src = src.replace(/\{%-?\s*psw\s+([^%]*?)\s*-?%\}/g, (_, t) => (hit('psw'), `!!${t}!!`));

  // --- tabs: {% tabs NAME %} ... {% endtabs %} --------------------------------
  // `{% tabs %}`/`{% endtabs %}` only wrap the group; astro-koharu's tab cards are
  // delimited by `;;;tab1 NAME` ... `;;;` alone, so the wrapper is dropped.
  // (The group name is intentionally not reused as a tab title, which would
  // otherwise create nested tab cards.)
  src = src.replace(/\{%-?\s*tabs\s+[^%]*?-?%\}/g, () => (hit('tabs-wrapper'), ''));
  src = src.replace(/\{%-?\s*endtabs\s*-?%\}/g, () => (hit('tabs-wrapper'), ''));

  // --- <!-- tab NAME --> / <!-- endtab --> ------------------------------------
  // Only convert when the markers stand alone on their own line; inline usage
  // (e.g. `word<!-- tab -->tip<!-- endtab -->`) is not a tab group, so drop the
  // markers and keep the surrounding text intact.
  src = src.replace(/^([ \t]*)<!--\s*tab\s+([^>]*?)-->[ \t]*$/gm, (_, indent, name) => {
    hit('tab-comment');
    return `${indent};;;tab1 ${name.trim()}`;
  });
  src = src.replace(/^([ \t]*)<!--\s*endtab\s*-->[ \t]*$/gm, (_, indent) => {
    hit('tab-comment');
    return `${indent};;;`;
  });
  src = src.replace(/<!--\s*tab\s+[^>]*?-->/g, () => (hit('tab-inline'), ''));
  src = src.replace(/<!--\s*endtab\s*-->/g, () => (hit('tab-inline'), ''));

  // --- leftover unknown hexo tags: make them visible but harmless -------------
  src = src.replace(/\{%-?\s*([a-zA-Z_]+)([^%]*?)\s*-?%\}/g, (m, name) => {
    hit('LEFT-' + name);
    return m;
  });

  // --- link rewrites ----------------------------------------------------------
  src = src.replace(/\/posts\/([0-9a-f]{6,8})\.html/g, (_, id) => (hit('rewrite-url'), `/post/${id}`));
  src = src.replace(/\/posts\/([0-9a-f]{6,8})(?![0-9a-zA-Z])/g, (_, id) => (hit('rewrite-url'), `/post/${id}`));

  // --- stray </br> -----------------------------------------------------------
  src = src.replace(/<\/br>/gi, () => (hit('br'), ''));

  return src;
}

let total = 0;
const grand = {};
for (const file of walk(BLOG)) {
  const raw = fs.readFileSync(file, 'utf8');
  const stats = {};
  const out = convertTags(raw, stats);
  if (Object.keys(stats).length) {
    total++;
    for (const [k, v] of Object.entries(stats)) grand[k] = (grand[k] ?? 0) + v;
    report.push(`${path.relative(BLOG, file)}: ${JSON.stringify(stats)}`);
  }
  if (out !== raw) fs.writeFileSync(file, out, 'utf8');
}

console.log(report.join('\n'));
console.log(`\n${total} files touched. Totals:`, grand);
