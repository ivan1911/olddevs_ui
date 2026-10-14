/**
 * Заголовки Документа для Оглавления (`RichTextToc`, ADR-0066).
 *
 * Читаются из DOM цели, а не из строки `html`: один путь для Просмотра,
 * Редактора и JSON-конверта, и переходу всё равно нужен живой узел.
 *
 * Модуль без React и без движка: только обход DOM.
 */

/** Заголовок в Оглавлении. */
export interface TocHeading {
  /** Узел заголовка в Документе: к нему ведёт переход. */
  element: HTMLElement;
  /** Текст пункта — текст заголовка без разметки. */
  text: string;
  /** Уровень по тегу: 1 для `h1` … 4 для `h4`. */
  level: number;
  /**
   * Глубина относительно самого крупного заголовка Документа: у него 0. Отступ
   * пункта и длина штриха считаются от неё, а не от уровня, — иначе Документ,
   * где старший заголовок H2, начинался бы с пустой ступени.
   */
  depth: number;
}

const HEADING = "h1, h2, h3, h4";

/**
 * Обёртка — единственный контейнер, чьи заголовки идут в Оглавление.
 *
 * Колонки Раскладки — нет: два заголовка на одной высоте в соседних колонках
 * путают подсветку текущего раздела, и порядок «левая колонка, затем правая»
 * читателю ничего не говорит. Острова и свои Блоки — тоже нет: их содержимое —
 * часть Блока, а не структура Документа.
 */
const WRAPPER = 'div[data-block="wrapper"]';

/**
 * Корень Документа внутри цели. У Просмотра это сам контейнер; у Редактора
 * Документ лежит глубже, в узле движка — Панель и строка статуса снаружи него.
 */
export function documentRoot(target: HTMLElement): HTMLElement {
  return target.querySelector<HTMLElement>(".ProseMirror") ?? target;
}

/** Заголовок лежит на верхнем уровне Документа или только в Обёртках. */
function isStructural(heading: Element, root: HTMLElement): boolean {
  for (let node = heading.parentElement; node && node !== root; node = node.parentElement) {
    if (!node.matches(WRAPPER)) return false;
  }
  return true;
}

/**
 * Заголовки Документа в порядке чтения. `only` — какие уровни (1–4) берутся:
 * остальные не попадают в список, и глубина (`depth`) считается от самого
 * крупного из оставшихся. Нет — все.
 */
export function collectHeadings(target: HTMLElement, only?: readonly number[]): TocHeading[] {
  const root = documentRoot(target);
  // Пустой заголовок (автор только начал его в Редакторе) — не пункт: у
  // кнопки без текста не было бы имени, а у полосы — лишний штрих.
  const found = [...root.querySelectorAll<HTMLElement>(HEADING)].filter(
    (heading) =>
      isStructural(heading, root) &&
      heading.textContent?.trim() &&
      (!only || only.includes(Number(heading.tagName[1])))
  );
  const levels = found.map((heading) => Number(heading.tagName[1]));
  const top = Math.min(...levels);
  return found.map((element, index) => ({
    element,
    text: element.textContent?.trim() ?? "",
    level: levels[index]!,
    depth: levels[index]! - top,
  }));
}
