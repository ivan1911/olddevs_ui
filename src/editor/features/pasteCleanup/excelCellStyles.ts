"use client";

import type { PasteCleanupContext, PasteCleanupStep } from "./cleanPastedHtml.js";
import { parseCssColor } from "./cssColor.js";
import {
  lastValue,
  parseDeclarations,
  rewriteStyle,
  type CssDeclaration,
} from "./cssDeclarations.js";

/*
  Excel puts the formatting of a cell into the `<style>` block and only points at it from the cell:

    <style> .xl65 { font-weight:700; text-align:center; background:#D9E2F3; border:.5pt solid … } </style>
    <td class=xl65>Fruit</td>

  The Schema reads cells, not stylesheets, so without this step the bold header arrives as plain text.
  Here the rules a cell uses are resolved (the `td` rule, then its classes, then its own `style`, as
  the cascade does) and five things are carried to the cell in the form the Schema reads:

    - bold, italic, underline, strikethrough: the cell's content is wrapped in `strong`, `em`, `u`,
      `s`. Tags parse the same in every Tiptap version, unlike a `font-weight` on a cell;
    - alignment: `text-align` in the cell's `style`, which the `table` Tool reads into `data-align`;
    - the fill: an inline `background`, which the next step (`backgroundMarkers`) turns into a marker.

  Fonts, sizes, borders, number formats and the color of the text are not carried over: they are
  not in the Schema, and the color of the text is not mapped to the palette by decision.

  GOOGLE SHEETS needs nothing from this step. It writes the same properties inline on each cell
  (`font-weight:bold;text-align:center;background-color:#d9e2f3`), which the Schema and
  `backgroundMarkers` already read.

  SAFARI does not lose the cell styles, as it was assumed: it drops the `<style>` block and the Office
  namespaces, but writes the resolved values into each cell's own `style`. So bold, italic and
  alignment arrive without this step. The fill does not, because the source is then not recognised
  as Excel (`pasteSources.ts`).
*/

/** One rule of the stylesheet that can apply to a cell: the `td` rule or a class rule. */
interface CellRule {
  /** The class it is for, or `null` for the rule of every `td`. */
  className: string | null;
  declarations: CssDeclaration[];
}

/** The rules for `td`, `.xl65` and `td.xl65`, in the order of the stylesheet. */
function readRules(styles: string): CellRule[] {
  const rules: CellRule[] = [];
  const css = styles.replace(/<!--|-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = parseDeclarations(body!);
    for (const selector of selectors!.split(",")) {
      const match = /^\s*(?:td)?(?:\.([\w-]+))?\s*$/i.exec(selector);
      // `@page`, `tr`, `col`, `br` and the rest are not about the text of a cell.
      if (match && selector.trim()) rules.push({ className: match[1] ?? null, declarations });
    }
  }
  return rules;
}

/** The declarations a cell ends up with: the `td` rules, then its classes, then its own `style`. */
function resolve(cell: Element, rules: readonly CellRule[]): CssDeclaration[] {
  const classes = new Set((cell.getAttribute("class") ?? "").split(/\s+/));
  const applied = [
    ...rules.filter((rule) => rule.className === null),
    ...rules.filter((rule) => rule.className !== null && classes.has(rule.className)),
  ];
  return [
    ...applied.flatMap((rule) => rule.declarations),
    ...parseDeclarations(cell.getAttribute("style") ?? ""),
  ];
}

/** Whether the cell shows anything: Excel writes `&nbsp;` into an empty one, and nothing needs a mark. */
function hasContent(cell: Element): boolean {
  return /\S/.test(cell.textContent ?? "");
}

/** Wrap all children of the cell in an element, innermost last: `<strong><em>…</em></strong>`. */
function wrapContent(cell: Element, tags: readonly string[]): void {
  let parent: Element = cell;
  for (const tag of tags) {
    const wrapper = cell.ownerDocument.createElement(tag);
    wrapper.append(...Array.from(parent.childNodes));
    parent.append(wrapper);
    parent = wrapper;
  }
}

function applyStyles(cell: Element, rules: readonly CellRule[]): void {
  const declarations = resolve(cell, rules);
  const weight = lastValue(declarations, "font-weight");
  const decoration = lastValue(declarations, "text-decoration") ?? "";
  const align = lastValue(declarations, "text-align")?.toLowerCase();
  const fill = lastValue(declarations, "background", "background-color");

  const tags: string[] = [];
  if (weight !== null && /^(bold(er)?|[5-9]\d\d)$/i.test(weight)) tags.push("strong");
  if (lastValue(declarations, "font-style")?.toLowerCase() === "italic") tags.push("em");
  if (/underline/i.test(decoration)) tags.push("u");
  if (/line-through/i.test(decoration)) tags.push("s");
  if (tags.length > 0 && hasContent(cell)) wrapContent(cell, tags);

  const add: CssDeclaration[] = [];
  // `general` is Excel's "by type" (text left, numbers right): the cell's own `align` says which.
  if (align === "center" || align === "right" || align === "left") {
    add.push({ property: "text-align", value: align });
    // An explicit left must beat the `align=right` Excel puts on a number.
    if (align === "left") cell.removeAttribute("align");
  }
  // Only a real color: `windowtext` and `auto` are not a fill.
  if (fill !== null && parseCssColor(fill.split(/\s+/)[0]!) !== null) {
    add.push({ property: "background", value: fill });
  }
  if (add.length > 0)
    rewriteStyle(
      cell,
      add.map((declaration) => declaration.property),
      add
    );
}

/**
 * Excel's cell formatting from the class rules of the `<style>` block, for the cells that have a
 * class: bold, italic, underline, strikethrough, horizontal alignment and the fill.
 */
export const excelCellStyles: PasteCleanupStep = {
  name: "excelCellStyles",
  applies: (sources) => sources.excel,
  run(document, context: PasteCleanupContext) {
    const rules = readRules(context.styles);
    if (rules.length === 0) return;
    for (const cell of document.querySelectorAll("td[class], th[class]")) applyStyles(cell, rules);
  },
};
