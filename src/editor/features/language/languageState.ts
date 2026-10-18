"use client";

import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { normalizeLanguageTag } from "./languageTag.js";

/*
  Reading the Text part language (ADR-0078) from the engine: the Mark under the selection and the
  page's primary language. The module has no Tiptap Mark in it, only types: the "…" menu of the
  Toolbar and the Tool state snapshot read these, and neither needs the extension's code.
*/

/** The name of the Mark in the engine and in the Schema. */
export const LANGUAGE_MARK = "language";

/** Options of the Mark's extension. `locale` is the interface locale, the last fallback for the primary language. */
export interface LanguageMarkOptions {
  locale: () => string;
}

/**
 * The page's primary language: the `lang` of the field's nearest ancestor that has one (usually
 * `<html lang>`), the language a screen reader reads the field in. Without one, the interface locale
 * (`UiProvider`), and in the last resort `en`. A `lang` that is not a language tag is skipped, as the
 * browser skips it for speech.
 */
export function primaryLanguageOf(editor: Editor): string {
  let dom: HTMLElement | null = null;
  try {
    dom = editor.isDestroyed ? null : editor.view.dom;
  } catch {
    // The view is not mounted yet: there is no page to ask.
  }
  for (let el = dom?.closest("[lang]"); el; el = el.parentElement?.closest("[lang]") ?? null) {
    const tag = normalizeLanguageTag(el.getAttribute("lang"));
    if (tag !== null) return tag;
  }
  const options = editor.extensionManager.extensions.find(({ name }) => name === LANGUAGE_MARK)
    ?.options as LanguageMarkOptions | undefined;
  return normalizeLanguageTag(options?.locale()) ?? "en";
}

/** What the selection says about the Mark. */
export interface SelectedLanguage {
  /** The one language of the whole selection, or the caret's; `null` for no mark and for a mixed selection. */
  current: string | null;
  /** Whether any text under the selection (or at the caret) carries the Mark: "Remove language mark" has something to remove. */
  marked: boolean;
}

/**
 * The Mark under the selection. A caret reads the stored marks first (what the next typed letter
 * will carry), then the marks around it. A range is `current` only when all its text has the same
 * language: a mix of two languages, or of a language and plain text, is `null`.
 */
export function selectedLanguage(state: EditorState): SelectedLanguage {
  const type = state.schema.marks[LANGUAGE_MARK];
  if (!type) return { current: null, marked: false };
  const { selection } = state;
  if (selection.empty) {
    const mark = (state.storedMarks ?? selection.$from.marks()).find((m) => m.type === type);
    const lang = (mark?.attrs.lang as string | undefined) ?? null;
    return { current: lang, marked: mark !== undefined };
  }
  const found = new Set<string | null>();
  for (const { $from, $to } of selection.ranges) {
    state.doc.nodesBetween($from.pos, $to.pos, (node) => {
      if (node.isInline) {
        found.add(
          (node.marks.find((m) => m.type === type)?.attrs.lang as string | undefined) ?? null
        );
      }
    });
  }
  const [only] = found;
  return { current: found.size === 1 ? (only ?? null) : null, marked: [...found].some(Boolean) };
}
