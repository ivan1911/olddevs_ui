"use client";

import { Extension, type Editor, type Extensions } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { ReactNode } from "react";
import type { ToolPopoverRequest } from "../../core/toolButtons.js";
import { katexOptionsFor } from "./katexEngine.js";
import { MathForm, type MathFormProps } from "./MathForm.js";
import { selectedFormula } from "./mathCommands.js";
import {
  blockMathTokenizer,
  inlineMathTokenizer,
  renderBlockMath,
  renderInlineMath,
} from "./mathMarkdown.js";
import { safeLatexSource } from "./mathHtml.js";
import { BLOCK_FORMULA_NODE, FORMULA_SOURCE_ATTRIBUTE, INLINE_FORMULA_NODE } from "./mathNames.js";
import type { MathRenderOptions } from "./mathOptions.js";

/*
  The formula chunk (ADR-0070, item 5; ADR-0058, item 11.1): the Mathematics extension
  from Tiptap, KaTeX and its CSS (`katexEngine.ts`), the formula popover and Markdown.
  Together they weigh more than 10 kB gzip, while `basic` and `full` carry no formulas,
  so the chunk is loaded by the Tool's Loader (`mathematicsTool.ts`), and only in an
  Editor that names `mathematics` in `tools`.
*/

/** The popover form as a node: the kit supplies the frame, the title and the anchor. */
export function renderMathForm(props: MathFormProps): ReactNode {
  return <MathForm {...props} />;
}

/** A popover request to edit a formula: the popover stands right at the formula and follows it. */
function editRequest(node: ProseMirrorNode, pos: number): ToolPopoverRequest {
  const block = node.type.name === BLOCK_FORMULA_NODE;
  return {
    label: ({ messages }) => (block ? messages.mathBlock : messages.mathInline),
    popover: ({ editor, close, pos: current }) => (
      <MathForm editor={editor} kind={block ? "block" : "inline"} pos={current} close={close} />
    ),
    block: pos,
  };
}

export interface MathExtensionsContext {
  /** The KaTeX options of this Editor. */
  options: MathRenderOptions;
  /** Open the popover at the selection or at a Block (the bridge from `RichTextEditor`). */
  openPopover: (request: ToolPopoverRequest) => void;
}

/**
 * The Tool's Extensions: the `inlineMath` and `blockMath` nodes and keyboard editing.
 *
 * - **Editing.** A click (the extension's `onClick`) and Enter on a selected formula open
 *   the kit's popover instead of Tiptap's built-in editing. From the keyboard, `Shift+→`
 *   or `Shift+←` from the caret next to an inline formula selects it (`selectedFormula`).
 *   In a non-editable field the formula is only shown.
 * - **Atom text is LaTeX.** `renderText` gives the source to the counter, to copying as
 *   text and to search (ADR-0058, item 4), the way `data-latex` gives it to the HTML.
 * - **Markdown.** The tokenizers and the export are in `mathMarkdown.ts`.
 * - **A block formula is drawn in `display` mode**: the Tiptap extension passes one set of
 *   KaTeX options to both nodes, but a block needs the formula large and centered.
 */
export function mathExtensions({ options, openPopover }: MathExtensionsContext): Extensions {
  const edit = (node: ProseMirrorNode, pos: number) => openPopover(editRequest(node, pos));
  const latexText = ({ node }: { node: ProseMirrorNode }) => String(node.attrs.latex ?? "");
  // The Editor that hosts the node: the click handler checks that the field is editable,
  // which the node alone cannot tell.
  let host: Editor | null = null;
  const bind = {
    onBeforeCreate(this: { editor: Editor }) {
      host = this.editor;
    },
  };
  /*
    The Editor writes `data-latex` in the HTML with a space inside the pairs that DOMPurify
    cuts (`safeLatexSource`): the saved HTML passes the consumer's sanitizer intact and does
    not change on a second pass. The node keeps what the author typed, as is.
  */
  const source = {
    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element: HTMLElement) => element.getAttribute(FORMULA_SOURCE_ATTRIBUTE),
          renderHTML: (attributes: Record<string, unknown>) => ({
            [FORMULA_SOURCE_ATTRIBUTE]: safeLatexSource(String(attributes.latex ?? "")),
          }),
        },
      };
    },
  };
  const open = (node: ProseMirrorNode, pos: number) => {
    if (!host?.isEditable) return;
    // The click selects the node itself. The selection is needed both by Enter and by the
    // author who comes back to the field.
    host.commands.setNodeSelection(pos);
    edit(node, pos);
  };
  const inline = InlineMath.extend({
    ...bind,
    ...source,
    renderText: latexText,
    markdownTokenizer: inlineMathTokenizer,
    renderMarkdown: (node) => renderInlineMath(String(node.attrs?.latex ?? "")),
  }).configure({
    katexOptions: katexOptionsFor(options, false),
    onClick: open,
  });
  const block = BlockMath.extend({
    ...bind,
    ...source,
    renderText: latexText,
    markdownTokenizer: blockMathTokenizer,
    renderMarkdown: (node) => renderBlockMath(String(node.attrs?.latex ?? "")),
  }).configure({
    katexOptions: katexOptionsFor(options, true),
    onClick: open,
  });
  /*
    `Shift+→` and `Shift+←` on an inline formula select exactly its text range. Without a
    key handler, Chromium widens the selection, and through `contenteditable="false"` it
    either collapses it or steps past the atom — and then Enter does not find the formula.
    Unlike a node selection, a text range is not reset by Chromium on `selectionchange`: a
    native `Shift+→` that worked would give the same shape.
  */
  const selectBeside = (editor: Editor, forward: boolean) => {
    const { selection } = editor.state;
    if (!selection.empty) return false;
    const { $head } = selection;
    const node = forward ? $head.nodeAfter : $head.nodeBefore;
    if (!node || node.type.name !== INLINE_FORMULA_NODE) return false;
    const head = forward ? $head.pos + node.nodeSize : $head.pos - node.nodeSize;
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, $head.pos, head))
    );
    return true;
  };
  const keyboard = Extension.create({
    name: "mathKeyboard",
    addKeyboardShortcuts() {
      return {
        "Shift-ArrowRight": ({ editor }) => selectBeside(editor, true),
        "Shift-ArrowLeft": ({ editor }) => selectBeside(editor, false),
        // Enter on a selected formula, whether selected by a click or by `Shift+→`, opens the
        // popover instead of splitting the paragraph.
        Enter: ({ editor }) => {
          const found = editor.isEditable ? selectedFormula(editor.state) : null;
          if (!found) return false;
          edit(found.node, found.pos);
          return true;
        },
      };
    },
  });
  return [block, inline, keyboard];
}
