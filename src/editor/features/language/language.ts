"use client";

import { getMarkRange, Mark, mergeAttributes } from "@tiptap/core";
import { Fragment, Slice, type Mark as PmMark, type Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { LANGUAGE_MARK, primaryLanguageOf, type LanguageMarkOptions } from "./languageState.js";
import { isPastedPrimaryLanguage, isPrimaryLanguage, normalizeLanguageTag } from "./languageTag.js";

/**
 * A fragment's language Mark: `<span lang="en">` (the `language` Tool, ADR-0078).
 *
 * WHY A STANDARD ATTRIBUTE. A screen reader, spell checking and hyphenation read `lang` with no
 * code of the kit, in the Editor, in `RichTextView`, in an email and in a PDF (WCAG 3.1.2). A
 * `data-lang` would be read by nobody.
 *
 * THE OUTERMOST MARK. The priority is above the text color (1002), the highlight (1001) and the
 * link (1000), so one language mark covers a phrase of mixed formatting as a single element:
 * `span[lang] › span[data-color] › mark › a › strong`.
 *
 * THE PRIMARY LANGUAGE IS NEVER A MARK. The page's own language (`primaryLanguageOf`) is what the
 * reader hears anyway, so setting it clears the mark, and a paste drops it: Word writes `lang` on
 * every run, and would otherwise cover the whole text with marks.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    language: {
      /**
       * Marks the selection (or the word with the caret, or the next typed text) with a language tag.
       * The tag is brought to its canonical case; a value that is not a BCP 47 tag, gives `false`.
       * The page's primary language clears the mark instead of setting it.
       */
      setLanguage: (language: string) => ReturnType;
      /** Removes the Mark from the selection, or from the whole marked word at the caret. */
      unsetLanguage: () => ReturnType;
    };
  }
}

/** The slice without the Mark where it repeats the primary language. */
function withoutPrimary(content: Fragment, drop: (mark: PmMark) => boolean): Fragment {
  const nodes: PmNode[] = [];
  content.forEach((node) => {
    const inner = node.isLeaf ? node : node.copy(withoutPrimary(node.content, drop));
    const marks = inner.marks.filter((mark) => !drop(mark));
    nodes.push(marks.length === inner.marks.length ? inner : inner.mark(marks));
  });
  return Fragment.fromArray(nodes);
}

export const LanguageMark = Mark.create<LanguageMarkOptions>({
  name: LANGUAGE_MARK,
  priority: 1003,
  // A language is meaning, not looks: Clear formatting and `⌘\` (`unsetAllMarks`) leave it, and the
  // "Remove language mark" item removes it (decision 10 of ADR-0078).
  clearable: false,

  addOptions: () => ({ locale: () => "en" }),

  addAttributes: () => ({
    lang: {
      default: null,
      parseHTML: (element: HTMLElement) => normalizeLanguageTag(element.getAttribute("lang")),
      renderHTML: (attributes: { lang?: string | null }) =>
        attributes.lang ? { lang: attributes.lang } : {},
    },
  }),

  parseHTML() {
    return [
      {
        tag: "span[lang]",
        // A text color on the same element (`<span lang="en" data-color="danger">`) is read by its
        // own rule after this one: the element is not consumed.
        consuming: false,
        // The same rule as the sanitizer's (`schema.ts`): a `span` that is already something else,
        // such as an inline formula (`data-type`), carries no language.
        getAttrs: (element) =>
          !element.hasAttribute("data-type") && normalizeLanguageTag(element.getAttribute("lang"))
            ? {}
            : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  // Markdown has no language: the text stays and the mark is lost, as with the color (`styleExtensions.ts`).
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),

  addCommands() {
    const name = this.name;
    return {
      setLanguage:
        (language) =>
        ({ editor, state, tr, commands, dispatch }) => {
          const tag = normalizeLanguageTag(language);
          if (tag === null) return false;
          if (isPrimaryLanguage(tag, primaryLanguageOf(editor))) {
            return commands.unsetMark(name, { extendEmptyMarkRange: true });
          }
          const type = state.schema.marks[name]!;
          // A caret inside a marked word changes the language of the whole word, as the "…" menu
          // shows it checked there. Elsewhere it sets the mark for the next typed text.
          const range = state.selection.empty
            ? getMarkRange(state.selection.$from, type)
            : undefined;
          if (!range) return commands.setMark(name, { lang: tag });
          if (dispatch) tr.addMark(range.from, range.to, type.create({ lang: tag }));
          return true;
        },
      unsetLanguage:
        () =>
        ({ commands }) =>
          commands.unsetMark(name, { extendEmptyMarkRange: true }),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("languagePaste"),
        props: {
          // Word, Google Docs and browsers keep their `lang`, in its canonical case (the parse rule
          // does that); the marks in the primary language go (decision 8 of ADR-0078). WHY BY THE
          // LANGUAGE SUBTAG ALONE: Word writes `lang=EN-US` on every run, and on `<html lang="en">`
          // the exact comparison would cover the whole text with marks. Only a paste is this loose.
          transformPasted: (slice) => {
            const primary = primaryLanguageOf(this.editor);
            const drop = (mark: PmMark) =>
              mark.type.name === LANGUAGE_MARK &&
              isPastedPrimaryLanguage(String(mark.attrs.lang), primary);
            const content = withoutPrimary(slice.content, drop);
            return content.eq(slice.content)
              ? slice
              : new Slice(content, slice.openStart, slice.openEnd);
          },
        },
      }),
    ];
  },
});
