/**
 * Page geometry for highlighting a section of the Table of contents. In jsdom everything has
 * a zero rectangle and the page has zero height, so the Table of contents core counts the page
 * as scrolled all the way down: the last heading becomes current. Here the headings stand
 * in a column, 200 pixels each, and `page.scrolledTo` is the index of the heading at the top
 * edge (the reference line).
 */
export const page = { scrolledTo: 0 };

const nativeRect = Element.prototype.getBoundingClientRect;

/** Turn the geometry on; return a function that turns it off. */
export function installPageGeometry(): () => void {
  page.scrolledTo = 0;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 10_000,
  });
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const root = /^H[1-4]$/.test(this.tagName) ? this.closest(".ProseMirror") : null;
    if (!root) return nativeRect.call(this);
    const index = [...root.querySelectorAll("h1, h2, h3, h4")].indexOf(this);
    return { top: (index - page.scrolledTo) * 200, bottom: 0, left: 0, right: 0 } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = nativeRect;
    delete (document.documentElement as { scrollHeight?: number }).scrollHeight;
  };
}
