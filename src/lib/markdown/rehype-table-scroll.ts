/**
 * Rehype plugin: wrap every markdown table in a scroll container.
 *
 * 以前表格自己是 `display: block; overflow-x: auto` —— 横向滚动能用，但表格的行
 * 会退化成一个收缩到内容宽度的匿名表，看起来又窄又靠左，没法「占满整行」。
 * 把横向滚动交给外层 div 之后，<table> 可以保持 `display: table; width: 100%`，
 * 表格就能撑满正文列宽，单元格居中也才有意义。
 *
 * 幂等：已经处在 .table-scroll 容器里的 table 不会再次包装。
 */
import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

export const TABLE_SCROLL_CLASS = 'table-scroll';

function hasScrollWrapperClass(node: Element): boolean {
  const value = node.properties?.className;
  const classes = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/\s+/);
  return classes.includes(TABLE_SCROLL_CLASS);
}

export function rehypeTableScroll() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || index === undefined || !parent) return;
      if (parent.type === 'element' && hasScrollWrapperClass(parent)) return;

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: [TABLE_SCROLL_CLASS] },
        children: [node] as ElementContent[],
      };
      parent.children[index] = wrapper;
    });
  };
}
