"use client";

import type { KatexOptions } from "katex";
import type { Editor } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { katex, mathErrorDetail } from "./katexEngine.js";
import { insertFormula } from "./mathCommands.js";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE } from "./mathNames.js";

export interface MathFormProps {
  editor: Editor;
  /** Inline or block formula: the kind sets the node name, the field and the preview mode. */
  kind: "inline" | "block";
  /**
   * Position of the formula being edited. Without it, the form inserts a new formula at the
   * caret.
   */
  pos?: number;
  /** Closes the popover the same way Escape does. */
  close: () => void;
}

/**
 * Content of the formula popover (ADR-0070, item 7): the LaTeX field, a live preview and the
 * error inside the field itself. The kit draws the frame (`SelectionPopover`): a `Popover` in
 * the layer stack. The frame's name is the item's label, and focus returns to the Document.
 *
 * TWO MODES, SET BY `pos`, as in the image popover. With `pos`, the form edits the formula
 * (a click or Enter on it) and shows the "Apply" and "Remove formula" buttons. Without it,
 * the form inserts a new formula (a Slash menu item) and shows the "Insert" button.
 *
 * AN INVALID LaTeX DOES NOT CHANGE THE DOCUMENT. Parsing runs on every keystroke. While KaTeX
 * reports an error, the apply button is disabled and its message stays in the field, so a
 * formula that cannot be drawn never reaches the Document. The preview and the Document are
 * drawn by the same KaTeX with the same options the Editor uses (`tool("mathematics")`), so
 * "correct in the preview" means "correct in the Document".
 *
 * The field of a block formula is multiline (`aligned` and matrices are easier to write as a
 * column). `Enter` inserts a line break there, and `Ctrl/⌘+Enter` applies. An inline field is
 * single-line, and `Enter` applies. An Enter that an IME uses to confirm a word does not count.
 */
export function MathForm({ editor, kind, pos, close }: MathFormProps) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const block = kind === "block";
  const name = block ? BLOCK_FORMULA_NODE : INLINE_FORMULA_NODE;
  const [existing] = useState(() =>
    pos === undefined ? null : String(editor.state.doc.nodeAt(pos)?.attrs.latex ?? "")
  );
  const [draft, setDraft] = useState(existing ?? "");

  // KaTeX options come from the extension of the same kind: the form keeps no copy of its own.
  // It is a factory, not an object: `\gdef` writes into `macros`, and `{ ...options }`
  // re-evaluates the macros getter (`katexOptionsFor`), so each check and preview starts clean.
  const katexOptions = useMemo(() => {
    const own = editor.extensionManager.extensions.find((extension) => extension.name === name);
    const options = own?.options.katexOptions as KatexOptions | undefined;
    return (): KatexOptions => ({ ...options });
  }, [editor, name]);

  const latex = draft.trim();
  // The check uses `renderToString`: its markup goes nowhere, and a KaTeX error arrives as the
  // same exception that rendering throws.
  const error = useMemo(() => {
    if (!latex) return null;
    try {
      katex.renderToString(latex, katexOptions());
      return null;
    } catch (failure) {
      return mathErrorDetail(failure);
    }
  }, [latex, katexOptions]);
  // The preview calls `katex.render` straight into the element. KaTeX sizes are set through
  // CSSOM, not as a `style="…"` string in `innerHTML`, so a consumer's strict CSP does not
  // block them.
  const previewRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    if (latex && error === null) katex.render(latex, target, katexOptions());
    else target.textContent = "";
  }, [latex, error, katexOptions]);

  const apply = () => {
    if (!latex || error !== null) return;
    if (pos === undefined) insertFormula(editor, kind, latex);
    else if (latex !== existing) {
      // Extension command: the node updates in place, as one edit in the history.
      if (block) editor.chain().focus().updateBlockMath({ latex, pos }).run();
      else editor.chain().focus().updateInlineMath({ latex, pos }).run();
    }
    close();
  };

  const remove = () => {
    if (pos !== undefined) {
      if (block) editor.chain().focus().deleteBlockMath({ pos }).run();
      else editor.chain().focus().deleteInlineMath({ pos }).run();
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    // A block field is a column: Enter inserts a line break, Mod+Enter applies.
    if (block && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex w-80 max-w-full flex-col gap-3 p-1">
      {/* `layout="stack"` is set explicitly: the popover is drawn outside the form layout where
          the Editor sits. */}
      <FormField
        label={messages.mathLatex}
        htmlFor={fieldId}
        error={error === null ? undefined : messages.mathInvalid({ detail: error })}
        layout="stack"
      >
        <TextControl
          id={fieldId}
          as={block ? "textarea" : "input"}
          {...(block ? { rows: 3, autosize: true, maxRows: 8 } : { size: "sm" as const })}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          className="font-mono"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <div
        role="group"
        aria-label={messages.mathPreview}
        className="border-line bg-bg-2 rounded-control flex min-h-12 items-center justify-center overflow-x-auto border px-3 py-2"
      >
        <span ref={previewRef} hidden={!latex || error !== null} />
        {(!latex || error !== null) && (
          <span className="text-fg-2 text-sm">{messages.mathEmpty}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {existing !== null && (
          <Button type="button" size="sm" variant="ghost" tone="danger" onClick={remove}>
            {messages.mathRemove}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="solid"
          tone="accent"
          disabled={!latex || error !== null}
          onClick={apply}
        >
          {existing === null ? messages.mathInsert : messages.mathApply}
        </Button>
      </div>
    </div>
  );
}
