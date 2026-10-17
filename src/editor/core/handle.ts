"use client";

import { createNodeFromContent, type JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Fragment } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { textBetween } from "./atomText.js";
import { isRichTextDocument, type RichTextDocument } from "./jsonDocument.js";
import type { ToolCommandsOf } from "./toolCommands.js";
import type { RichTextTools } from "./toolOptions.js";

export {
  clearToolSignals,
  notifyHandleEditor,
  publishToolSignals,
  watchHandleEditor,
} from "./handleWatchers.js";

/**
 * Flat Handle methods (ADR-0058, section 8): what a screen does with the Editor most often. The rest
 * is `editor` (commands of Marks, Blocks and custom Tools).
 *
 * They are described by a separate interface, which `RichTextEditorHandle` extends: the body of
 * `RichTextEditor.tsx` stays compact, and all the Handle logic lives here.
 *
 * BEFORE MOUNT THE METHODS ARE SILENT. The engine is created in the browser after the first render,
 * and there is none on the server: reads return the known value, writes and focus do nothing, insert
 * returns `false`. Call queues and exceptions are rejected: a screen that calls a method too early
 * loses nothing silently and does not crash. Readiness as an event is `onReady`.
 */
export interface RichTextEditorHandleMethods {
  /**
   * Focus the Document: `"end"` puts the caret at the end (the default), `"start"` at the start,
   * `"restore"` where the selection was before focus left (for example, after one of the Editor's
   * own dialogs or menus, or an external panel). In Source mode, the focus goes to the HTML field.
   */
  focus(position?: "start" | "end" | "restore"): void;
  /** Remove focus from the Document (in Source mode, from the HTML field). */
  blur(): void;
  /**
   * Insert HTML at the caret, replacing the selection. `true` means inserted; `false` means not
   * inserted: there is no engine yet, the field is read-only or disabled, the insert would exceed
   * `maxLength`, or the Schema dropped everything inserted (for example, a Block of a disabled Tool).
   *
   * The insert goes through the Schema, like an incoming `value`, and does not take focus itself.
   * It is a User edit: a separate history step, `onChange` after `changeDelay`, and the `maxLength`
   * limit applies — an insert that would go over it is not performed at all, rather than cut in the
   * middle.
   */
  insertHTML(html: string): boolean;
  /**
   * Insert text at the caret, replacing the selection — literally, without parsing HTML. A line break
   * becomes a hard break (in a code block, the newline character). Returns and behaves like
   * `insertHTML`.
   */
  insertText(text: string): boolean;
  /**
   * The Document's text without markup; Blocks are separated by a blank line, and an Atom is
   * represented by its Atom text (`atomText.ts`). Before mount, `""`. In Source mode it first
   * applies the edit made in the HTML field, as `getHTML()` does.
   */
  getText(): string;
  /**
   * The selected text by the same rule as `getText()`: an Atom is included only in full. For a
   * collapsed selection (a bare caret) and before mount, `""`.
   */
  getSelectedText(): string;
  /**
   * Whether the Document is empty, by the same rule as `required`: content is text, any Atom (a
   * horizontal rule, an image, a hard break, a custom one even without text) and a table, including
   * one with empty cells; an empty paragraph, heading, list or quote is not content. Before mount,
   * it evaluates the incoming value under the same rule; a custom Block always counts as content.
   */
  isEmpty(): boolean;
  /**
   * Undo an edit (a User edit: `onChange` after `changeDelay`). Works when the `history` Tool is
   * enabled; otherwise, before mount, in Source mode and in a field the author cannot edit, it does
   * nothing.
   */
  undo(): void;
  /** Redo an undone edit. The conditions are the same as for `undo()`. */
  redo(): void;
  /** Whether there is something to undo. Without the `history` Tool and before mount, `false`. */
  canUndo(): boolean;
  /** Whether there is something to redo. Without the `history` Tool and before mount, `false`. */
  canRedo(): boolean;
  /**
   * Tool commands: `handle.tool("search")?.open({ query: "TODO" })`, `handle.tool("toc")?.jumpTo(2)`.
   * The type of the commands is derived from the name through the `RichTextTools` map. `null` if the
   * Tool is not in the `tools` set, it has no commands, or the engine is not created yet — so the
   * commands of a disabled Tool are unavailable both in the types (`?.`) and at runtime.
   *
   * Each command returns a `boolean`: performed or not (HTML mode, no matches, no heading, the field
   * cannot be edited) — as `insertHTML` does. A name outside the map (a custom Tool without typing)
   * gives `unknown`.
   */
  tool<Name extends keyof RichTextTools>(name: Name): ToolCommandsOf<Name> | null;
  tool(name: string): unknown;
}

/** What the Handle needs from the Editor: the engine and what only it knows. */
export interface HandleHost {
  editor: Editor | null;
  /** The field accepts user edits: not `readOnly` and not disabled. */
  editable: boolean;
  /** The last HTML known to the owner of the value; the answer before mount. */
  known: () => string;
  /**
   * Initial envelope from `defaultValue`: before mount there is no HTML for it yet — only the engine
   * knows the Schema — and the envelope's tree decides emptiness.
   */
  initialDocument: () => RichTextDocument | undefined;
  /**
   * Table in the Schema: only then is it content, even before mount. Without the `table` Tool the
   * Schema would drop it on parse, and an empty table would become an empty field.
   */
  tables: boolean;
  /** HTML mode is open: the Document is hidden, and the author edits the HTML field. */
  sourceOpen: () => boolean;
  sourceField: () => HTMLTextAreaElement | null;
  /** Apply the HTML field edit to the Document (the same as on `getHTML()`). */
  applySource: () => void;
  /** Rewrite the HTML field from scratch: the Document changed from outside the field. */
  rewriteSource: (editor: Editor) => void;
  /** Whether the Document is empty by the kit's rule, taking into account an unapplied edit of the HTML field. */
  fieldEmpty: (editor: Editor) => boolean;
  /** Commands of a Tool in the set; `null` means there is no Tool or no commands (`ToolDescriptor.commands`). */
  commands: (name: string) => object | null;
}

/** A whole tag; a comment and the content of `script`/`style`/`template` are not seen by the Schema parse. */
const TAG = /<[^>]*>/g;
const UNSEEN = /<!--[\s\S]*?-->|<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
/**
 * Leaves of the Document — content even without text: a hard break, a rule, an image, a custom Block.
 * Before the engine, a custom Block is always content: only its Extensions know whether it is an
 * Atom, and an Atom without text is content too.
 */
const LEAF = /<(?:br|hr|img)\b|\sdata-block\s*=\s*["']?[A-Za-z][A-Za-z0-9]*_/i;
/** A table is content even with empty cells (`emptiness.ts`). */
const TABLE = /<table\b/i;
/** In a code block spaces are text; parsing strips only the newline at the end. */
const CODE = /<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi;

/**
 * An empty incoming value before the engine, by the kit's emptiness rule (`emptiness.ts`, which
 * `required` and `isEmpty()` rely on after mount). The HTML cannot be parsed by the Schema without an
 * engine (there is no DOM on the server), so we judge by the string: it is empty if there is no leaf,
 * no table (with `table` enabled) and no text. Empty wrappers (paragraph, heading, list, quote, Mark)
 * are not content; parsing collapses whitespace between tags, while a non-breaking space and a
 * character reference are text.
 */
function isBlankHtml(html: string, tables: boolean): boolean {
  const seen = html.replace(UNSEEN, "");
  if (LEAF.test(seen) || (tables && TABLE.test(seen))) return false;
  const text = seen
    .replace(CODE, (_, code: string) => (code.replace(TAG, "").replace(/\n$/, "") ? "x" : ""))
    .replace(TAG, "");
  return /^[ \t\n\f\r]*$/.test(text);
}

/** Leaves of the tree — content even without text; the rule is the same as for `LEAF`. */
const LEAF_NODES: ReadonlySet<string> = new Set(["hardBreak", "horizontalRule", "image"]);
/** A custom Block — a name with the Tool prefix, as with `data-block` in `LEAF`. */
const CUSTOM_NODE = /^[A-Za-z][A-Za-z0-9]*_/;

/**
 * An empty initial envelope before the engine, by the same rule as `isBlankHtml` but over the tree:
 * it is empty if there is no leaf, no table (with `table` enabled), no custom Block and no text.
 * Spaces in the envelope are not collapsed (`jsonDocument.ts`), so a space is already text. A rejected
 * envelope gives an empty Document, so it counts as empty.
 */
function isBlankDocument(value: RichTextDocument, tables: boolean): boolean {
  if (!isRichTextDocument(value)) return true;
  const filled = (node: JSONContent | null | undefined): boolean => {
    if (!node || typeof node !== "object") return false;
    const type = String(node.type ?? "");
    if (type === "text") return !!node.text;
    if (LEAF_NODES.has(type) || CUSTOM_NODE.test(type) || (tables && type === "table")) return true;
    return Array.isArray(node.content) && node.content.some(filled);
  };
  return !filled(value.doc);
}

function usable(editor: Editor | null): editor is Editor {
  return editor !== null && !editor.isDestroyed;
}

/**
 * A User edit through a command chain. `true` if the Document changed: the engine silently rejects a
 * transaction that the limit did not let through, and this shows as an unchanged document reference.
 * `closeHistory` on both sides makes the insert a separate history step — undo removes it alone, not
 * together with the typing before it.
 */
function authorEdit(
  host: HandleHost,
  change: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>
): boolean {
  const { editor } = host;
  if (!usable(editor) || !host.editable) return false;
  host.applySource();
  const before = editor.state.doc;
  change(
    editor.chain().command(({ tr }) => {
      closeHistory(tr);
      return true;
    })
  ).run();
  if (editor.state.doc === before) return false;
  editor.view.dispatch(closeHistory(editor.state.tr));
  host.rewriteSource(editor);
  return true;
}

/**
 * Parsing the insert's HTML through the Schema, as for an incoming `value`. `null` if the Schema
 * dropped everything: in that case Tiptap's `insertContent` would insert the STRING as text (the
 * characters "<hr>"), and we need a refusal.
 */
function parseHtml(editor: Editor, html: string) {
  // For a string Tiptap always returns a fragment.
  const content = createNodeFromContent(html, editor.schema) as Fragment;
  return content.size > 0 ? content : null;
}

/** Text with lines: a line break is a hard break of the Document, and in code it is the character itself. */
function textContent(text: string, inCode: boolean): JSONContent[] {
  if (inCode) return [{ type: "text", text }];
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line, index): JSONContent[] => [
      ...(index > 0 ? [{ type: "hardBreak" }] : []),
      ...(line ? [{ type: "text", text: line }] : []),
    ]);
}

/** Handle methods on top of the Editor's engine. */
export function createHandleMethods(host: HandleHost): RichTextEditorHandleMethods {
  const { editor } = host;
  const history = (command: "undo" | "redo") => {
    // HTML mode: the Document is hidden, and the HTML field has its own native undo.
    if (!usable(editor) || !host.editable || host.sourceOpen()) return;
    // Without the `history` Tool the engine has no such command — undo is silent.
    if (typeof editor.commands[command] === "function") editor.commands[command]();
  };
  const available = (command: "undo" | "redo") => {
    if (!usable(editor) || !host.editable || host.sourceOpen()) return false;
    const can = editor.can()[command] as (() => boolean) | undefined;
    return can?.() === true;
  };

  return {
    focus: (position = "end") => {
      if (host.sourceOpen()) {
        const field = host.sourceField();
        field?.focus();
        if (position === "start") field?.setSelectionRange(0, 0);
        else if (position === "end")
          field?.setSelectionRange(field.value.length, field.value.length);
        return;
      }
      // Tiptap: `null` keeps the selection where it was and restores focus.
      if (usable(editor)) editor.commands.focus(position === "restore" ? null : position);
    },
    blur: () => {
      if (host.sourceOpen()) host.sourceField()?.blur();
      else if (usable(editor)) editor.commands.blur();
    },
    insertHTML: (html) => {
      const content = usable(editor) && html.trim() ? parseHtml(editor, html) : null;
      return content !== null && authorEdit(host, (chain) => chain.insertContent(content));
    },
    insertText: (text) =>
      !!text &&
      authorEdit(host, (chain) =>
        chain.insertContent(
          textContent(
            text,
            !!usable(editor) && !!editor.state.selection.$from.parent.type.spec.code
          )
        )
      ),
    getText: () => {
      if (!usable(editor)) return "";
      host.applySource();
      return editor.getText();
    },
    getSelectedText: () => {
      if (!usable(editor) || host.sourceOpen()) return "";
      const { from, to, empty } = editor.state.selection;
      return empty ? "" : textBetween(editor.state.doc, from, to, "\n\n");
    },
    isEmpty: () => {
      if (usable(editor)) return host.fieldEmpty(editor);
      const initial = host.initialDocument();
      return initial
        ? isBlankDocument(initial, host.tables)
        : isBlankHtml(host.known(), host.tables);
    },
    undo: () => history("undo"),
    redo: () => history("redo"),
    canUndo: () => available("undo"),
    canRedo: () => available("redo"),
    // The Command types are derived from the map, while the implementation knows only the name.
    tool: host.commands as RichTextEditorHandleMethods["tool"],
  };
}
