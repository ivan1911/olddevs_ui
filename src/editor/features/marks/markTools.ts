"use client";

import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Inline Marks on the Tool descriptors: bold, italic, underline, strikethrough, code,
 * superscript and subscript.
 *
 * The Tiptap extension itself binds the key and the Markdown shortcut. The shortcuts
 * reference row is only the label for it (`SHORTCUT_KEYS`). The widgets stay with the kit
 * and are shown by `has(name)`: the B·I·U row of Marks (`rowMarks.ts`), the "…" button
 * (`MORE_MARKS` in `FormatMenus.tsx`), and the Mark slots in the Bubble menu.
 *
 * THE ORDER OF MARKS in saved HTML is set by StarterKit: the rank and nesting of Marks depend
 * on the order of its extensions, not on the order of the Tools. So the five Marks from
 * StarterKit are its parts (`starterKit`), merged into one `StarterKit.configure`
 * (`extensions.ts`). Superscript and subscript are attached as separate extensions at their
 * places in `ENGINE_ORDER`.
 */

/** The shortcuts reference row of a Mark: the label from the catalog under the same id. */
function shortcutOf(
  id: "bold" | "italic" | "strike" | "underline" | "code" | "superscript" | "subscript"
): ShortcutCommand {
  return { id, group: "marks", tool: id, keys: SHORTCUT_KEYS[id], label: (m) => m[id] };
}

/** Bold: a part of StarterKit. `{}` turns on its default. */
export const BOLD_TOOL: ToolDescriptor = {
  name: "bold",
  starterKit: () => ({ bold: {} }),
  shortcuts: [shortcutOf("bold")],
};

/** Italic: a part of StarterKit. */
export const ITALIC_TOOL: ToolDescriptor = {
  name: "italic",
  starterKit: () => ({ italic: {} }),
  shortcuts: [shortcutOf("italic")],
};

/** Underline: a part of StarterKit. */
export const UNDERLINE_TOOL: ToolDescriptor = {
  name: "underline",
  starterKit: () => ({ underline: {} }),
  shortcuts: [shortcutOf("underline")],
};

/** Strikethrough: a part of StarterKit. */
export const STRIKE_TOOL: ToolDescriptor = {
  name: "strike",
  starterKit: () => ({ strike: {} }),
  shortcuts: [shortcutOf("strike")],
};

/** Inline code: a part of StarterKit. */
export const CODE_TOOL: ToolDescriptor = {
  name: "code",
  starterKit: () => ({ code: {} }),
  shortcuts: [shortcutOf("code")],
};

/** Superscript: a separate Tiptap extension, placed first in `ENGINE_ORDER`. */
export const SUPERSCRIPT_TOOL: ToolDescriptor = {
  name: "superscript",
  engine: () => [Superscript],
  shortcuts: [shortcutOf("superscript")],
};

/** Subscript: a separate Tiptap extension. */
export const SUBSCRIPT_TOOL: ToolDescriptor = {
  name: "subscript",
  engine: () => [Subscript],
  shortcuts: [shortcutOf("subscript")],
};
