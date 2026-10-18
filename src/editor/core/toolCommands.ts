import type { RichTextTools, SearchToolOptions } from "./toolOptions.js";

/*
  Tool commands: the types of what the screen calls through `handle.tool(name)`.
  The module is safe on the server, like `toolOptions.ts`: types only, without Tiptap or React.
  The built-in implementations sit next to their descriptions (`searchTool.ts`, `tocTool.ts`).
*/

/**
 * Commands of the `search` Tool. Each returns a `boolean`: done or not (Source mode, no matches,
 * the field cannot be edited). The commands behave like the Find and replace panel: the same query,
 * the same checkboxes, the same highlighting. The query and the checkboxes live in the engine, so
 * `setQuery`, `next` and `replace` work even without an open panel, and they can be used to build
 * your own search UI.
 */
export interface SearchToolCommands {
  /**
   * Opens the panel: the same as the Search button and `Mod+F`. `query` puts the query into the
   * field and into the Document's highlight at once; without it, the query is the text selected in
   * one Block. `replace` moves focus to the replace field. The checkboxes on an open panel do not
   * change; on a closed panel, the panel starts with the Tool options. `false` in Source mode (there
   * is no Document on screen).
   */
  open(options?: { replace?: boolean; query?: string }): boolean;
  /**
   * Closes the panel and removes the highlight. Focus and caret stay where they were: unlike Escape
   * in the panel, the command does not move them into the Document. A panel that is already closed
   * is not an error: the highlight is removed anyway.
   */
  close(): boolean;
  /**
   * Sets the query. Flags not named in `flags` (and flags with the value `undefined`) are taken from
   * the open panel, and if there is none, from the Tool options. An open panel shows the new query
   * and flags. A non-empty query scrolls to the first match after the caret, as `next` does (the
   * scroll arrives a little later). `true` means the query is applied, even if there are no matches
   * (their count is the Tool state); `false` in Source mode.
   */
  setQuery(query: string, flags?: Partial<SearchToolOptions>): boolean;
  /**
   * Next match, cycling around: selects it and scrolls the nearest scrollable area of the field, or
   * the window, to it, as the panel does, even when focus is outside the Document. Focus is not
   * taken. The scroll arrives a little after the call (as a microtask and on a frame), since its code
   * loads on the first call. `false` means there are no matches.
   */
  next(): boolean;
  /**
   * Previous match, cycling around. Selects and scrolls, as `next` does. `false` means there are no
   * matches.
   */
  previous(): boolean;
  /**
   * Replaces the current match: one edit, one undo. The next match becomes current. `false` means
   * there are no matches, or the field cannot be edited.
   */
  replace(text: string): boolean;
  /** Replaces all matches: one edit, one undo. The conditions are the same as for `replace`. */
  replaceAll(text: string): boolean;
}

/** Commands of the `toc` Tool. */
export interface TocToolCommands {
  /**
   * Moves to a heading of the Table of contents list, as a click on an item does. The index is
   * counted in the same list as the items: with `levels` taken into account, from zero, and with
   * empty headings skipped. When the Editor is editable, the caret goes to the end of the heading;
   * in `readOnly`, the heading itself gets focus. Scrolling puts it below the sticky header
   * (`offsetVar`) and the Toolbar, and the heading's highlight fades.
   *
   * `false` means there is no heading with that index, or the Table of contents is not ready yet:
   * its UI loads as a separate chunk after the engine is created, and in Source mode it does not
   * exist. Fewer than two headings is not a reason to refuse: the strip is not rendered, but the
   * list exists, and the jump works.
   */
  jumpTo(index: number): boolean;
}

/** Commands of the `invisibleCharacters` Tool. */
export interface InvisibleCharactersToolCommands {
  /**
   * Shows the invisible characters if they are hidden, and hides them if they are shown: the same as
   * the "Invisible characters" item of the "…" menu. The Document and `value` do not change, and
   * `onChange` is not called. The new value is read by the Tool state (`visible`). `false` in Source
   * mode (there is no Document on screen).
   */
  toggle(): boolean;
}

/** Commands of the `fullscreen` Tool (ADR-0082). Each returns a `boolean`: done or not. */
export interface FullscreenToolCommands {
  /** Expands the field to the whole window, the same as the "Fullscreen" item of the "…" menu. `false` in Source mode, in a disabled field, and when it is already open. */
  open(): boolean;
  /** Collapses the field to its place on the page. `false` when it is not open. */
  close(): boolean;
  /** Opens the field if it is collapsed and collapses it if it is open. `false` where `open()` is refused. */
  toggle(): boolean;
}

/** Commands of the `focus` Tool (ADR-0082). */
export interface FocusToolCommands {
  /**
   * Turns the focus mode on if it is off and off if it is on: the same as the "Focus mode" item of
   * the "…" menu. The Document and `value` do not change, and `onChange` is not called. The new
   * value is read by the Tool state (`enabled`). `false` in Source mode (there is no Document on screen).
   */
  toggle(): boolean;
}

/** Commands of the `date` Tool (the date mention, ADR-0079). */
export interface DateToolCommands {
  /**
   * Inserts a date mention at the caret (or over the selection) in one edit. `value` is a calendar
   * date `YYYY-MM-DD` or a date with a time and the author's offset, `YYYY-MM-DDTHH:MM±HH:MM`; its text
   * is written in the current locale by the Tool's `format` option. Without `value` it opens the same
   * popover as the Slash menu item, with the calendar on today. `true` means the mention is inserted
   * or the popover is opened. `false` means the field is read-only, source mode is open, or `value`
   * is not a date in the two forms (a day that does not exist, a time without an offset).
   */
  insert(value?: string): boolean;
}

/** Commands of the `language` Tool (Text part language, ADR-0078). */
export interface LanguageToolCommands {
  /**
   * Marks the selection with a language: a tag of the BCP 47 shape (`"en"`, `"de-CH"`), in any case,
   * not only one of the `languages` option. A caret in the middle of a marked word changes the
   * language of that whole word; a caret elsewhere sets the language for the text typed next. The
   * page's primary language (`primary` in the Tool state) does not make a mark: it removes the
   * existing one, the same as `unset()`, and gives `true`. `false` means the value is not a language
   * tag, the field cannot be edited, or Source mode is open (there is no Document on screen).
   */
  set(language: string): boolean;
  /**
   * Removes the language mark from the selection, or from the whole marked word at the caret: the
   * "Remove language mark" item of the menu. `false` in `readOnly` and in Source mode. Clear
   * formatting does not do this: a language is meaning, not looks.
   */
  unset(): boolean;
}

/**
 * Commands of the `blockSelection` Tool (ADR-0077). Each returns a `boolean`: done or not.
 */
export interface BlockSelectionToolCommands {
  /**
   * Selects the current Blocks whole, the same as `Esc` in the text: a caret gives its Block (in a
   * list, the item; in a table, the whole table), a text selection across several Blocks gives all of
   * them. The selection is made without moving focus. `false` in Source mode, in a disabled field,
   * and where the selection is in no Block (a caret between Blocks). It works in `readOnly`, where
   * the Blocks can be copied.
   */
  selectCurrent(): boolean;
  /**
   * Ends the Block selection and puts the caret at the end of its first Block, the same as the
   * second `Esc` (without letting the key through to a window around the Editor). `false` when no
   * Blocks are selected.
   */
  clear(): boolean;
}

/**
 * Commands of the `footnotes` Tool (ADR-0076). Each returns a `boolean`: done or not.
 */
export interface FootnotesToolCommands {
  /**
   * Inserts a footnote reference at the end of the selection, makes its footnote in the list, and
   * puts the caret into the footnote's text: the same as the "Footnote" item of the Slash menu. One
   * edit, one undo. `false` in `readOnly`, in a disabled field and in Source mode, and where a
   * reference cannot stand: in code, in a formula, in a footnote.
   */
  insert(): boolean;
  /**
   * Puts the caret at the end of footnote `number` (from 1) and scrolls to it, as a click on its
   * reference does. Works in `readOnly`, where the Document does not change. `false` for a number
   * that has no footnote, in a disabled field and in Source mode.
   */
  goToFootnote(number: number): boolean;
  /**
   * Puts the caret right after the reference of footnote `number` (from 1) and scrolls to it, as the
   * footnote's number button does. The conditions are the same as for `goToFootnote`.
   */
  goToReference(number: number): boolean;
}

/**
 * Commands of a Tool by name from the `RichTextTools` map. A name outside the map gives `unknown`:
 * typing is optional, and the Tool works without it.
 */
export type ToolCommandsOf<Name extends string> = Name extends keyof RichTextTools
  ? RichTextTools[Name] extends { commands: infer Commands }
    ? Commands
    : unknown
  : unknown;
