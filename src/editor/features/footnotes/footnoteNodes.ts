"use client";

import { Node } from "@tiptap/core";
import {
  definitionTokenizer,
  parseDefinition,
  parseReference,
  referenceTokenizer,
  renderDefinition,
  renderReference,
} from "./footnoteMarkdown.js";
import {
  BACKLINK_TEXT,
  FOOTNOTE_LIST_BLOCK,
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_NODE,
  FOOTNOTE_REF_ATTRIBUTE,
  FOOTNOTE_REF_NODE,
  footnoteId,
  isFootnoteKey,
  referenceId,
  referenceText,
} from "./footnoteNames.js";

/**
 * Footnotes in the Schema (ADR-0076): three nodes.
 *
 * - `footnoteRef`, the REFERENCE: an inline atom with its key and its number. The text of the
 *   Document shows the number; `getText()` and the counter see `[1]` (`renderText`).
 * - `footnote`, one FOOTNOTE: a single paragraph of inline content (Marks, links, hard breaks), no
 *   Blocks. It holds the same key as its reference.
 * - `footnoteList`, the LIST: the Document's last Block, holding the footnotes. It is not in the
 *   `block` group, so only the Document names it (`documentContent`, the same way as a Column
 *   layout) and nothing can nest it.
 *
 * THE HTML IS THE WHOLE STORY, with no JS needed to follow a footnote (ADR-0076, item 4):
 *
 * ```html
 * <sup data-footnote-ref="k3x9q2mf"><a href="#fn-k3x9q2mf" id="fnref-k3x9q2mf" role="doc-noteref">1</a></sup>
 * <section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes">
 *   <ol><li id="fn-k3x9q2mf"><p>Text</p><a href="#fnref-k3x9q2mf" role="doc-backlink">↩</a></li></ol>
 * </section>
 * ```
 *
 * The number in the HTML is a snapshot: the source of truth is the order of the references in the
 * text, and the kit renumbers after every edit (`footnoteSync.ts`).
 *
 * THE PARSE IS FORGIVING. The list reads the footnotes of an `ol` or directly in the section; a
 * footnote reads its text from a `p` or from the `li` itself; several paragraphs become one
 * paragraph joined by hard breaks; and the backlink, in any place it stands, is dropped (the kit
 * draws its own). What cannot be placed (a list in a quote) falls back to the surrounding
 * parse, and the text stays.
 */

/** What the engine needs from `RichTextEditor` for the strings that live in the HTML and in the node view. */
export interface FootnoteLabels {
  /** The list's name for `aria-label`: in the language of the message catalog, written into the HTML. */
  listName: () => string;
  /** The name of the number button in the list ("Back to text, footnote 2"). */
  back: (number: number) => string;
}

/** The first child element with this tag name. */
function childElement(parent: Element, tag: string): Element | null {
  return Array.from(parent.children).find((child) => child.localName === tag) ?? null;
}

/**
 * The element a footnote reads its text from. A footnote is one paragraph: a single `p` is read as
 * it stands; several are joined with hard breaks; no `p` means the `li` itself. A fresh element is
 * handed over (the source is never changed), without the backlink.
 */
export function footnoteTextElement(item: Element): Element {
  const text = item.cloneNode(true) as Element;
  for (const backlink of Array.from(
    text.querySelectorAll('a[role="doc-backlink"], a[href^="#fnref-"]')
  )) {
    backlink.remove();
  }
  const paragraphs = Array.from(text.children).filter((child) => child.localName === "p");
  if (paragraphs.length === 0) return text;
  const joined = text.ownerDocument.createElement("div");
  for (const child of Array.from(text.childNodes)) {
    if (child.nodeType === 1 && (child as Element).localName === "p") {
      // Paragraphs after the first are joined to it with a hard break; an empty one adds none.
      if (joined.childNodes.length > 0 && child.childNodes.length > 0) {
        joined.append(text.ownerDocument.createElement("br"));
      }
      joined.append(...Array.from(child.childNodes));
    } else if (child.nodeType !== 3 || child.textContent?.trim()) {
      joined.append(child);
    }
  }
  return joined;
}

/** The reference: a superscript number that links to its footnote. */
export const FootnoteReference = Node.create({
  name: FOOTNOTE_REF_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    key: {
      default: "",
      rendered: false,
      parseHTML: (element) => {
        const key = element.getAttribute(FOOTNOTE_REF_ATTRIBUTE);
        return isFootnoteKey(key) ? key : "";
      },
    },
    number: {
      default: 0,
      rendered: false,
      parseHTML: (element) => Number.parseInt(element.textContent ?? "", 10) || 0,
    },
    /*
      The footnote's text on its way between two Editors (copy, cut, drag): the reference carries it,
      and the paste puts it into a new footnote (`footnoteClipboard.ts`). Always empty in the
      Document and absent from the saved HTML. A JSON string of the footnote's inline content.
    */
    note: {
      default: null,
      rendered: false,
      parseHTML: (element) => element.getAttribute("data-footnote-note"),
    },
  }),
  // Above the Superscript Mark, which reads every `sup`.
  parseHTML: () => [{ tag: `sup[${FOOTNOTE_REF_ATTRIBUTE}]`, priority: 100 }],
  renderHTML: ({ node }) => {
    const { key, number, note } = node.attrs as {
      key: string;
      number: number;
      note: string | null;
    };
    if (!isFootnoteKey(key)) return ["sup", {}, String(number)];
    return [
      "sup",
      { [FOOTNOTE_REF_ATTRIBUTE]: key, ...(note ? { "data-footnote-note": note } : {}) },
      [
        "a",
        { href: `#${footnoteId(key)}`, id: referenceId(key), role: "doc-noteref" },
        String(number),
      ],
    ];
  },
  // The Atom text: the number in square brackets (`getText()`, copying as text, `maxLength`).
  renderText: ({ node }) => referenceText(Number(node.attrs.number)),
  markdownTokenizer: referenceTokenizer,
  parseMarkdown: (token) => parseReference(token),
  renderMarkdown: (node) => renderReference(node),
});

/**
 * One footnote. Its look in the Editor is a node view: the number is a button that returns the caret
 * to the reference (`goToReference`), the text is the content. In the saved HTML the footnote is a
 * list item with its paragraph and the "↩" link.
 */
export const Footnote = Node.create<{ labels: FootnoteLabels }>({
  name: FOOTNOTE_NODE,
  content: "inline*",
  // The list is the only parent. Not `isolating`: Tiptap's hard break refuses to work in an isolating
  // Block, and `Shift+Enter` must work here. Footnotes do not merge because the keys say so
  // (`footnoteBehavior.ts`: Backspace at the start, Delete at the end).
  defining: true,
  selectable: false,
  addOptions: () => ({
    labels: { listName: () => "Footnotes", back: (number) => `Back to text, footnote ${number}` },
  }),
  addAttributes: () => ({
    key: {
      default: "",
      rendered: false,
      parseHTML: (element) => {
        const key = element.getAttribute("id")?.replace(/^fn-/, "") ?? null;
        return isFootnoteKey(key) ? key : "";
      },
    },
    number: { default: 0, rendered: false },
  }),
  parseHTML: () => [
    // The backlink is the kit's to draw, whatever stands where it was.
    { tag: 'a[role="doc-backlink"]', priority: 100, ignore: true },
    { tag: 'a[href^="#fnref-"]', priority: 100, ignore: true },
    {
      tag: "li",
      context: `${FOOTNOTE_LIST_NODE}/`,
      priority: 60,
      contentElement: (dom) => footnoteTextElement(dom as Element) as HTMLElement,
    },
  ],
  renderHTML: ({ node }) => {
    const key = String(node.attrs.key);
    return [
      "li",
      isFootnoteKey(key) ? { id: footnoteId(key) } : {},
      ["p", 0],
      ...(isFootnoteKey(key)
        ? [["a", { href: `#${referenceId(key)}`, role: "doc-backlink" }, BACKLINK_TEXT] as const]
        : []),
    ];
  },
  renderMarkdown: (node, helpers) => renderDefinition(node, helpers),
  addNodeView() {
    const { labels } = this.options;
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("li");
      const back = document.createElement("button");
      back.type = "button";
      back.setAttribute("contenteditable", "false");
      back.setAttribute("data-footnote-back", "");
      const text = document.createElement("p");
      dom.append(back, text);

      const show = (current: typeof node) => {
        const key = String(current.attrs.key);
        const number = Number(current.attrs.number);
        if (isFootnoteKey(key)) dom.id = footnoteId(key);
        else dom.removeAttribute("id");
        back.textContent = String(number);
        back.setAttribute("aria-label", labels.back(number));
      };
      show(node);

      // The button is outside the text; the mouse must not move the caret, and ProseMirror must not
      // take the key. Only the click is the button's.
      back.addEventListener("mousedown", (event) => event.preventDefault());
      back.addEventListener("click", (event) => {
        event.preventDefault();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (pos === undefined) return;
        const current = editor.state.doc.nodeAt(pos);
        if (current) editor.commands.goToFootnoteReference(Number(current.attrs.number));
      });

      return {
        dom,
        contentDOM: text,
        update(updated) {
          if (updated.type !== node.type) return false;
          show(updated);
          return true;
        },
        stopEvent: (event) => event.target instanceof Element && back.contains(event.target),
        ignoreMutation: (mutation) => back.contains(mutation.target),
      };
    };
  },
});

/**
 * The list: the Document's last Block. It has no handle (`handleBlock` skips it, `blockCommands.ts`),
 * and no Slash menu or "+" works inside its footnotes; the footnotes are edited in place, and the
 * list is kept by the kit (`footnoteSync.ts`).
 */
export const FootnoteList = Node.create<{ labels: FootnoteLabels }>({
  name: FOOTNOTE_LIST_NODE,
  content: `${FOOTNOTE_NODE}+`,
  isolating: true,
  selectable: false,
  draggable: false,
  addOptions: () => ({
    labels: { listName: () => "Footnotes", back: (number) => `Back to text, footnote ${number}` },
  }),
  parseHTML: () => [
    {
      tag: `section[data-block="${FOOTNOTE_LIST_BLOCK}"]`,
      // The footnotes are the `ol`'s children; the `ol` itself is not a list of the Document.
      contentElement: (dom) => (childElement(dom as Element, "ol") ?? dom) as HTMLElement,
    },
  ],
  renderHTML() {
    return [
      "section",
      {
        "data-block": FOOTNOTE_LIST_BLOCK,
        role: "doc-endnotes",
        "aria-label": this.options.labels.listName(),
      },
      ["ol", 0],
    ];
  },
  markdownTokenName: "footnoteDefinition",
  markdownTokenizer: definitionTokenizer,
  parseMarkdown: (token, helpers) => parseDefinition(token, helpers),
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n") : "",
});
