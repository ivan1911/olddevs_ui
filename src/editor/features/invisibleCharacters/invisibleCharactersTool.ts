"use client";

import { InvisibleCharacters } from "@tiptap/extension-invisible-characters";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { InvisibleCharactersToolCommands } from "../../core/toolCommands.js";
import type { InvisibleCharactersToolOptions } from "../../core/toolOptions.js";
import { toggleInvisibleCharacters } from "./invisibleCharactersVisible.js";

/**
 * The default Tool option: invisible characters are hidden. The Tiptap extension defaults to
 * `true`, but the Tool is part of `full`, and a kit update must not change how each such Editor
 * looks. The author turns the display on, with the button or the option.
 */
export const INVISIBLE_CHARACTERS_DEFAULTS: InvisibleCharactersToolOptions = { visible: false };

/**
 * Showing invisible characters on the Tool's description (ADR-0048). This is a Decoration over
 * the Document: spaces, hard breaks (`Shift+Enter`) and paragraph ends are drawn by zero-width
 * widgets that are not in the Document. `value`, `onChange`, `getHTML()`, Markdown and
 * `RichTextView` do not see them, and the Schema, the sanitizer and Markdown do not change.
 *
 * "Invisible characters" is a checkbox item in the "…" menu of the fixed Toolbar
 * (`FormatMenus.tsx`), not a button in the row and not a `buttons` entry. A separate button pushed
 * `full` onto a second row in the 640 px column (the owner's decision). The `buttons` entries are
 * shared by the fixed and the floating Toolbar, where a switch for showing the Document's
 * characters makes no sense above a selection. The Tool has no shortcut and no Insert menu item.
 */
export const INVISIBLE_CHARACTERS_TOOL: ToolDescriptor = {
  name: "invisibleCharacters",
  defaults: INVISIBLE_CHARACTERS_DEFAULTS,
  checks: { visible: (value) => typeof value === "boolean" },
  /*
    The extension's own CSS (`injectCSS`) is not needed. It would add a `<style>` to the page's
    `head` with its own `#aaa` color, bypassing the theme tokens. The kit sets the look of the
    markers (`prose.ts`) through the same classes.
  */
  engine: (_context, options) => [
    InvisibleCharacters.configure({
      visible: (options as InvisibleCharactersToolOptions | undefined)?.visible === true,
      injectCSS: false,
    }),
  ],
  /*
    `editor.commands` is read on every call, as in `search`. In Source mode the Document is not
    on screen, so there is nothing to toggle: `false` (the "…" menu is locked in that mode).
  */
  commands: ({ editor, bridge }): InvisibleCharactersToolCommands => ({
    toggle: () => !bridge.sourceOpen() && toggleInvisibleCharacters(editor),
  }),
};
