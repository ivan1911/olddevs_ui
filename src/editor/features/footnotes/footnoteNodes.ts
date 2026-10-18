"use client";

import {
  definitionTokenizer,
  parseDefinition,
  parseReference,
  referenceTokenizer,
  renderDefinition,
  renderReference,
} from "./footnoteMarkdown.js";
import { FOOTNOTE_REF_ATTRIBUTE, footnoteId, isFootnoteKey, referenceId } from "./footnoteNames.js";
import {
  FootnoteListShape,
  FootnoteReferenceShape,
  FootnoteShape,
  type FootnoteLabels,
} from "./footnoteShape.js";

/*
  The footnote nodes of the live Document (lazy chunk, `footnotesChunk.ts`): the Schema half is
  `footnoteShape.ts` (the content model, the HTML parse and the markup; it is also what the Skeleton
  draws), and here are added what only the engine needs: the Markdown rules and the footnote's node
  view. Markdown stays out of the shape because its tokenizers weigh something and nothing but a
  live Document reads or writes Markdown.

  THE IDS IN THE EDITOR'S DOM carry the instance's prefix (`idPrefix`, OLDSUI-314), the saved HTML does
  not: the node views draw the anchors, `renderHTML` writes them. A View of the same Document on the
  page keeps the plain `fn-<key>`, so its links land on itself and a link from outside still works. The
  Editor's own jumps do not need the ids at all (`footnoteBehavior.ts` follows the click by the node).
*/

/** The reference: a superscript number that links to its footnote. */
export const FootnoteReference = FootnoteReferenceShape.extend<{ idPrefix: string }>({
  addOptions: () => ({ idPrefix: "" }),
  markdownTokenizer: referenceTokenizer,
  parseMarkdown: (token) => parseReference(token),
  renderMarkdown: (node) => renderReference(node),
  // The markup of `renderHTML`, with the ids of this instance. A key that is not valid has no anchor there either.
  addNodeView() {
    const { idPrefix } = this.options;
    return ({ node }) => {
      const dom = document.createElement("sup");
      const show = (current: typeof node) => {
        const key = String(current.attrs.key);
        const number = String(current.attrs.number);
        if (!isFootnoteKey(key)) {
          dom.removeAttribute(FOOTNOTE_REF_ATTRIBUTE);
          dom.replaceChildren(number);
          return;
        }
        const link = document.createElement("a");
        link.setAttribute("href", `#${idPrefix}${footnoteId(key)}`);
        link.id = idPrefix + referenceId(key);
        link.setAttribute("role", "doc-noteref");
        link.textContent = number;
        dom.setAttribute(FOOTNOTE_REF_ATTRIBUTE, key);
        dom.replaceChildren(link);
      };
      show(node);
      return {
        dom,
        update(updated) {
          if (updated.type !== node.type) return false;
          show(updated);
          return true;
        },
      };
    };
  },
});

/**
 * One footnote. Its look in the Editor is a node view: the number is a button that returns the caret
 * to the reference (`goToReference`), the text is the content. In the saved HTML the footnote is a
 * list item with its paragraph and the "↩" link.
 */
export const Footnote = FootnoteShape.extend<{ labels: FootnoteLabels; idPrefix: string }>({
  addOptions() {
    return { ...this.parent!(), idPrefix: "" };
  },
  renderMarkdown: (node, helpers) => renderDefinition(node, helpers),
  addNodeView() {
    const { labels, idPrefix } = this.options;
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
        if (isFootnoteKey(key)) dom.id = idPrefix + footnoteId(key);
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

/** The list: the Document's last Block, kept by the kit (`footnoteSync.ts`). */
export const FootnoteList = FootnoteListShape.extend({
  markdownTokenName: "footnoteDefinition",
  markdownTokenizer: definitionTokenizer,
  parseMarkdown: (token, helpers) => parseDefinition(token, helpers),
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n") : "",
});
