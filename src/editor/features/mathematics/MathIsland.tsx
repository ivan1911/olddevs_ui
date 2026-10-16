"use client";

import { useEffect, useRef } from "react";
import { BLOCK_FORMULA_TYPE, FORMULA_SELECTOR, FORMULA_SOURCE_ATTRIBUTE } from "./mathNames.js";
import type { MathRenderOptions } from "./mathOptions.js";

export interface MathIslandProps {
  /** Отпечаток HTML просмотра: сменился Документ — формулы новые, и остров рисует их заново. */
  docKey: string;
  /** Опции KaTeX из `tools` экрана (`mathOptionsOf`): макросы и строгость, данные. */
  options: MathRenderOptions;
}

/**
 * Остров формул у `RichTextView` (ADR-0070, п. 6): отрисовывает каждую формулу из
 * `data-latex` на месте.
 *
 * СЕРВЕРНЫЙ HTML ПЕРВИЧЕН. Элемент формулы приходит с исходным LaTeX текстом
 * (`withMathSource`) и читается без JS и до гидрации; после монтирования остров
 * грузит KaTeX и его CSS и заменяет содержимое отрисованной формулой. Формула с
 * ошибкой остаётся исходником и получает `data-math-error` — читатель видит текст
 * автора, а не пустоту.
 *
 * KaTeX ГРУЗИТСЯ ЛЕНИВО, `import()` в эффекте, а не статически: остров монтируется
 * только у Документа с формулами (`hasMath`), и страница без них не платит ни за
 * 270 кБ KaTeX, ни за его CSS и шрифты. `katexEngine.ts` несёт CSS, поэтому стили
 * приходят тем же чанком.
 *
 * ПОИСК — ОТ СВОЕГО МЕСТА В ДЕРЕВЕ, как у «Копировать» и Острова своих Блоков:
 * инертный `<template>` стоит сразу за контейнером просмотра (или за метками
 * других островов), и просмотр в теневом корне или `iframe` находит свои формулы.
 *
 * Элементы формул не принадлежат React: он кладёт HTML одной строкой
 * (`dangerouslySetInnerHTML`) и детей не сверяет, а перерисовка того же Документа
 * (`useMemo` в `RichTextView`) разметку не трогает. Новый Документ — новая строка,
 * новый `docKey` и новый проход эффекта.
 */
export function MathIsland({ docKey, options }: MathIslandProps) {
  const marker = useRef<HTMLTemplateElement>(null);
  // Опции — данные с сервера, и новый литерал каждый рендер не должен гонять
  // эффект заново: Документ решает, что рисовать заново, а опции читаются в момент рисования.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let view = marker.current?.previousElementSibling;
    while (view?.localName === "template") view = view.previousElementSibling;
    const formulas = [...(view?.querySelectorAll<HTMLElement>(FORMULA_SELECTOR) ?? [])];
    if (formulas.length === 0) return;
    let cancelled = false;
    void import("./katexEngine.js").then(
      ({ katex, katexOptionsFor }) => {
        if (cancelled) return;
        for (const element of formulas) {
          const latex = element.getAttribute(FORMULA_SOURCE_ATTRIBUTE) ?? "";
          const block = element.getAttribute("data-type") === BLOCK_FORMULA_TYPE;
          try {
            katex.render(latex, element, katexOptionsFor(optionsRef.current, block));
            element.removeAttribute("data-math-error");
          } catch {
            // KaTeX очищает элемент до разбора, поэтому исходник возвращается текстом.
            element.textContent = latex;
            element.setAttribute("data-math-error", "");
          }
        }
      },
      () => {
        // Чанк не пришёл: исходник LaTeX остаётся на месте, как до острова.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [docKey]);

  return <template ref={marker} data-math-island="" />;
}
