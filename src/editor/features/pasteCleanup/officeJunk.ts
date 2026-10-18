"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/*
  What Office puts on the clipboard around the text and the Schema would carry in as noise or as
  stray characters. Every part runs only for the source that writes it (`applies` is the union):

  - Word bookmarks: `<a name="_Toc12">` around a heading, `<a name="s_links"></a>` before it. The
    anchors have no `href`, so they are not links. A link to a bookmark (`href="#_Toc12"`, the
    entries of a table of contents) points into the Word document and goes nowhere in the Editor.
    Safari rewrites such a link to `applewebdata://<guid>#_Toc12`.
  - `<o:p>`: the Office paragraph mark, `<o:p></o:p>` at the end of every paragraph, and `<o:p>&nbsp;</o:p>`
    as the whole content of an empty one.
  - Conditional comments: `<!--[if supportFields]>…<![endif]-->` holds the field codes of a table of
    contents ("PAGEREF _Toc8 \h"), `<!--[if gte mso 9]><xml>…</xml><![endif]-->` holds XML.
  - A `<br>` between two blocks: Google Docs writes `</p><br><h1>`, and so does a selection copied
    in WebKit (`Apple-interchange-newline`). Nothing in it is a line the author typed.

  Word's empty paragraphs are the author's blank lines and stay: only the `&nbsp;` inside them goes.
*/

/** A condition that shows its content to Office only: `[if gte mso 9]`, `[if supportFields]`, `[if gte vml 1]`. */
function isOfficeOnly(condition: string): boolean {
  return !condition.includes("!") && /\b(?:mso|vml|support[a-z]+)\b/i.test(condition);
}

const OPENER = /^\s*\[if\s+([^\]]*)\]\s*$/i;
const CLOSER = /^\s*\[endif\]\s*$/i;
/** `<!--[if gte mso 9]>…<![endif]-->`: the whole block is the text of one comment. */
const HIDDEN_BLOCK = /^\s*\[if\s+([^\]]*)\]>[\s\S]*<!\[endif\]\s*$/i;

/**
 * Remove the Office-only conditional blocks. Both forms: the hidden one (a single comment) and the
 * revealed one (`<![if gte mso 9]>…<![endif]>`, a comment before and a comment after real nodes).
 * A block for everyone else (`[if !supportLists]`, `[if !vml]`) keeps its content, and its markers
 * stay: they are comments the Schema ignores, and the content is what the browser shows.
 */
function removeConditionalBlocks(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) comments.push(node as Comment);
  for (const comment of comments) {
    if (!comment.parentNode) continue; // already removed with an enclosing block
    const hidden = comment.data.match(HIDDEN_BLOCK);
    if (hidden) {
      if (isOfficeOnly(hidden[1]!)) comment.remove();
      continue;
    }
    const opener = comment.data.match(OPENER);
    if (!opener || !isOfficeOnly(opener[1]!)) continue;
    // The closing marker is the matching `[endif]` among the next siblings; a nested block counts.
    const block: Node[] = [comment];
    let depth = 1;
    for (let next = comment.nextSibling; next && depth > 0; next = next.nextSibling) {
      block.push(next);
      if (next.nodeType !== Node.COMMENT_NODE) continue;
      const data = (next as Comment).data;
      if (OPENER.test(data)) depth += 1;
      else if (CLOSER.test(data)) depth -= 1;
    }
    // No closing marker: the block is not what it looks like, and nothing is cut.
    if (depth === 0) for (const node of block) node.parentNode?.removeChild(node);
  }
}

function unwrap(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}

/**
 * A link inside the same document: `#_Toc12`, or Safari's `applewebdata://<guid>#_Toc12`. In Word,
 * "Place in This Document" writes exactly this. Whatever the bookmark is called, it is not in the
 * Editor: the Schema takes no relative addresses, so the link would be lost there anyway.
 */
const DOCUMENT_LINK = /^\s*(?:applewebdata:\/\/[^#]*)?#/i;

function removeBookmarks(root: HTMLElement): void {
  for (const anchor of Array.from(root.querySelectorAll("a"))) {
    const href = anchor.getAttribute("href");
    if (href === null ? anchor.hasAttribute("name") : DOCUMENT_LINK.test(href)) unwrap(anchor);
  }
}

/** Content that keeps an `<o:p>` from being empty even without text. */
const EMBEDDED = "img, table, hr, svg, video, iframe, object, embed";

// `\S` is anything but whitespace, and JavaScript counts the non-breaking space as whitespace.
function removeParagraphMarks(root: HTMLElement): void {
  for (const mark of Array.from(root.getElementsByTagName("o:p"))) {
    const blank = !/\S/.test(mark.textContent ?? "") && !mark.querySelector(EMBEDDED);
    if (blank) mark.remove();
    else unwrap(mark);
  }
}

const BLOCKS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "CENTER",
  "DD",
  "DETAILS",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TFOOT",
  "THEAD",
  "TR",
  "UL",
]);

function isBlock(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  // Google Docs wraps the whole copy in `<b id="docs-internal-guid-…">`, and blocks sit inside it.
  return BLOCKS.has(element.tagName) || /^docs-internal-guid-/.test(element.id);
}

/** The nearest sibling that is not a comment or blank text, or `null`. */
function neighbour(node: Node, direction: "previousSibling" | "nextSibling"): Node | null {
  for (let next = node[direction]; next; next = next[direction]) {
    if (next.nodeType === Node.COMMENT_NODE) continue;
    if (next.nodeType === Node.TEXT_NODE && !/[^ \t\r\n\f]/.test(next.textContent ?? "")) continue;
    return next;
  }
  return null;
}

/**
 * Remove a `<br>` that stands between blocks (or after the last one, or before the first), where
 * Quill 2 removes it too: it is a gap in the markup, not a line break of the text, and the Schema
 * would turn it into an empty paragraph. A `<br>` inside a paragraph, and the only `<br>` of an
 * empty `<p><br></p>`, have no block beside them and stay.
 */
function removeStrayBreaks(root: HTMLElement): void {
  for (const br of Array.from(root.getElementsByTagName("br"))) {
    if (br.classList.contains("Apple-interchange-newline")) {
      br.remove();
      continue;
    }
    const before = neighbour(br, "previousSibling");
    const after = neighbour(br, "nextSibling");
    if ((before || after) && (!before || isBlock(before)) && (!after || isBlock(after))) {
      br.remove();
    }
  }
}

export const officeJunk: PasteCleanupStep = {
  name: "officeJunk",
  applies: (sources) => sources.word || sources.excel || sources.googleDocs,
  run(document, { sources }) {
    const root = document.body;
    if (sources.word || sources.excel) removeConditionalBlocks(root);
    if (sources.word || sources.excel) removeBookmarks(root);
    if (sources.word || sources.excel) removeParagraphMarks(root);
    if (sources.word || sources.googleDocs) removeStrayBreaks(root);
  },
};
