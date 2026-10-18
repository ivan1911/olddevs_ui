"use client";

import { PasteRule } from "@tiptap/core";
import { Link as TiptapLink, type LinkOptions } from "@tiptap/extension-link";
import { isAllowedLinkHref } from "../../core/schema.js";

/**
 * `rel` of every Document link: the page that shows the View gives the target neither
 * `opener` nor `Referer`.
 */
export const LINK_REL = "noopener noreferrer";

/** Whether the address has a scheme (`https:`, `mailto:`, `javascript:`…). */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A Document link: Tiptap's `Link`, narrowed to the kit's Schema.
 *
 * WHY `extend`, NOT `StarterKit.configure({ link })`. Options cannot strip what is not
 * needed from PARSING. Tiptap reads the `target`, `class`, `title` attributes and a foreign
 * `rel` from the incoming `<a>` itself and returns them. `isAllowedUri` by default lets
 * through relative addresses and a dozen schemes (`ftp`, `tel`, `sms`…). Here the Mark has
 * one attribute, `href`, and `rel` is written on output.
 *
 * THE ADDRESS IS CHECKED ON EVERY INPUT, and the inputs differ:
 *
 * - `<a href>` from `value` and pasted HTML: `parseHTML`, strictly by the Schema;
 * - Markdown (`[text](address)`) arrives as JSON, bypassing `parseHTML`: `parseMarkdown`
 *   drops the link with a foreign address and keeps the text;
 * - an autolink while typing and an address from the clipboard go through linkify, which
 *   often has no scheme (`example.com`). `defaultProtocol` adds one, so `isAllowedUri`
 *   rejects only an EXPLICIT foreign scheme;
 * - pasting an address over a selection (`linkOnPaste`) does not call `isAllowedUri` at all:
 *   `shouldAutoLink` covers it;
 * - on output, `renderHTML` checks the address once more. Only a raw `ref.editor` could set a
 *   Mark with a foreign address, and in HTML it leaves without `href`.
 *
 * `Mod+K` and the address popover are not here. They belong to the Tool's button descriptor
 * (`linkTool.tsx`), and the kit binds the button's key (`toolButtons.ts`).
 */
export const RichLink = TiptapLink.extend<LinkOptions>({
  addOptions() {
    const parent = this.parent!();
    return {
      ...parent,
      // The Editor does not open a link on click: a click places the caret, as in any text.
      // The address is seen and edited in the popover.
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      HTMLAttributes: { rel: LINK_REL },
      isAllowedUri: (url) => {
        const trimmed = url.trim();
        return !SCHEME.test(trimmed) || isAllowedLinkHref(trimmed);
      },
      shouldAutoLink: (url) => {
        const trimmed = url.trim();
        if (SCHEME.test(trimmed) && !isAllowedLinkHref(trimmed)) return false;
        return parent.shouldAutoLink(url);
      },
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href")?.trim() ?? null,
        // `rel` is a constant of the output, not an attribute of the Mark: see `renderHTML`.
        renderHTML: (attributes) => ({ href: attributes.href }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (dom) => (isAllowedLinkHref(dom.getAttribute("href") ?? "") ? null : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    return ["a", isAllowedLinkHref(href) ? { href, rel: LINK_REL } : { rel: LINK_REL }, 0];
  },

  /*
    Tiptap's paste rule links every address-like stretch of pasted text, and two things go wrong
    (OLDSUI-304):

    - TEXT THAT IS ALREADY A LINK. A copy from Word or a web page often shows a short form of the
      address: `<a href="https://example.com/docs?page=1#top">example.com/docs</a>`. The rule found
      `example.com/docs` in the text and set a new Mark over the existing one, so the link lost its
      query and anchor, or its whole address when the text named another page. A stretch that
      already carries a link is the source's link: the rule leaves it alone.
    - THE SCHEME. The rule takes the address from linkify, which writes `http://` for an address
      without a scheme, while the kit's `defaultProtocol` (and the autolink while typing) gives
      `https://`. A bare `example.org` in a paste gets the same `https://` as one typed by hand.
  */
  addPasteRules() {
    const { defaultProtocol } = this.options;
    return (this.parent?.() ?? []).map(
      (rule) =>
        new PasteRule({
          find: rule.find,
          handler: (props) => {
            const { state, range, match } = props;
            // Nothing to do, but not `null`: Tiptap drops the whole paste transaction when any
            // handler returns `null`, and the other addresses of the same paste would stay plain text.
            if (state.doc.rangeHasMark(range.from, range.to, this.type)) return undefined;
            const text = match[0];
            if (match.data?.href === `http://${text}` && !SCHEME.test(text)) {
              match.data = { ...match.data, href: `${defaultProtocol}://${text}` };
            }
            return rule.handler(props);
          },
        })
    );
  },

  parseMarkdown: (token, helpers) => {
    const content = helpers.parseInline(token.tokens ?? []);
    const href = typeof token.href === "string" ? token.href.trim() : "";
    return isAllowedLinkHref(href) ? helpers.applyMark("link", content, { href }) : content;
  },
});

/** Looks like an email address without a scheme: `team@example.com`. */
const BARE_EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

/**
 * Turns the address from the popover field into the link's address, or returns `null` if such
 * a link cannot be in the Document.
 *
 * A person types an address as they see it in the browser bar: `example.com`, not
 * `https://example.com`. An address without a scheme therefore gets `https://`, and an
 * email-like one gets `mailto:`. This is unambiguous because the Schema accepts no relative
 * addresses (`RICH_TEXT_SCHEMA.protocols`): an address that starts with `/`, `#`, `?` or `.`
 * is an error, not a path from the current page.
 */
export function normalizeLinkInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (SCHEME.test(value)) return isAllowedLinkHref(value) ? value : null;
  if (/^[/#?.]/.test(value)) return null;
  return BARE_EMAIL.test(value) ? `mailto:${value}` : `https://${value}`;
}
