import type { Editor } from "@tiptap/core";
import type { UiMessages } from "../../../i18n/messages.js";
import { LanguageIcon } from "../../../icons.js";
import type { FormatMenuItem } from "../../ui/FormatMenus.js";
import { isPrimaryLanguage, normalizeLanguageTag } from "./languageTag.js";

/*
  The "Language ›" submenu of the "…" menu (ADR-0078). It lives next to the Mark but apart from it:
  the menu is in the starting graph of the Toolbar, and it needs data and a few commands, not the
  Mark's extension (`language.ts`).
*/

type EditorMessages = UiMessages["editor"];

/** The id of the "Language ›" item in the "…" menu. */
export const LANGUAGE_ITEM = "language";
const SET_PREFIX = "languageSet:";
const REMOVE_ITEM = "languageRemove";

/** What the menu shows of the engine: the mark under the selection and the page's language. */
export interface LanguageMenuState {
  /** The one language of the selection, or `null` (no mark, or a mix). */
  current: string | null;
  /** Some text of the selection carries the mark: "Remove language mark" has something to remove. */
  marked: boolean;
  /** The page's primary language. */
  primary: string;
}

/**
 * The name of a language in the interface language (`Intl.DisplayNames`), with a capital letter:
 * "Русский", "American English". A tag the runtime cannot name is shown as the tag itself.
 */
export function languageName(tag: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(tag);
    return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : tag;
  } catch {
    return tag;
  }
}

/**
 * The "Language ›" item with its submenu: the languages of the `languages` option as radio items
 * (the current one checked, the page's own marked "primary" and checked where there is no mark), and
 * "Remove language mark". A language that is under the selection but not in the option (from Word, or
 * from another screen) is added as a checked item, so the author sees what the text carries.
 *
 * The primary language is an ordinary item: choosing it clears the mark (`setLanguage` does that), as
 * "Remove language mark" does. The two are the same action under two names, and the menu says so.
 */
export function languageMenuItem(
  options: readonly string[],
  state: LanguageMenuState,
  messages: EditorMessages,
  locale: string
): FormatMenuItem {
  const tags = [...new Set(options.flatMap((tag) => normalizeLanguageTag(tag) ?? []))];
  if (state.current !== null && !tags.includes(state.current)) tags.push(state.current);
  const primary = tags.find((tag) => isPrimaryLanguage(tag, state.primary));
  const key = (tag: string) => `${SET_PREFIX}${tag}`;
  const checked = state.current ?? (state.marked ? undefined : primary);
  return {
    id: LANGUAGE_ITEM,
    label: messages.language,
    icon: LanguageIcon,
    submenu: [
      {
        id: "languageList",
        selectionMode: "single",
        selected: checked === undefined ? [] : [key(checked)],
        items: tags.map((tag) => ({
          id: key(tag),
          label:
            tag === primary
              ? messages.languagePrimary({ language: languageName(tag, locale) })
              : languageName(tag, locale),
        })),
      },
      {
        id: "languageClear",
        items: [{ id: REMOVE_ITEM, label: messages.languageRemove, disabled: !state.marked }],
      },
    ],
  };
}

/** Runs a submenu item of "Language ›". `false` means the id is not one of its items. */
export function applyLanguageItem(editor: Editor, id: string): boolean {
  if (id === REMOVE_ITEM) {
    editor.chain().focus().unsetLanguage().run();
    return true;
  }
  if (!id.startsWith(SET_PREFIX)) return false;
  editor.chain().focus().setLanguage(id.slice(SET_PREFIX.length)).run();
  return true;
}
