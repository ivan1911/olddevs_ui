"use client";

import { Extension, type Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import type { KitToolButton, ToolLabel } from "./toolDescriptor.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toolButtons: {
      /**
       * Internal kit command, not API: opens the popover of a button entry. A button is anchored to
       * the selection (its shortcut, the frame `anchor: "selection"`); an insert item is anchored to
       * the caret; a Block action is anchored to its `block`. In a non-editable field, and when `can`
       * fails, there are no buttons.
       */
      openToolPopover: (id: string, block?: number) => ReturnType;
    };
  }
}

/** An entry with a popover, other than a button: an insert item or a Block action. */
export interface ToolPopoverEntry {
  id: string;
  label: ToolLabel;
  popover: ToolPopoverRequest["popover"];
}

/** What to open: the frame is held by `RichTextEditor` (`SelectionPopover`). */
export interface ToolPopoverRequest {
  /** The entry's label: the frame's name. */
  label: ToolLabel;
  /**
   * The content. `pos` is the Block the popover is for, or, for the caret, the start of the
   * selection.
   */
  popover: (props: { editor: Editor; close: () => void; pos: number }) => ReactNode;
  /** Frame classes in place of the default (the kit button's `popoverFrame`). */
  className?: string;
  /**
   * The Block's position. The popover is attached to the Block; if absent, it is attached to the
   * selection.
   */
  block?: number;
}

export interface ToolButtonsOptions {
  /** Descriptor buttons of the enabled Tools, in list order. */
  buttons: readonly KitToolButton[];
  /** Insert items and Block actions that have a popover. */
  entries: readonly ToolPopoverEntry[];
  /** Opens the popover at the selection or at a Block: `RichTextEditor` holds it. */
  openPopover: (request: ToolPopoverRequest) => void;
}

/** The button can be pressed: the field is editable, and the button is visible and enabled. */
function available(editor: Editor, button: KitToolButton): boolean {
  return editor.isEditable && (button.isVisible?.(editor) ?? true) && button.can(editor);
}

const KEY_NAMES: Record<string, string> = {
  mod: "Mod",
  alt: "Alt",
  shift: "Shift",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
};

/**
 * Converts a Toolbar-notation shortcut (`["mod", "K"]`) into a ProseMirror key name (`Mod-k`).
 * The letter becomes lowercase: the keymap reads an uppercase one as a key with Shift.
 */
export function keymapName(keys: readonly string[]): string {
  return keys
    .map((key) => KEY_NAMES[key] ?? (/^[A-Z]$/.test(key) ? key.toLowerCase() : key))
    .join("-");
}

/**
 * Shortcuts of the descriptor buttons (ADR-0058, item 5.7): the shortcut is the entry's own field
 * and its only source, so the kit binds the key, not the Tool's Extensions. `run` executes, and the
 * popover opens at the selection. An unavailable button does not take the key: it passes on, to the
 * Document.
 */
export const ToolButtons = Extension.create<ToolButtonsOptions>({
  name: "toolButtons",

  addOptions: () => ({ buttons: [], entries: [], openPopover: () => {} }),

  addCommands() {
    return {
      openToolPopover:
        (id, block) =>
        ({ editor, dispatch }) => {
          const button = this.options.buttons.find((candidate) => candidate.id === id);
          const entry = this.options.entries.find((candidate) => candidate.id === id);
          if (!editor.isEditable) return false;
          if (button ? !button.popover || !available(editor, button) : !entry) return false;
          // `can()` calls the command dry, without `dispatch`: the popover opens only on a real call.
          if (!dispatch) return true;
          if (button?.popover) {
            const { label, popover, popoverFrame } = button;
            this.options.openPopover({ label, popover, className: popoverFrame?.className });
          } else if (entry) {
            /*
              One frame later: the menu item calls the command after `focus()` in the chain, and
              Tiptap returns focus to the Document on the next frame, while the menu is removed in
              the meantime. A popover opened right away would lose focus and close as "focus moved
              outside", like the image popover does.
            */
            requestAnimationFrame(() => {
              if (!editor.isDestroyed) this.options.openPopover({ ...entry, block });
            });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return Object.fromEntries(
      this.options.buttons.flatMap((button) =>
        button.shortcut
          ? [
              [
                keymapName(button.shortcut),
                () => {
                  if (button.popover) return this.editor.commands.openToolPopover(button.id);
                  if (!available(this.editor, button)) return false;
                  button.run(this.editor);
                  return true;
                },
              ],
            ]
          : []
      )
    );
  },
});
