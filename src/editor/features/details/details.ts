"use client";

import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { type Editor, type Extensions } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { placeContainerBlock } from "../../core/containers.js";
import { detailsTokenizer, parseDetails, renderDetails } from "./detailsMarkdown.js";

/**
 * Collapsible Block (Details): a container Block of two children, a title (`detailsSummary`, inline
 * content) and the content (`detailsContent`, Blocks). The engine is the Details extension from
 * Tiptap (the API follows it, ADR-0048: there was no requesting screen at release time). The kit
 * adds the Schema, the sanitizer, Markdown and paste.
 *
 * HTML IS AS IN TIPTAP, WITH THE KIT'S TAGS, without classes and `style`:
 *
 * ```html
 * <details>
 *   <summary>Title</summary>
 *   <div data-type="detailsContent"><p>Blocks</p></div>
 * </details>
 * ```
 *
 * `open` is written only with the `persist` option (off by default): a Block expanded while editing
 * is not published expanded without asking. The content wrapper (`div[data-type="detailsContent"]`)
 * is needed by the engine to tell the content from the title. Foreign HTML without it (GitHub, or
 * the browser's `<details><summary>…</summary><p>…</p></details>`) is read the same way, because the
 * Schema supplies the wrapper itself.
 *
 * NESTING IS AS FOR ANY BLOCK. Details belongs to the `block` group: it can sit at the top level, in
 * a column of a Column layout, in a Wrapper, in a quote, in a cell, and in the content of another
 * Details. A Column layout and a Wrapper are not allowed inside it: only the Document and a column
 * accept them. `isolating`, as for a Wrapper: Backspace at the start of the Block does not pull the
 * text out.
 *
 * The look of the Block in the Editor is the node view from Tiptap: a `div` with an expand button
 * and the `is-open` class. With `persist: false` the open state lives only in this DOM, not in the
 * Document and not in the edit history.
 */

/** Node names in the engine's Schema. */
export const DETAILS_NODE = "details";
export const DETAILS_SUMMARY_NODE = "detailsSummary";
export const DETAILS_CONTENT_NODE = "detailsContent";

/** Name of the content wrapper in `data-type`: this is how Tiptap writes it. */
export const DETAILS_CONTENT_TYPE = DETAILS_CONTENT_NODE;

export interface DetailsEngineOptions {
  /** Whether the open state of the Block is written into the Document (the `persist` option). */
  persist: boolean;
  /** Name of the expand button by the title's text: from the message catalog, read on every render. */
  toggleLabel: (text: string) => string;
}

/** Transaction meta: the position of the just-inserted Block that has to be expanded. */
const OPEN_ON_INSERT = new PluginKey<number | null>("detailsOpenOnInsert");

/**
 * Expand a Block inserted from the Slash menu. With `persist: false` the open state is a class in the
 * DOM of the node view, not a node attribute, so a click on the button expands it, just as the
 * author's own click would. An empty Block that stays collapsed is a title with no place for content,
 * while the author came to type into the content, not into the title. This runs after the DOM update
 * and outside the transaction, because Tiptap's button returns focus to the Document.
 */
const openOnInsert = new Plugin<number | null>({
  key: OPEN_ON_INSERT,
  state: {
    init: () => null,
    apply: (tr) => (tr.getMeta(OPEN_ON_INSERT) as number | undefined) ?? null,
  },
  view: () => ({
    update(view) {
      const pos = OPEN_ON_INSERT.getState(view.state);
      if (pos === null || pos === undefined) return;
      queueMicrotask(() => {
        if (view.isDestroyed) return;
        const dom = view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement) || dom.getAttribute("data-type") !== DETAILS_NODE) return;
        if (dom.classList.contains("is-open")) return;
        dom.querySelector<HTMLButtonElement>(":scope > button")?.click();
      });
    },
  }),
});

/** Text of the Block's title, for the button's name. */
function summaryText(node: PmNode): string {
  return node.firstChild?.type.name === DETAILS_SUMMARY_NODE ? node.firstChild.textContent : "";
}

/** Whether the node at the position is visible: collapsed content is hidden and has no `offsetParent`. */
function isVisibleAt(editor: Editor, pos: number): boolean {
  const { node } = editor.view.domAtPos(pos);
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  return element !== null && element.offsetParent !== null;
}

/**
 * Enter in the title of an expanded Block whose content starts with an empty Block: the caret moves
 * into it. Anywhere else (not in the title, a collapsed Block, or a non-empty start) it returns
 * `false`, which is Tiptap's business.
 */
function moveIntoEmptyContent(editor: Editor): boolean {
  const { selection } = editor.state;
  const { $head } = selection;
  if (!selection.empty || $head.parent.type.name !== DETAILS_SUMMARY_NODE) return false;
  const content = $head.node(-1).lastChild;
  const first = content?.type.name === DETAILS_CONTENT_NODE ? content.firstChild : null;
  if (!first?.isTextblock || first.content.size > 0) return false;
  const start = $head.after() + 1;
  if (!isVisibleAt(editor, start)) return false;
  const { tr } = editor.state;
  editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(start), 1)).scrollIntoView());
  return true;
}

/**
 * Backspace in the title. Safari deletes the whole text of `summary` on it (a WebKit bug), so Tiptap
 * removes the character itself. But it removes one UTF-16 unit, and an emoji with a surrogate pair
 * lost half of itself. Here the last grapheme is removed: `Intl.Segmenter`, and without it, a code
 * point.
 */
function lastGraphemeLength(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const parts = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)
    );
    return parts.at(-1)?.segment.length ?? 1;
  }
  return Array.from(text).at(-1)?.length ?? 1;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    detailsBlock: {
      /**
       * Insert an empty collapsible Block below the current Block; an empty paragraph is replaced. The
       * caret goes into the title. The Block is expanded: with `persist`, through an attribute; without
       * it, right after insertion. From a title, a list or a cell it goes below their Block; from a
       * Wrapper, a column or a quote, it goes inside them.
       */
      insertDetails: () => ReturnType;
    };
  }
}

/**
 * The Details node of the kit: Tiptap plus insertion, Backspace without losing a character, expanding
 * an inserted Block, and Markdown with raw HTML.
 */
function createDetails({ persist, toggleLabel }: DetailsEngineOptions) {
  return Details.extend({
    // The kit's own Markdown (`detailsMarkdown.ts`): raw HTML instead of `:::details`.
    markdownTokenizer: detailsTokenizer,
    parseMarkdown(token, helpers) {
      return parseDetails(token, helpers, this.options.persist);
    },
    renderMarkdown(node, helpers) {
      return renderDetails(node, helpers, this.options.persist);
    },
    addCommands() {
      return {
        ...this.parent?.(),
        insertDetails:
          () =>
          ({ tr, dispatch }) => {
            if (dispatch) placeDetails(tr, this.options.persist);
            return true;
          },
      };
    },
    addKeyboardShortcuts() {
      const upstream = this.parent?.() ?? {};
      return {
        ...upstream,
        /*
          Enter in the title of an expanded Block: Tiptap puts a NEW empty paragraph at the start of
          the content. A just-inserted Block already has one empty paragraph as its content, and a new
          one would leave an empty line at the end, after what is typed. So the caret goes to the
          paragraph that is already there.
        */
        Enter: (props) => moveIntoEmptyContent(props.editor) || (upstream.Enter?.(props) ?? false),
        Backspace: () => {
          const { selection } = this.editor.state;
          const { empty, $anchor } = selection;
          if (!empty || $anchor.parent.type.name !== DETAILS_SUMMARY_NODE) return false;
          // The start of the title: the Block falls apart (`unsetDetails`).
          if ($anchor.parentOffset === 0) return this.editor.commands.unsetDetails();
          const before = $anchor.parent.textBetween(0, $anchor.parentOffset);
          const size = lastGraphemeLength(before);
          return this.editor.commands.command(({ tr }) => {
            tr.delete($anchor.pos - size, $anchor.pos);
            return true;
          });
        },
      };
    },
    addNodeView() {
      const parentView = this.parent?.();
      if (!parentView) return null;
      return (props) => {
        const view = parentView(props);
        const toggle = view.dom.querySelector<HTMLButtonElement>(":scope > button");
        /*
          The expand button lies inside the Document. Without this, ProseMirror would take its
          events: `Enter` on the button would cut a line, and a click would move the caret. Only the
          button itself handles them.
        */
        const stopEvent = (event: Event) =>
          event.target instanceof Node && !!toggle && toggle.contains(event.target);
        /*
          The button sits inside the editable Document and would be editable itself because of that.
          On every key, Chrome moves focus from such a button to the editable root before `keydown`,
          so Enter and Space never reached it and the Block did not expand from the keyboard. A
          non-editable button keeps focus and gets the key.
        */
        toggle?.setAttribute("contenteditable", "false");
        /*
          Tiptap's click returns focus to the Document. A mouse is not affected by this, but the
          keyboard would be thrown off the button. A keyboard click is recognized by Enter or Space
          on the button itself. `detail` is zero for a `click()` called from code too (expanding an
          inserted Block), and there the focus must stay in the Document. Tiptap sets focus one frame
          later (`requestAnimationFrame`), so we return it one frame later too: the callback sits in
          the queue after Tiptap's. `aria-expanded` is announced where the person is.
        */
        let byKey = false;
        toggle?.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") byKey = true;
        });
        toggle?.addEventListener("blur", () => {
          byKey = false;
        });
        toggle?.addEventListener("click", () => {
          if (!byKey) return;
          byKey = false;
          /*
            Until the frame, the person may move on (Tab to the next Block's button), and Tiptap's
            focus, a frame later, would drag them into the Document from there too. So we remember
            where the person's own focus moved, and return it there, not to this button: otherwise the
            next key would reach the wrong button.
          */
          const owner = toggle.ownerDocument;
          const root = view.dom.closest(".ProseMirror");
          let target: HTMLElement = toggle;
          const follow = (event: FocusEvent) => {
            if (event.target instanceof HTMLElement && event.target !== root) target = event.target;
          };
          owner.addEventListener("focusin", follow, true);
          requestAnimationFrame(() => {
            owner.removeEventListener("focusin", follow, true);
            const active = owner.activeElement;
            // Focus in the Document: Tiptap put it there. Anywhere else: the person moved it.
            if (target.isConnected && (active === root || active === target)) {
              target.focus({ preventScroll: true });
            }
          });
        });
        return { ...view, stopEvent };
      };
    },
    addProseMirrorPlugins() {
      return [...(this.parent?.() ?? []), ...(this.options.persist ? [] : [openOnInsert])];
    },
  }).configure({
    persist,
    renderToggleButton: ({ element, isOpen, node }) => {
      // The button's name is the Block's title; whether it is expanded is told by `aria-expanded`.
      element.setAttribute("aria-label", toggleLabel(summaryText(node)));
      element.setAttribute("aria-expanded", String(isOpen));
    },
  });
}

/**
 * The title: `details > summary`. Tiptap parses any `summary`, and a `summary` outside a Block is
 * text that must not turn into a Block as a whole.
 */
const KitSummary = DetailsSummary.extend({
  parseHTML: () => [{ tag: "details > summary" }],
  // The Block's Markdown is written and read by the Block itself (`detailsMarkdown.ts`). The kit
  // does not accept Tiptap's `:::detailsSummary`.
  markdownTokenizer: {
    name: DETAILS_SUMMARY_NODE,
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
});

const KitContent = DetailsContent.extend({
  /*
    The content is a container of Blocks (`isBlockContainer`, `blockCommands.ts`). Its children are
    Blocks with their own handle, and "Move up", "Move down", "Add below" and `⌥⇧↑/↓` stay inside it.
    The flag in the Schema is set by the kit from the Block trait of the description (`blocks`,
    `extensions.ts`).
  */
  markdownTokenizer: {
    name: DETAILS_CONTENT_NODE,
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
});

/** Everything a Block needs: the node, the title and the content. */
export function detailsExtensions(options: DetailsEngineOptions): Extensions {
  return [createDetails(options), KitSummary, KitContent];
}

/**
 * An empty Block with one paragraph in its content, placed below the current Block, in the nearest
 * node above that accepts it. The placement rules are shared with the Column layout and the Wrapper
 * (`placeContainerBlock`). The caret goes into the title.
 */
function placeDetails(tr: Transaction, persist: boolean): void {
  const { schema } = tr.doc.type;
  const details = schema.nodes[DETAILS_NODE]!.create(persist ? { open: true } : null, [
    schema.nodes[DETAILS_SUMMARY_NODE]!.create(),
    schema.nodes[DETAILS_CONTENT_NODE]!.create(null, schema.nodes.paragraph!.create()),
  ]);
  placeContainerBlock(tr, details);
  if (persist) return;
  // The Block's position: the caret is in its title, two levels up.
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === DETAILS_NODE) {
      tr.setMeta(OPEN_ON_INSERT, $from.before(depth));
      break;
    }
  }
}

/** The collapsible Block at position `pos`: the Block itself, or a Block directly in its content. */
function detailsAt(tr: Transaction, pos: number): { from: number; node: PmNode } | null {
  const node = tr.doc.nodeAt(pos);
  if (node?.type.name === DETAILS_NODE) return { from: pos, node };
  const $pos = tr.doc.resolve(pos);
  if ($pos.parent.type.name !== DETAILS_CONTENT_NODE) return null;
  const from = $pos.before($pos.depth - 1);
  const details = tr.doc.nodeAt(from);
  return details?.type.name === DETAILS_NODE ? { from, node: details } : null;
}

/**
 * Unset the Block at `pos` (the Block itself, or a Block in its content): the title becomes a
 * paragraph, and the content's Blocks follow it. One edit, so one undo. The caret stays in its own
 * text (in the title, that is in the paragraph made from it). A Block selected as a node disappears,
 * and the caret goes to the start of the paragraph. `false` means there is no Block at `pos`.
 */
export function unwrapDetailsAt(tr: Transaction, pos: number): boolean {
  const found = detailsAt(tr, pos);
  if (!found) return false;
  const { from, node } = found;
  const to = from + node.nodeSize;
  const { schema } = tr.doc.type;
  const summary = node.firstChild;
  const content = node.lastChild;
  const lead = schema.nodes.paragraph!.create(null, summary?.content ?? Fragment.empty);
  const blocks = content?.type.name === DETAILS_CONTENT_NODE ? content.content : Fragment.empty;
  const before = tr.selection;
  const wasNode = before instanceof NodeSelection && before.from === from;
  // Positions inside the Block after the replacement: the title is one step left (there is no
  // `details` tag), and the content's Blocks come after the paragraph instead of the `details`,
  // `summary` and the wrapper.
  const summaryEnd = from + 1 + (summary?.nodeSize ?? 0);
  const delta = from + lead.nodeSize - (summaryEnd + 1);
  const shift = (at: number) => (at < summaryEnd ? at - 1 : at + delta);
  const inside = before.from > from && before.to < to;
  tr.replaceWith(from, to, Fragment.from(lead).append(blocks));
  if (wasNode || !inside) {
    tr.setSelection(TextSelection.create(tr.doc, from + 1));
  } else if (before instanceof NodeSelection) {
    tr.setSelection(NodeSelection.create(tr.doc, shift(before.from)));
  } else {
    tr.setSelection(TextSelection.create(tr.doc, shift(before.anchor), shift(before.head)));
  }
  tr.scrollIntoView();
  return true;
}
