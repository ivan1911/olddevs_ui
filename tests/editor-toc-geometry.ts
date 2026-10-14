/**
 * Геометрия страницы для подсветки раздела Оглавления. В jsdom у всего нулевой
 * прямоугольник и нулевая высота страницы, и ядро Оглавления считает страницу
 * докрученной до конца: текущим становится последний заголовок. Здесь заголовки
 * стоят в столбик по 200 пикселей, а `page.scrolledTo` — индекс заголовка, что
 * стоит у верхнего края (строки отсчёта).
 */
export const page = { scrolledTo: 0 };

const nativeRect = Element.prototype.getBoundingClientRect;

/** Включить геометрию; вернуть функцию, что её снимает. */
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
