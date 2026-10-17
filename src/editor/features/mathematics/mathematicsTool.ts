"use client";

import { Node } from "@tiptap/core";
import { BlockFormulaIcon, FormulaIcon } from "../../../icons.js";
// Type only: a static import of the module would pull the chunk into the start bundle.
import type * as MathChunkModule from "./mathChunk.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";
import { safeLatexSource } from "./mathHtml.js";
import {
  BLOCK_FORMULA_NODE,
  FORMULA_SOURCE_ATTRIBUTE,
  BLOCK_FORMULA_TYPE,
  INLINE_FORMULA_NODE,
  INLINE_FORMULA_TYPE,
} from "./mathNames.js";
import { MATH_CHECKS, MATH_DEFAULTS, type MathRenderOptions } from "./mathOptions.js";

/*
  The formula chunk: the Mathematics extension from Tiptap, KaTeX with its CSS, the popover
  and Markdown (ADR-0070, item 5). The Tool's Loader loads it (ADR-0058, item 11.1), and only
  an Editor with `mathematics` in `tools` does: neither `basic` nor `full` requests it.
*/
const loadMath = () => import("./mathChunk.js");

/**
 * The formula chunk, if it is already loaded. The engine with formulas is created after
 * the Loader, and the Slash menu items are visible only while the engine is alive, so
 * where the chunk is needed, it is already there.
 */
const chunk = () => loaded(loadMath) as typeof MathChunkModule;

/*
  The formula shape for the Skeleton: the same two nodes with the same parse of `data-latex`,
  but without KaTeX, the node view, plugins and Markdown. The LaTeX source stands as TEXT
  inside the element, and the CSS shows it in monospace (`prose.ts`): until the chunk arrives,
  the author sees that a formula is in this place, and the field does not jump in height the
  way it would from an empty gap. This shape writes nothing into the Document: it lives only
  in the Skeleton.
*/
const latexAttribute = () => ({
  latex: {
    default: "",
    rendered: false,
    parseHTML: (element: HTMLElement) => element.getAttribute(FORMULA_SOURCE_ATTRIBUTE),
  },
});

const MATH_SHAPE = [
  Node.create({
    name: INLINE_FORMULA_NODE,
    group: "inline",
    inline: true,
    atom: true,
    addAttributes: latexAttribute,
    parseHTML: () => [{ tag: `span[data-type="${INLINE_FORMULA_TYPE}"]` }],
    renderHTML: ({ node }) => [
      "span",
      { "data-type": INLINE_FORMULA_TYPE, "data-latex": safeLatexSource(String(node.attrs.latex)) },
      String(node.attrs.latex),
    ],
  }),
  Node.create({
    name: BLOCK_FORMULA_NODE,
    group: "block",
    atom: true,
    addAttributes: latexAttribute,
    parseHTML: () => [{ tag: `div[data-type="${BLOCK_FORMULA_TYPE}"]` }],
    renderHTML: ({ node }) => [
      "div",
      { "data-type": BLOCK_FORMULA_TYPE, "data-latex": safeLatexSource(String(node.attrs.latex)) },
      String(node.attrs.latex),
    ],
  }),
];

/**
 * Formulas on the Tool's descriptor (ADR-0070; ADR-0048: no requesting screen existed at
 * release, and the API follows the Mathematics extension from Tiptap): the inline and block
 * atoms (`mathChunk.tsx`), the editing popover (`MathForm.tsx`) and two Slash menu items.
 *
 * LAZY. KaTeX and the extension weigh more than 10 kB gzip, and `basic` and `full` have no
 * formulas (the presets do not carry them), so the Extensions are loaded by the Loader, and
 * until it arrives an Editor with formulas shows the Skeleton (`skeleton`).
 *
 * There is no Toolbar button: two formulas in a row would push `full` onto a second line.
 * The inline and block formulas are two Slash menu items ("+" and "/"); each opens a popover
 * with a LaTeX field and does not prepare the Document itself (`popover`). Editing an existing
 * formula is a click or Enter on it (`mathChunk.tsx`).
 *
 * Without the Tool, a formula from `value` and from paste is read as `$…$` text (the Schema of
 * a `tools` list knows it only as text): `mathAsText.ts`, connected in `extensions.ts`.
 */
export const MATHEMATICS_TOOL: ToolDescriptor = {
  name: "mathematics",
  defaults: MATH_DEFAULTS,
  checks: MATH_CHECKS,
  load: loadMath,
  engine: ({ openPopover }, options) =>
    chunk().mathExtensions({ options: options as MathRenderOptions, openPopover }),
  skeleton: () => MATH_SHAPE,
  // Marks do not apply to an atom: the Bubble menu and the floating Toolbar do not surround
  // a selected formula.
  blocks: {
    [INLINE_FORMULA_NODE]: { plainAtom: true },
    [BLOCK_FORMULA_NODE]: { plainAtom: true },
  },
  // `span` and `div` are the kit's Schema tags; a formula is `data-type="inline-math"` or
  // `"block-math"` with `data-latex`.
  kitTags: ["span", "div"],
  insertItems: [
    {
      id: "mathInline",
      section: "insert",
      label: (m) => m.mathInline,
      icon: FormulaIcon,
      aliases: ["latex", "math", "equation", "formula", "katex", "tex"],
      // The Document is not prepared: the popover places the formula at the caret.
      run: (chain) => chain,
      popover: ({ editor, close }) => chunk().renderMathForm({ editor, kind: "inline", close }),
    },
    {
      id: "mathBlock",
      section: "insert",
      label: (m) => m.mathBlock,
      icon: BlockFormulaIcon,
      aliases: ["latex", "math", "equation", "formula", "katex", "tex", "$$"],
      run: (chain) => chain,
      popover: ({ editor, close }) => chunk().renderMathForm({ editor, kind: "block", close }),
    },
  ],
};
