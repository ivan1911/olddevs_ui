// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
  type RichTextPurifier,
} from "../src/editor/schema-entry.js";

/**
 * The contract for a server with an allowlist of its own (OLDSUI-306, OLDSUI-312): the Schema lists
 * `id`, `role`, `aria-label` and `data-footnote-ref` as DATA, but the narrow rule for them exists only
 * in the hooks of `sanitizeRichText`. The docs tell such a server not to copy them as plain allowed
 * attributes, and to treat the other new attributes as plain data. These tests pin both halves
 * against the real DOMPurify on jsdom.
 */
const purify: RichTextPurifier = createDOMPurify(window);

const KEY = "k3x9q2mf";
const DOCUMENT =
  `<p>Text<sup data-footnote-ref="${KEY}"><a href="#fn-${KEY}" id="fnref-${KEY}" role="doc-noteref">1</a></sup></p>` +
  `<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>` +
  `<li id="fn-${KEY}"><p>The note <a href="#fnref-${KEY}" role="doc-backlink">↩</a></p></li></ol></section>`;

test("the Schema names the footnote attributes as data, so copying its names is not enough", () => {
  const names = Object.values(RICH_TEXT_SCHEMA.attributes).flat();

  for (const name of ["id", "role", "aria-label", "data-footnote-ref"]) {
    expect(names, name).toContain(name);
  }
});

test("the bare config keeps the text of the footnotes and none of the jump attributes", () => {
  const out = purify.sanitize(DOCUMENT, richTextSanitizeConfig());

  expect(out).toContain("The note");
  expect(out).toContain(">1</a>");
  for (const name of ["id=", "role=", "aria-label=", "data-footnote-ref=", "href="]) {
    expect(out, name).not.toContain(name);
  }
});

test("the new attributes that are safe as plain data are in the bare config; lang is not", () => {
  const { ALLOWED_ATTR } = richTextSanitizeConfig();

  for (const name of ["datetime", "data-width", "data-align"]) {
    expect(ALLOWED_ATTR, name).toContain(name);
  }
  expect(ALLOWED_ATTR).not.toContain("lang");
  const out = purify.sanitize(
    '<p><time datetime="2026-10-18">d</time></p><table><colgroup><col data-width="40"><col data-width="60"></colgroup>' +
      '<tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table><figure data-align="left"></figure>',
    richTextSanitizeConfig()
  );
  expect(out).toContain('datetime="2026-10-18"');
  expect(out).toContain('<col data-width="40">');
  expect(out).toContain('<figure data-align="left">');
});

test("sanitizeRichText admits no other id, role or aria-label, on any tag", () => {
  const forged =
    '<p id="cookie" role="button" aria-label="x">a</p>' +
    '<h2 id="top">b</h2><ul><li id="fn-' +
    KEY +
    '">c</li></ul>' +
    `<a href="https://example.com" id="fnref-${KEY}" role="doc-noteref">d</a>` +
    `<div data-block="wrapper" id="w" role="alert"><p>e</p></div>` +
    `<section id="s"><p>f</p></section>`;
  const out = sanitizeRichText(forged, purify);

  for (const name of ["id=", "role=", "aria-label="]) {
    expect(out, name).not.toContain(name);
  }
  for (const text of ["a", "b", "c", "d", "e", "f"]) expect(out).toContain(`>${text}<`);
});
