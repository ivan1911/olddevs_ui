"use client";

import { Extension } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState, Selection, Transaction } from "@tiptap/pm/state";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findMatches, type SearchMatch, type SearchOptions } from "./searchMatch.js";

/**
 * Find state in the engine: the query, the options, the matches and the current match.
 * The plugin holds it, not React: matches are recalculated in the same transaction that
 * changes the Document, so the highlight never lags behind the text, not even by a frame.
 * The panel only reads it (`searchState`) and sends commands.
 */
interface SearchPluginState {
  query: string;
  options: SearchOptions;
  matches: SearchMatch[];
  /** Index of the current match; −1 means there are no matches. */
  current: number;
  error?: string;
  decorations: DecorationSet;
}

type SearchMeta =
  | { type: "set"; query: string; options?: Partial<SearchOptions> }
  | { type: "select"; index: number }
  /**
   * Replace changed a match other than the current one (the current one is a formula):
   * search on from the caret.
   */
  | { type: "replaced" }
  | { type: "clear" };

const SEARCH_KEY = new PluginKey<SearchPluginState>("search");

const EMPTY_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false, regex: false };

/**
 * What the panel needs to know about the search. `undefined` means the `search` Tool is
 * not in the set.
 */
export function searchState(state: EditorState):
  | {
      query: string;
      options: SearchOptions;
      current: number;
      total: number;
      error?: string;
      matches: readonly SearchMatch[];
    }
  | undefined {
  const plugin = SEARCH_KEY.getState(state);
  if (!plugin) return undefined;
  const { query, options, current, matches, error } = plugin;
  return { query, options, current, total: matches.length, error, matches };
}

/**
 * Selection of a match: text is a range, a formula is the whole node. A range across a
 * block formula would select something outside the text, and across an inline one it
 * would differ from a node selection only in Chromium.
 */
export function matchSelection(doc: PmNode, { from, to, formula }: SearchMatch): Selection {
  return formula ? NodeSelection.create(doc, from) : TextSelection.create(doc, from, to);
}

function decorate(state: EditorState, matches: SearchMatch[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  return DecorationSet.create(
    state.doc,
    matches.map(({ from, to, formula }, index) => {
      const attributes = {
        class: index === current ? "rte-search-match rte-search-current" : "rte-search-match",
      };
      // A formula is an atom rendered as a node: highlight the whole node, not a text range in it.
      return formula
        ? Decoration.node(from, to, attributes)
        : Decoration.inline(from, to, attributes);
    })
  );
}

/**
 * Index of the first match at or after the position. If there is none, the first match,
 * wrapping around.
 */
function indexFrom(matches: SearchMatch[], pos: number): number {
  if (matches.length === 0) return -1;
  const found = matches.findIndex((match) => match.from >= pos);
  return found === -1 ? 0 : found;
}

function build(
  state: EditorState,
  query: string,
  options: SearchOptions,
  current: (matches: SearchMatch[]) => number
): SearchPluginState {
  const { matches, error } = findMatches(state.doc, query, options);
  const index = current(matches);
  return {
    query,
    options,
    matches,
    current: index,
    error,
    decorations: decorate(state, matches, index),
  };
}

/**
 * Flags after `setSearch`: the ones named in `named` replace the previous values, the rest
 * stay. A key with the value `undefined` counts as not named: a plain merge
 * `{ ...a, ...b }` would erase the flag, and a call like `setQuery(q, { matchCase: value })`
 * with an optional value from the screen changes nothing.
 */
function withNamedFlags(current: SearchOptions, named: Partial<SearchOptions> = {}): SearchOptions {
  const next = { ...current };
  for (const key of Object.keys(named) as (keyof SearchOptions)[]) {
    const value = named[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}

/**
 * @param flags flags without a query: until the first `setSearch` and after `clearSearch`
 * (the Tool options). A search in progress keeps its own.
 */
function searchPlugin(flags: SearchOptions) {
  return new Plugin<SearchPluginState>({
    key: SEARCH_KEY,
    state: {
      init: (_, state) => build(state, "", flags, () => -1),
      apply(tr: Transaction, previous, _old, state) {
        const meta = tr.getMeta(SEARCH_KEY) as SearchMeta | undefined;
        if (meta?.type === "clear") return build(state, "", flags, () => -1);
        if (meta?.type === "set") {
          return build(
            state,
            meta.query,
            withNamedFlags(previous.options, meta.options),
            (matches) => indexFrom(matches, state.selection.from)
          );
        }
        if (meta?.type === "select") {
          return {
            ...previous,
            current: meta.index,
            decorations: decorate(state, previous.matches, meta.index),
          };
        }
        if (!tr.docChanged || previous.query === "") return previous;
        /*
          Document edit: the matches are recalculated in full, because the query may have
          found a match in the new text or lost one in the old. The current match stays at
          the place of the previous current one (or the first one after it).
        */
        const anchor = previous.matches[previous.current];
        const pos =
          anchor && meta?.type !== "replaced"
            ? tr.mapping.map(anchor.from, -1)
            : state.selection.from;
        return build(state, previous.query, previous.options, (matches) => indexFrom(matches, pos));
      },
    },
    props: {
      decorations: (state) => SEARCH_KEY.getState(state)?.decorations,
    },
  });
}

/**
 * Replacement text for a match. With a regular expression, `$1…$9`, `$&` (the whole match)
 * and `$$` (a dollar sign) are filled in from the groups the search kept for the match
 * (`SearchMatch.captures`). Without an expression the replacement is used as is, so `$1`
 * stays `$1`.
 */
function replacementFor(match: SearchMatch, replacement: string, options: SearchOptions) {
  if (!options.regex) return replacement;
  return replacement.replace(/\$(\$|&|[1-9])/g, (token, key: string) => {
    if (key === "$") return "$";
    if (key === "&") return match.captures[0] ?? "";
    const index = Number(key);
    return index < match.captures.length ? (match.captures[index] ?? "") : token;
  });
}

/**
 * Replace the range with text, keeping the Marks at the start of the match. An empty
 * replacement deletes the range.
 */
function replaceRange(tr: Transaction, { from, to }: SearchMatch, text: string) {
  if (text === "") {
    tr.delete(from, to);
    return;
  }
  const marks = tr.doc.nodeAt(from)?.marks ?? [];
  tr.replaceWith(from, to, tr.doc.type.schema.text(text, marks));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      /**
       * A new query or flags: the matches are recalculated, and the current match becomes
       * the first one after the caret. Flags that are not named stay as they were.
       */
      setSearch: (query: string, options?: Partial<SearchOptions>) => ReturnType;
      /**
       * The next (`1`) or previous (`-1`) match, wrapping around; selects it. ProseMirror
       * scrolls only when focus is in the Document; from the search field the panel
       * scrolls to the match (`revealMatch.ts`).
       */
      searchStep: (step: 1 | -1) => ReturnType;
      /**
       * Replace the current match: one edit, one undo. Formulas are skipped: if the
       * current match is a formula, the next text match after it is replaced. If there
       * is nothing to replace, `false`.
       */
      replaceMatch: (replacement: string) => ReturnType;
      /**
       * Replace all text matches: one transaction, one undo. Formulas are not touched and
       * stay matches: the counter after the replacement still counts them.
       */
      replaceAllMatches: (replacement: string) => ReturnType;
      /** Clear the query and the highlight; the flags return to the Tool options. */
      clearSearch: () => ReturnType;
    };
  }
}

export interface SearchExtensionOptions {
  /** The flags the search starts with and returns to: the Tool options. */
  flags: SearchOptions;
  /**
   * Open the Find panel (`replace`: with focus in the replace field). The panel is held
   * by `RichTextEditor`. `false` means there is no panel, and `Mod+F` goes to the browser.
   */
  open: (replace: boolean) => boolean;
}

/**
 * Find and replace in the Document: the state and the highlight live in the plugin,
 * along with the commands for the panel and the shortcuts. It has no Schema of its own,
 * the same as `clearFormatting`.
 *
 * `Mod+F` is taken only when focus is in the Document: outside the field the browser
 * searches the page as usual, as Google Docs and Notion do.
 */
export const SearchExtension = Extension.create<SearchExtensionOptions>({
  name: "search",
  addOptions: () => ({ open: () => false, flags: EMPTY_OPTIONS }),
  addProseMirrorPlugins() {
    return [searchPlugin(this.options.flags)];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-f": () => this.options.open(false),
      "Mod-Alt-f": () => this.options.open(true),
    };
  },
  addCommands() {
    return {
      setSearch:
        (query, options) =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(SEARCH_KEY, { type: "set", query, options } satisfies SearchMeta);
          return true;
        },
      searchStep:
        (step) =>
        ({ state, tr, dispatch }) => {
          const search = SEARCH_KEY.getState(state);
          if (!search || search.matches.length === 0) return false;
          const total = search.matches.length;
          const index = search.current === -1 ? 0 : (search.current + step + total) % total;
          const match = search.matches[index]!;
          if (dispatch) {
            tr.setMeta(SEARCH_KEY, { type: "select", index } satisfies SearchMeta);
            tr.setSelection(matchSelection(tr.doc, match)).scrollIntoView();
          }
          return true;
        },
      replaceMatch:
        (replacement) =>
        ({ state, tr, dispatch, editor }) => {
          const search = SEARCH_KEY.getState(state);
          const current = search?.matches[search.current];
          if (!search || !current || !editor.isEditable) return false;
          // Replace skips formulas: the nearest text match, wrapping around, is taken.
          const total = search.matches.length;
          const match = [...search.matches.keys()]
            .map((offset) => search.matches[(search.current + offset) % total]!)
            .find((candidate) => !candidate.formula);
          if (!match) return false;
          if (dispatch) {
            if (match !== current)
              tr.setMeta(SEARCH_KEY, { type: "replaced" } satisfies SearchMeta);
            replaceRange(tr, match, replacementFor(match, replacement, search.options));
            // The caret moves past the replacement, so the next match becomes current.
            tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(match.to)));
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, tr, dispatch, editor }) => {
          const search = SEARCH_KEY.getState(state);
          const texts = search?.matches.filter((match) => !match.formula) ?? [];
          if (!search || texts.length === 0 || !editor.isEditable) return false;
          if (dispatch) {
            // Back to front: a replacement does not shift the ranges not yet replaced.
            for (const match of texts.reverse()) {
              replaceRange(tr, match, replacementFor(match, replacement, search.options));
            }
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(SEARCH_KEY, { type: "clear" } satisfies SearchMeta);
          return true;
        },
    };
  },
});
