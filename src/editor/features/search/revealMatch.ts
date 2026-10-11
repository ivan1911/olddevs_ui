"use client";

interface Band {
  top: number;
  bottom: number;
}

/**
 * Показать текущее совпадение поиска.
 *
 * ПОЧЕМУ НЕ `tr.scrollIntoView()`. ProseMirror прокручивает к выделению, только
 * когда выделение браузера стоит внутри Документа, а при переходе по совпадениям
 * фокус остаётся в поле поиска — прокрутка молча пропускалась. Поэтому панель
 * показывает узел подсветки сама.
 *
 * СВОБОДНАЯ ОБЛАСТЬ — окно, суженное прокручиваемыми предками совпадения (поле с
 * `maxHeight` или `resizable`, контейнер экрана) и тем, что лежит поверх
 * Документа: липкой Панелью и самой панелью поиска, если она перекрывает
 * совпадение по горизонтали. Если под ними не остаётся и строки (низкое поле с
 * `maxHeight`), панель не учитывается: совпадение хотя бы в поле.
 *
 * Видимое целиком совпадение не двигается — переход между соседними строками
 * не дёргает страницу. Невидимое встаёт посередине свободной области, как у
 * поиска Chrome. Не `scrollIntoView({ block: "center" })`: тот центрирует по
 * прокручиваемому предку целиком и ставит совпадение ровно под панель поиска.
 * Сдвиг раздаётся по цепочке: сначала поле, остаток — окну.
 *
 * @param documentRoot корень Документа движка (`editor.view.dom`)
 * @param overlays элементы поверх Документа: панель поиска и её липкий родитель
 */
export function revealCurrentMatch(
  documentRoot: HTMLElement,
  overlays: readonly (Element | null | undefined)[]
): void {
  const match = documentRoot.querySelector<HTMLElement>(".rte-search-current");
  if (!match) return;
  const rect = match.getBoundingClientRect();

  const scrollers: Element[] = [];
  const area: Band = { top: 0, bottom: window.innerHeight };
  for (let node = match.parentElement; node && node !== document.body; node = node.parentElement) {
    if (!/auto|scroll|hidden/.test(getComputedStyle(node).overflowY)) continue;
    if (node.scrollHeight <= node.clientHeight) continue;
    scrollers.push(node);
    const box = node.getBoundingClientRect();
    area.top = Math.max(area.top, box.top);
    area.bottom = Math.min(area.bottom, box.bottom);
  }
  scrollers.push(document.scrollingElement ?? document.documentElement);

  const free: Band = { ...area };
  for (const overlay of overlays) {
    if (!overlay) continue;
    const box = overlay.getBoundingClientRect();
    if (box.height > 0 && box.left < rect.right && rect.left < box.right) {
      free.top = Math.max(free.top, box.bottom);
    }
  }
  const band = free.bottom - free.top >= rect.height ? free : area;

  if (rect.top >= band.top && rect.bottom <= band.bottom) return;
  let delta = (rect.top + rect.bottom) / 2 - (band.top + band.bottom) / 2;
  for (const scroller of scrollers) {
    if (Math.abs(delta) < 1) break;
    const before = scroller.scrollTop;
    scroller.scrollTop = before + delta;
    delta -= scroller.scrollTop - before;
  }
}
