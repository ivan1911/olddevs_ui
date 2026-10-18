/*
  FOOTNOTES IN THE DOCUMENT'S HTML (ADR-0076). The server-side half of the Tool: the narrow
  rule for `id` and `href="#…"` that `sanitizeRichText` applies (`schema.ts`).

  The Schema has no anchors anywhere else: headings have no `id`, and the `link` Tool refuses `#`
  (`isAllowedLinkHref`). The footnote's own markup is the single exception, and it is allowed
  only in the exact shape the Editor writes, in the exact place:

  ```html
  <sup data-footnote-ref="k3x9q2mf"><a href="#fn-k3x9q2mf" id="fnref-k3x9q2mf" role="doc-noteref">1</a></sup>
  <section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes">
    <ol>
      <li id="fn-k3x9q2mf"><p>Text <a href="#fnref-k3x9q2mf" role="doc-backlink">↩</a></p></li>
    </ol>
  </section>
  ```

  The module is server-safe, like `mathHtml.ts`: it reads DOM nodes handed over by the cleanup and
  imports nothing but the names.
*/
import {
  BACKLINK_TEXT,
  FOOTNOTE_LIST_BLOCK,
  FOOTNOTE_REF_ATTRIBUTE,
  footnoteId,
  isFootnoteKey,
  keyOfAnchor,
  referenceId,
} from "./footnoteNames.js";

/**
 * The only `#` addresses the cleanup admits: `#fn-<key>` and `#fnref-<key>`. DOMPurify checks `href`
 * against this expression before the value reaches the hook, so the hook below decides WHERE.
 */
export const FOOTNOTE_ANCHOR_PATTERN = /^#fn(?:ref)?-[a-z0-9]{8}$/;

/** The longest list name (`aria-label`) the cleanup keeps: a few words, in the author's language. */
const MAX_LIST_NAME = 200;

/** The key of the reference a node sits in: `sup[data-footnote-ref]` directly above it. */
function referenceKey(node: Element): string | null {
  const parent = node.parentElement;
  const key = parent?.nodeName === "SUP" ? parent.getAttribute(FOOTNOTE_REF_ATTRIBUTE) : null;
  return isFootnoteKey(key) ? key : null;
}

/** The key of the footnote a node stands in: the nearest `li` with a valid `id="fn-<key>"`. */
function footnoteKeyAbove(node: Element): string | null {
  return keyOfAnchor(node.closest("li")?.getAttribute("id") ?? null, "fn-");
}

/** The list section: `section[data-block="footnotes"]`. */
function isListSection(node: Element | null): boolean {
  return node?.nodeName === "SECTION" && node.getAttribute("data-block") === FOOTNOTE_LIST_BLOCK;
}

/** The backlink, judged by the attributes it has on the page (the cleanup walks them in its own order). */
function isBacklink(node: Element): boolean {
  const key = footnoteKeyAbove(node);
  return (
    node.nodeName === "A" &&
    key !== null &&
    node.getAttribute("role") === "doc-backlink" &&
    node.getAttribute("href") === `#${referenceId(key)}`
  );
}

/**
 * An attribute of the footnote markup: `true` and `false` decide it, `undefined` leaves it to the
 * kit's general rules (`ATTRIBUTE_RULES`). Every name here is allowed only on its own tag, with its
 * own value, in its own place.
 */
export function footnoteAttributeAllowed(
  node: Element,
  name: string,
  value: string
): boolean | undefined {
  switch (name) {
    case FOOTNOTE_REF_ATTRIBUTE:
      return node.nodeName === "SUP" && isFootnoteKey(value);
    case "id": {
      if (node.nodeName === "A") {
        const key = keyOfAnchor(value, "fnref-");
        return key !== null && key === referenceKey(node);
      }
      // The list item sits directly in the list's `ol`, which sits directly in the section.
      return (
        node.nodeName === "LI" &&
        keyOfAnchor(value, "fn-") !== null &&
        node.parentElement?.nodeName === "OL" &&
        isListSection(node.parentElement.parentElement)
      );
    }
    case "role":
      if (node.nodeName === "SECTION") return value === "doc-endnotes" && isListSection(node);
      if (node.nodeName !== "A") return false;
      return (
        (value === "doc-noteref" && referenceKey(node) !== null) ||
        (value === "doc-backlink" && isBacklink(node))
      );
    case "aria-label":
      return isListSection(node) && value.trim() !== "" && value.length <= MAX_LIST_NAME;
    case "data-block":
      // On a `div` it is the kit's general rule (columns, Wrapper, video); `section` is ours.
      return node.nodeName === "SECTION" ? value === FOOTNOTE_LIST_BLOCK : undefined;
    case "href": {
      if (!value.startsWith("#")) return undefined;
      if (node.nodeName !== "A") return false;
      const key = referenceKey(node);
      if (key !== null) return value === `#${footnoteId(key)}`;
      // The backlink is told by its target, the role and the footnote around it.
      const footnote = footnoteKeyAbove(node);
      return (
        footnote !== null &&
        node.getAttribute("role") === "doc-backlink" &&
        value === `#${referenceId(footnote)}`
      );
    }
    default:
      return undefined;
  }
}

/**
 * The place of the footnote markup in the Document: `true` means the element was handled.
 *
 * - `section` is a list only with `data-block="footnotes"` and only at the top level; anything
 *   else loses its wrapper and the content stays.
 * - A reference is rebuilt to the canonical shape: whatever stood inside `sup[data-footnote-ref]`,
 *   the anchor with the number is all that remains. The number is digits only.
 * - An anchor to a footnote is kept as written, without the `rel` of a link: it leads inside the
 *   Document, and `noopener` has nothing to guard there.
 */
export function checkFootnote(node: Element): boolean {
  if (node.nodeName === "SECTION") {
    // The top level is directly in DOMPurify's parse `body`; checked by name, as for custom Blocks.
    if (!isListSection(node) || node.parentElement?.nodeName !== "BODY") {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  if (node.nodeName === "SUP" && node.hasAttribute(FOOTNOTE_REF_ATTRIBUTE)) {
    const key = node.getAttribute(FOOTNOTE_REF_ATTRIBUTE)!;
    const text = (node.textContent ?? "").trim();
    const anchor = node.ownerDocument.createElement("a");
    anchor.setAttribute("href", `#${footnoteId(key)}`);
    anchor.setAttribute("id", referenceId(key));
    anchor.setAttribute("role", "doc-noteref");
    anchor.textContent = /^\d{1,6}$/.test(text) ? text : "";
    node.replaceChildren(anchor);
    return true;
  }
  if (node.nodeName === "A" && node.getAttribute("href")?.startsWith("#")) {
    if (node.getAttribute("role") === "doc-backlink" && !node.textContent?.trim()) {
      node.textContent = BACKLINK_TEXT;
    }
    return true;
  }
  return false;
}
