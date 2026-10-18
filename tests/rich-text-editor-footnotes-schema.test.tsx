// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import { isAllowedLinkHref } from "../src/editor/core/schema.js";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
  type RichTextPurifier,
} from "../src/editor/schema-entry.js";

/**
 * Footnotes in the Schema (ADR-0076, OLDSUI-306): the only `id` and `href="#…"` in the Document,
 * allowed in one shape and one place. The tests run the real DOMPurify on jsdom, the way the
 * consumer's server does, and check the rule in both directions: what the Editor writes passes
 * unchanged, and the same attributes anywhere else are removed.
 */
const purify: RichTextPurifier = createDOMPurify(window);

const KEY = "k3x9q2mf";
const OTHER = "a1b2c3d4";

/** The reference as the Editor writes it. */
const reference = (key = KEY, number = 1) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;

/** The list as the Editor writes it. */
const list = (key = KEY, text = "Note", name = "Footnotes") =>
  `<section data-block="footnotes" role="doc-endnotes" aria-label="${name}"><ol>` +
  `<li id="fn-${key}"><p>${text}</p><a href="#fnref-${key}" role="doc-backlink">↩</a></li></ol></section>`;

const clean = (html: string) => sanitizeRichText(html, purify);

test("the Editor's footnote markup passes the cleanup byte for byte", () => {
  const html = `<p>Text${reference()}</p>${list()}`;

  expect(clean(html)).toBe(html);
});

test("the reference is rebuilt to its canonical shape, with digits only for the number", () => {
  const dirty = `<p>Text<sup data-footnote-ref="${KEY}"><b onclick="x()">1</b><script>x()</script></sup></p>`;

  expect(clean(dirty)).toBe(
    `<p>Text<sup data-footnote-ref="${KEY}"><a href="#fn-${KEY}" id="fnref-${KEY}" role="doc-noteref"></a></sup></p>`
  );
  expect(clean(`<p>${reference(KEY, 12)}</p>`)).toBe(`<p>${reference(KEY, 12)}</p>`);
});

test("the cleanup keeps the list section only at the top level and with its marker", () => {
  const nested = `<blockquote><p>Q</p>${list()}</blockquote>`;
  const unmarked = `<section><p>Plain</p></section>`;

  expect(clean(nested)).not.toContain("<section");
  expect(clean(nested)).not.toContain("id=");
  expect(clean(nested)).toContain("Note");
  expect(clean(unmarked)).toBe("<p>Plain</p>");
  expect(clean(`<section data-block="other"><p>Plain</p></section>`)).toBe("<p>Plain</p>");
});

test("id passes only as fn-<key> on a list item and fnref-<key> on a reference's anchor", () => {
  const strayId = '<p id="fn-k3x9q2mf">x</p><div id="fnref-k3x9q2mf">y</div><h2 id="top">z</h2>';
  const html = clean(strayId);

  expect(html).not.toContain("id=");
  // A list item outside the list, a reference anchor with a foreign id, a bad key shape.
  expect(clean(`<ul><li id="fn-${KEY}"><p>x</p></li></ul>`)).not.toContain("id=");
  expect(
    clean(`<p><sup data-footnote-ref="${KEY}"><a id="fnref-${OTHER}">1</a></sup></p>`)
  ).toContain(`id="fnref-${KEY}"`);
  expect(clean(`<p><a href="https://example.com" id="fnref-${KEY}">x</a></p>`)).not.toContain(
    "id="
  );
  expect(clean(list("K3X9Q2MF"))).not.toContain("id=");
  expect(clean(list("short"))).not.toContain("id=");
  expect(clean(list("k3x9q2mf-extra"))).not.toContain("id=");
});

test("href=# passes only on the reference's anchor and the backlink, to the matching target", () => {
  // A link to anything else with `#` loses its address, and stays as text.
  expect(clean('<p><a href="#top">x</a></p>')).toBe("<p>x</p>");
  expect(clean(`<p><a href="#fn-${KEY}">x</a></p>`)).toBe("<p>x</p>");
  expect(clean(`<p><a href="#fnref-${KEY}" role="doc-backlink">x</a></p>`)).toBe("<p>x</p>");
  // The reference points to its own footnote and nowhere else.
  const wrongTarget = `<p><sup data-footnote-ref="${KEY}"><a href="#fn-${OTHER}">1</a></sup></p>`;
  expect(clean(wrongTarget)).toBe(`<p>${reference()}</p>`);
  // The backlink points to its own reference.
  const wrongBacklink = list().replace(`#fnref-${KEY}`, `#fnref-${OTHER}`);
  expect(clean(wrongBacklink)).not.toContain("<a");
  // The anchors do not get the `rel` of a link.
  expect(clean(`<p>${reference()}</p>${list()}`)).not.toContain("rel=");
});

test("role passes as doc-noteref, doc-endnotes and doc-backlink only, each in its place", () => {
  expect(clean('<p role="doc-endnotes">x</p>')).toBe("<p>x</p>");
  expect(clean('<p><a href="https://example.com" role="doc-noteref">x</a></p>')).not.toContain(
    "role="
  );
  expect(clean('<p><a href="https://example.com" role="button">x</a></p>')).not.toContain("role=");
  expect(clean(`<section data-block="footnotes" role="alert"><ol></ol></section>`)).not.toContain(
    "role="
  );
});

test("aria-label passes only as the list's name", () => {
  expect(clean('<p aria-label="x">y</p>')).toBe("<p>y</p>");
  expect(clean('<div data-block="wrapper" aria-label="x"><p>y</p></div>')).not.toContain(
    "aria-label"
  );
  expect(clean(list(KEY, "Note", "Notes"))).toContain('aria-label="Notes"');
  expect(clean(list(KEY, "Note", ""))).not.toContain("aria-label");
});

test("the link Tool's rule is unchanged: # is still not a link address", () => {
  expect(isAllowedLinkHref("#top")).toBe(false);
  expect(isAllowedLinkHref(`#fn-${KEY}`)).toBe(false);
  expect(isAllowedLinkHref("https://example.com")).toBe(true);
});

test("the bare config stays closed to the footnote attributes and anchors", () => {
  const config = richTextSanitizeConfig();

  for (const name of ["id", "role", "aria-label", "data-footnote-ref"]) {
    expect(config.ALLOWED_ATTR, name).not.toContain(name);
  }
  expect(config.ALLOWED_URI_REGEXP.test(`#fn-${KEY}`)).toBe(false);
});

test("the Schema data names the footnote markup", () => {
  expect(RICH_TEXT_SCHEMA.blocks).toContain("section");
  expect(RICH_TEXT_SCHEMA.attributes.sup).toEqual(["data-footnote-ref"]);
  expect(RICH_TEXT_SCHEMA.attributes.section).toEqual(["data-block", "role", "aria-label"]);
  expect(RICH_TEXT_SCHEMA.attributes.a).toEqual(["href", "rel", "id", "role"]);
  expect(RICH_TEXT_SCHEMA.attributes.li).toContain("id");
});
