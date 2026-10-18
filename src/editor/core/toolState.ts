import type { SearchToolOptions, TocLevel } from "./toolOptions.js";

/*
  Snapshots of the built-in Tools' state: plain data for
  `useRichTextToolState`. A types-only module, server-safe, like
  `toolOptions.ts`: the `RichTextTools` map refers to it in the `state` part.
  Snapshots contain no DOM nodes, ProseMirror positions or functions, so they can
  be compared by value, serialized and passed across the RSC boundary.
*/

/** State of the `search` Tool (ADR-0058). */
export interface SearchToolState {
  /** The Find panel is open. */
  open: boolean;
  /**
   * The query. Closing the panel clears the query and its highlight; without the
   * panel, the query is set by the `setQuery` command.
   */
  query: string;
  /**
   * Find flags. Closing the panel resets them to the starting values from the
   * Tool's options, which the panel reopens with.
   */
  flags: Readonly<SearchToolOptions>;
  /** How many matches of the query are in the Document. */
  total: number;
  /** Index of the current match, from 0; `-1` means there are no matches. */
  current: number;
  /**
   * Error text if the query is an invalid regular expression (the JavaScript engine's
   * message, not localized); otherwise `null`. There are no matches when there is an error.
   */
  error: string | null;
}

/** Heading in the `toc` Tool's state: an entry of the Table of contents. */
export interface TocToolHeading {
  /** Level from the tag: 1 for `h1` … 4 for `h4`. */
  level: TocLevel;
  /** Entry text: the heading's text without markup and without outer whitespace. */
  text: string;
  /** Position of the entry in the Table of contents list, from 0; the current section uses it to find its heading. */
  index: number;
}

/** State of the `toc` Tool (ADR-0068). */
export interface TocToolState {
  /**
   * Headings of the Document in reading order, the same as in the strip and the Table
   * of contents list: headings at the top level and inside Wrappers, only the levels
   * from the `levels` option, no empty ones. The list is returned even with a single
   * heading, though then there is no strip.
   */
  headings: readonly TocToolHeading[];
  /** Index of the current section in `headings`, from 0; `-1` means there are no headings. Follows scrolling. */
  current: number;
}

/** A footnote in the `footnotes` Tool's state. */
export interface FootnotesToolNote {
  /** The footnote's number, from 1: its place in the list, which is the order of the references in the text. */
  number: number;
  /** The footnote's text without markup; a hard break is a line break. */
  text: string;
}

/** State of the `footnotes` Tool (ADR-0076). */
export interface FootnotesToolState {
  /** The footnotes in order: the same as the list at the end of the Document. Empty when there are none. */
  footnotes: readonly FootnotesToolNote[];
  /**
   * The number of the current footnote: the caret is in its text, or its reference is selected.
   * `null` when the caret is anywhere else.
   */
  current: number | null;
}

/** State of the `invisibleCharacters` Tool (based on the Invisible Characters extension from Tiptap, ADR-0048). */
export interface InvisibleCharactersToolState {
  /** Spaces, soft hyphens and paragraph ends are shown. Hidden until the author turns them on or the `visible` option applies. */
  visible: boolean;
}

/** State of the `blockSelection` Tool (ADR-0077). */
export interface BlockSelectionToolState {
  /** How many Blocks are selected whole; `0` means there is no Block selection (a caret or a text selection). */
  count: number;
}

/** State of the `language` Tool (Text part language, ADR-0078). */
export interface LanguageToolState {
  /**
   * The language mark under the selection: the tag at the caret, or the one tag of a whole
   * selection. `null` means no mark there, or a selection that mixes two languages (or a language
   * and plain text).
   */
  current: string | null;
  /**
   * The page's primary language, the one the reader hears where there is no mark: the `lang` of the
   * field's nearest ancestor (usually `<html lang>`), without one the interface locale. In the
   * canonical case of BCP 47 (`en-US`). Marking text with it clears the mark.
   */
  primary: string;
}
