"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { hasOpenAriaOverlay } from "../../../lib/overlay-layer.js";
import type { UiMessages } from "../../../i18n/messages.js";
import { duplicateBlock, moveBlock } from "../../core/blockCommands.js";
import { BlockSelection, removeUnits } from "../../core/blockSelection.js";
import type { FieldNotice } from "../../core/fieldNotice.js";
import {
  caretAfter,
  extendSelection,
  extendToPosition,
  moveSelection,
  selectCurrent,
} from "./blockSelectionMoves.js";

/**
 * Block selection (ADR-0077): several Blocks selected whole, with no caret in the text. A mode that
 * the selection itself carries (`BlockSelection`, `core/blockSelection.ts`): this extension is the
 * way in, the keys inside, and the look.
 *
 * - WAY IN: `Esc` in the text selects the current Block; the "Select" item of the Block handle's
 *   menu does the same (`selectBlocks`); `Shift+↑/↓` and `Shift+click` grow it.
 * - WAY OUT: `Esc` again puts the caret at the end of the first Block, and that `Esc` goes on to the
 *   window around the Editor, so it closes a `Dialog` or a `Drawer`. Enter, and a click into the
 *   text, bring the caret back too.
 * - KEYS INSIDE: `Backspace` and `Delete` remove the Blocks, `⌘⇧D`, `⌥⇧↑/↓` and `⌘/` act on the
 *   group, a printable character is ignored (one key must not erase a section), `⌘C`, `⌘X` and `⌘V`
 *   take the Blocks whole. Copying is the engine's own: the selection serializes as whole Blocks.
 *
 * `readOnly` keeps the selection and copying, and no key that changes the Document; `disabled` does
 * nothing at all.
 */

type EditorMessages = UiMessages["editor"];

export interface BlockSelectionOptions {
  /** Report a result to the screen reader (the Field notice, tone `status`). */
  onNotice: (notice: FieldNotice | null) => void;
  /** The catalog of the Editor's language, read on every announcement. */
  messages: () => EditorMessages;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockSelection: {
      /**
       * Select the Blocks under the selection whole (`Esc`). `false` when the selection is in no
       * Block, or the field is disabled.
       */
      selectBlocks: () => ReturnType;
      /**
       * End the Block selection: the caret goes to the end of the first Block. `false` when no
       * Blocks are selected.
       */
      clearBlockSelection: () => ReturnType;
    };
  }
}

const KEY = new PluginKey("blockSelection");

/** CSS class of a selected Block (`prose.ts`). */
export const SELECTED_BLOCK_CLASS = "rte-block-selected";

/** How long a result stays "pending" for the update that follows the DOM event (a cut, a paste). */
const PENDING_MS = 1000;

/** A disabled field does nothing: it does not take focus, but keys and clicks can still arrive. */
function isDisabled(view: EditorView): boolean {
  return view.dom.getAttribute("aria-disabled") === "true";
}

/**
 * The same question for the Document that does not exist yet: the root's attributes are computed
 * while the view is being built, before `aria-disabled` is on the DOM, so it is read from the
 * options the Editor passes (`RichTextEditor` sets it there).
 */
function isDisabledField(editor: Editor): boolean {
  const attributes = editor.options.editorProps?.attributes;
  return (
    typeof attributes === "object" &&
    (attributes as Record<string, string>)["aria-disabled"] === "true"
  );
}

/**
 * Whether a layer of the kit is open above the Document, one that owns `Escape` first: the Slash
 * menu, a Text card, a popover, a menu. Radix keeps them in a popper wrapper, react-aria in a
 * positioned overlay (ADR-0041). A tooltip is not a layer: it takes no focus and does not close
 * on `Escape`.
 */
function layerIsOpen(doc: Document): boolean {
  if (hasOpenAriaOverlay()) return true;
  return Array.from(doc.querySelectorAll("[data-radix-popper-content-wrapper]")).some(
    (wrapper) => wrapper.querySelector('[role="tooltip"]') === null
  );
}

function countOf(state: EditorState): number {
  return state.selection instanceof BlockSelection ? state.selection.count : 0;
}

/** A printable character, or a key an input method sends in place of it. */
function isTyping(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey) return false;
  return event.isComposing || event.keyCode === 229 || event.key.length === 1;
}

export const BlockSelectionExtension = Extension.create<BlockSelectionOptions>({
  name: "blockSelection",
  // Above the Block commands (`⌘/` is 1001): inside the selection these keys are ours first.
  priority: 1010,

  addOptions: () => ({ onNotice: () => {}, messages: () => ({}) as EditorMessages }),

  addCommands() {
    return {
      selectBlocks:
        () =>
        ({ state, dispatch, view }) => {
          if (isDisabled(view)) return false;
          const next = selectCurrent(state);
          if (!next) return false;
          if (dispatch) dispatch(state.tr.setSelection(next).scrollIntoView());
          return true;
        },
      clearBlockSelection:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          if (!(selection instanceof BlockSelection)) return false;
          if (dispatch) dispatch(state.tr.setSelection(caretAfter(selection)).scrollIntoView());
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    const announce = (text: (messages: EditorMessages) => string) => {
      options.onNotice({ tone: "status", text: text(options.messages()) });
    };
    /** What the next update should announce instead of the generic "selected" / "cleared". */
    let pending: { text: (messages: EditorMessages) => string; at: number } | null = null;
    /** `mouse`, `pen` or `touch`: the last pointer that pressed in the Document. */
    let pointer = "mouse";

    const dispatchSelection = (view: EditorView, selection: BlockSelection) => {
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    };

    return [
      new Plugin({
        key: KEY,

        props: {
          // The Blocks are painted whole by decorations; the engine draws no selection of its own.
          decorations: (state) => {
            const { selection } = state;
            if (!(selection instanceof BlockSelection)) return null;
            const range = selection.nodeRange();
            const marks: Decoration[] = [];
            let pos = range.start;
            for (let index = range.startIndex; index < range.endIndex; index++) {
              const node = range.parent.child(index);
              marks.push(
                Decoration.node(pos, pos + node.nodeSize, { class: SELECTED_BLOCK_CLASS })
              );
              pos += node.nodeSize;
            }
            return DecorationSet.create(state.doc, marks);
          },

          // The root marks the mode: the native selection paint and the caret are hidden by CSS.
          attributes: (state): Record<string, string> => {
            const attributes: Record<string, string> = {};
            if (state.selection instanceof BlockSelection) attributes["data-block-selection"] = "";
            /*
              A read-only Document has no `tabindex` of its own, so it could never take the focus
              that `Esc` and `Shift+↑/↓` need (ADR-0077, decision 13). With the Tool on it joins the
              Tab order. A disabled field stays out of it; an editable one has the engine's own.
            */
            if (!editor.isEditable && !isDisabledField(editor)) attributes.tabindex = "0";
            return attributes;
          },

          // A character typed over the selected Blocks is ignored: one key must not erase a section.
          handleTextInput: (view) =>
            view.state.selection instanceof BlockSelection && view.editable,

          handleDOMEvents: {
            /*
              The keys are a DOM handler and not `handleKeyDown`: the engine ignores `keydown` in a
              read-only field, and there the selection must still move and grow.
            */
            keydown: (view, event) => {
              const { state } = view;
              const { selection } = state;
              if (!(selection instanceof BlockSelection) || isDisabled(view)) return false;
              const mod = event.metaKey || event.ctrlKey;
              const plain = !mod && !event.altKey;
              const editable = view.editable;

              if ((event.key === "ArrowUp" || event.key === "ArrowDown") && plain) {
                const dir = event.key === "ArrowUp" ? -1 : 1;
                event.preventDefault();
                dispatchSelection(
                  view,
                  event.shiftKey ? extendSelection(selection, dir) : moveSelection(selection, dir)
                );
                return true;
              }
              if (event.key === "Enter" && plain && !event.shiftKey) {
                event.preventDefault();
                view.dispatch(state.tr.setSelection(caretAfter(selection)).scrollIntoView());
                return true;
              }
              if (!editable) return false;

              const count = selection.count;
              if (
                (event.key === "Backspace" || event.key === "Delete") &&
                plain &&
                !event.shiftKey
              ) {
                event.preventDefault();
                const tr = state.tr;
                if (removeUnits(tr, selection.nodeRange())) {
                  view.dispatch(tr.scrollIntoView());
                  announce((m) => m.blocksDeleted({ count }));
                }
                return true;
              }
              // `⌘⇧D` and `⌥⇧↑/↓` are the Block commands, run here to announce their result.
              if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === "d") {
                event.preventDefault();
                if (duplicateBlock()(state, view.dispatch)) {
                  announce((m) => m.blocksDuplicated({ count }));
                }
                return true;
              }
              if (
                event.altKey &&
                event.shiftKey &&
                !mod &&
                (event.key === "ArrowUp" || event.key === "ArrowDown")
              ) {
                event.preventDefault();
                if (moveBlock(event.key === "ArrowUp" ? -1 : 1)(state, view.dispatch)) {
                  announce((m) => m.blocksMoved({ count }));
                }
                return true;
              }
              if (isTyping(event)) {
                event.preventDefault();
                return true;
              }
              return false;
            },

            pointerdown: (_view, event) => {
              pointer = (event as PointerEvent).pointerType || "mouse";
              return false;
            },

            /*
              `Shift+click` on another Block draws the selection to it; on a touch screen a tap does
              the same, except in the text of a selected Block, which puts the caret there as usual.
              The Block is found from the DOM node under the pointer, not from coordinates.
            */
            mousedown: (view, event) => {
              const { selection } = view.state;
              if (!(selection instanceof BlockSelection) || isDisabled(view)) return false;
              const touch = pointer === "touch";
              if (!event.shiftKey && !touch) return false;
              const target = event.target;
              if (!(target instanceof Node) || target === view.dom || !view.dom.contains(target)) {
                return false;
              }
              let pos: number;
              try {
                pos = view.posAtDOM(target, 0);
              } catch {
                return false;
              }
              if (touch && !event.shiftKey && pos >= selection.from && pos <= selection.to) {
                return false;
              }
              const next = extendToPosition(view.state, selection, pos);
              if (!next) return false;
              event.preventDefault();
              dispatchSelection(view, next);
              return true;
            },

            // Dragging the selected Blocks is not supported (the owner's decision, as with the handle).
            dragstart: (view, event) => {
              if (!(view.state.selection instanceof BlockSelection)) return false;
              event.preventDefault();
              return true;
            },

            // The engine's own copy takes the selection as whole Blocks (HTML and text).
            copy: (view) => {
              const { selection } = view.state;
              if (selection instanceof BlockSelection && !isDisabled(view)) {
                const count = selection.count;
                announce((m) => m.blocksCopied({ count }));
              }
              return false;
            },
            cut: (view) => {
              const { selection } = view.state;
              if (selection instanceof BlockSelection && view.editable && !isDisabled(view)) {
                const count = selection.count;
                pending = { text: (m) => m.blocksCut({ count }), at: Date.now() };
              }
              return false;
            },
            paste: (view) => {
              const { selection } = view.state;
              if (selection instanceof BlockSelection && view.editable && !isDisabled(view)) {
                const count = selection.count;
                pending = { text: (m) => m.blocksReplaced({ count }), at: Date.now() };
              }
              return false;
            },

            // Text typed in through an input method must not replace the selected Blocks either.
            beforeinput: (view, event) => {
              if (!(view.state.selection instanceof BlockSelection) || !view.editable) return false;
              const type = (event as InputEvent).inputType;
              if (/^insert(Text|CompositionText|ReplacementText|LineBreak|Paragraph)$/.test(type)) {
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        },

        view: (view) => {
          /*
            `Esc` is handled here, in the capture phase on the window, and not in the plugin's
            `handleKeyDown`. Radix listens for `Escape` on the document in the capture phase to
            close a `Dialog` or a `Drawer`, and ProseMirror skips an event whose default is already
            prevented, so by the time the key reached the engine the window would be closed. A
            listener on the window runs before the document's one: the first `Esc` is taken
            here (`preventDefault` tells the layer not to close), the second is let through.
          */
          const win = view.dom.ownerDocument.defaultView;
          const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
            if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
            // Only focus in the Document's text: not the Toolbar, the code Block's header or a card.
            if (event.target !== view.dom || isDisabled(view)) return;
            if (layerIsOpen(view.dom.ownerDocument)) return;
            const { selection } = view.state;
            if (selection instanceof BlockSelection) {
              // The second `Esc`: the selection ends, the key goes on and closes the layer.
              view.dispatch(view.state.tr.setSelection(caretAfter(selection)).scrollIntoView());
              return;
            }
            const next = selectCurrent(view.state);
            if (!next) return;
            event.preventDefault();
            dispatchSelection(view, next);
          };
          win?.addEventListener("keydown", onKeyDown, true);

          return {
            /*
              Announcements: the count whenever it changes, the end of the selection, and the
              result of an action that PM finishes after the event (a cut, a paste). The results of
              keys and menu items are announced by the code that ran them.
            */
            update: (updated, previous) => {
              const task = pending && Date.now() - pending.at < PENDING_MS ? pending : null;
              pending = null;
              const now = countOf(updated.state);
              const was = countOf(previous);
              if (task) return announce(task.text);
              if (now > 0 && (now !== was || !(previous.selection instanceof BlockSelection))) {
                announce((m) => m.blocksSelected({ count: now }));
              } else if (now === 0 && was > 0) {
                announce((m) => m.blockSelectionCleared);
              }
            },
            destroy: () => win?.removeEventListener("keydown", onKeyDown, true),
          };
        },
      }),
    ];
  },
});
