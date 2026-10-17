"use client";

import { useEffect, useRef } from "react";
import { BLOCK_FORMULA_TYPE, FORMULA_SELECTOR, FORMULA_SOURCE_ATTRIBUTE } from "./mathNames.js";
import type { MathRenderOptions } from "./mathOptions.js";

export interface MathIslandProps {
  /**
   * Fingerprint of the View's HTML. When the Document changes, the formulas are new and the
   * Island re-renders them.
   */
  docKey: string;
  /** KaTeX options from the screen's `tools` (`mathOptionsOf`): macros and strictness, as data. */
  options: MathRenderOptions;
}

/**
 * Formula Island of `RichTextView` (ADR-0070, item 6): renders each formula from its
 * `data-latex` in place.
 *
 * SERVER HTML COMES FIRST. A formula element arrives with its LaTeX source as text
 * (`withMathSource`) and is readable without JS and before hydration. After mounting, the
 * Island loads KaTeX and its CSS and replaces the content with the rendered formula. A formula
 * with an error stays as its source and gets `data-math-error`, so the reader sees the
 * author's text, not an empty spot.
 *
 * KaTeX IS LOADED LAZILY, with `import()` in the effect rather than statically. The Island
 * mounts only in a Document with formulas (`hasMath`), so a page without them pays for
 * neither the 270 kB of KaTeX nor its CSS and fonts. `katexEngine.ts` carries the CSS, so the
 * styles arrive in the same chunk.
 *
 * THE LOOKUP STARTS FROM ITS OWN PLACE IN THE TREE, as the Copy button and the Islands of
 * custom Blocks do. An inert `<template>` stands right after the View's container (or after
 * the markers of other Islands), so a View in a shadow root or an `iframe` finds its own
 * formulas.
 *
 * React does not own the formula elements. It sets their HTML as one string
 * (`dangerouslySetInnerHTML`) and does not reconcile the children, and a re-render of the same
 * Document (`useMemo` in `RichTextView`) leaves the markup alone. A new Document means a new
 * string, a new `docKey`, and a new pass of the effect.
 */
export function MathIsland({ docKey, options }: MathIslandProps) {
  const marker = useRef<HTMLTemplateElement>(null);
  // The options are data from the server. A new object literal on every render must not
  // rerun the effect: the Document decides what to redraw, and the options are read at the
  // moment of drawing.
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
            // KaTeX clears the element before parsing, so the source is put back as text.
            element.textContent = latex;
            element.setAttribute("data-math-error", "");
          }
        }
      },
      () => {
        // The chunk did not arrive: the LaTeX source stays in place, as it was before the Island.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [docKey]);

  return <template ref={marker} data-math-island="" />;
}
