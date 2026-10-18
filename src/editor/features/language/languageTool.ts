"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { LanguageToolCommands } from "../../core/toolCommands.js";
import type { LanguageToolOptions } from "../../core/toolOptions.js";
import { LanguageMark } from "./language.js";
import { normalizeLanguageTag } from "./languageTag.js";

/** The menu offers the languages of the kit's catalogs. */
export const LANGUAGE_DEFAULTS: LanguageToolOptions = { languages: ["en", "ru"] };

/**
 * Text part language on the Tool descriptor (ADR-0078): the `language` Mark and its commands. There
 * is no Toolbar button and no shortcut: the "Language ›" submenu lives in the "…" menu of the Toolbar
 * and of the selection menu (`FormatMenus.tsx`), because the `full` Toolbar in 640 px has no room for
 * another control.
 */
export const LANGUAGE_TOOL: ToolDescriptor = {
  name: "language",
  defaults: LANGUAGE_DEFAULTS,
  checks: {
    // A list of tags for the menu. The Schema is wider than the menu (any tag of the right shape
    // passes), but a menu entry must be a tag a screen reader can use.
    languages: (value) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((tag) => normalizeLanguageTag(tag) !== null),
  },
  engine: (context) => [LanguageMark.configure({ locale: context.locale })],
  /*
    `editor.commands` is read on every call, as in `invisibleCharacters`. In Source mode the Document
    is not on screen, and in `readOnly` it cannot be edited: `false`.
  */
  commands: ({ editor, bridge }): LanguageToolCommands => ({
    set: (language) =>
      !bridge.sourceOpen() && editor.isEditable && editor.commands.setLanguage(language),
    unset: () => !bridge.sourceOpen() && editor.isEditable && editor.commands.unsetLanguage(),
  }),
};
