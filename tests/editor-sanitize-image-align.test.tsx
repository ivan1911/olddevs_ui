// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
} from "../src/editor/schema-entry.js";

/**
 * Image alignment in the Schema and the sanitizer (OLDSUI-311, ADR-0081): `figure[data-align]`
 * with `left` or `right`, and the five width presets, on a real DOMPurify as on the consumer's server.
 */

const purify = createDOMPurify(window);
const clean = (html: string) => sanitizeRichText(html, purify);
const SRC = "https://cdn.example.com/a.png";
const figure = (attrs: string, width = "50") =>
  `<figure${attrs}><img src="${SRC}" alt="" data-width="${width}"></figure>`;

test("the Schema lists the width presets and figure[data-align] as data", () => {
  expect(RICH_TEXT_SCHEMA.imageWidths).toEqual(["25", "33", "50", "75", "100"]);
  expect(RICH_TEXT_SCHEMA.attributes.figure).toEqual(["data-align"]);
  expect(RICH_TEXT_SCHEMA.imageAlignments).toEqual(["left", "right"]);
  expect(richTextSanitizeConfig().ALLOWED_ATTR).toContain("data-align");
});

test("every width preset passes; a width outside the list loses the attribute", () => {
  for (const width of RICH_TEXT_SCHEMA.imageWidths) {
    const html = figure("", width);
    expect(clean(html), width).toBe(html);
  }
  expect(clean(figure("", "40"))).toBe(`<figure><img src="${SRC}" alt=""></figure>`);
  expect(clean(figure("", "10"))).toBe(`<figure><img src="${SRC}" alt=""></figure>`);
});

test("left and right pass on a figure, in both directions", () => {
  for (const side of ["left", "right"]) {
    const html = figure(` data-align="${side}"`);
    expect(clean(html), side).toBe(html);
  }
});

test("centre, justify and other values are dropped from a figure, and the image stays", () => {
  for (const value of ["center", "justify", "LEFT", "start", "", "left right", "<b>"]) {
    expect(clean(figure(` data-align="${value}"`)), value).toBe(figure(""));
  }
});

test("data-align stays out of tags it does not belong to", () => {
  expect(clean(`<p data-align="center">a</p>`)).toBe(`<p data-align="center">a</p>`);
  expect(clean(`<img src="${SRC}" alt="" data-align="left">`)).toBe("");
  expect(clean(`<blockquote data-align="left"><p>a</p></blockquote>`)).toBe(
    `<blockquote><p>a</p></blockquote>`
  );
});

test("neither style nor float nor class nor align gets onto a figure", () => {
  expect(
    clean(
      `<figure style="float:left" class="left" align="left" data-align="left">` +
        `<img src="${SRC}" alt="" style="float:right" align="right" data-width="25"></figure>`
    )
  ).toBe(`<figure data-align="left"><img src="${SRC}" alt="" data-width="25"></figure>`);
});

test("33 is an image preset and not a column share: each tag has its own values for data-width", () => {
  const table = (shares: [string, string]) =>
    `<table><colgroup><col data-width="${shares[0]}"><col data-width="${shares[1]}"></colgroup>` +
    "<tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>";

  // A share that is not a multiple of 5 is rejected on a `col`, and the whole `colgroup` goes with it.
  const rejected = clean(table(["33", "67"]));
  expect(rejected).not.toContain("data-width");
  expect(rejected).not.toContain("colgroup");
  // The same value on an image passes, next to a valid colgroup.
  const both = clean(table(["35", "65"]) + figure("", "33"));
  expect(both).toContain('<col data-width="35">');
  expect(both).toContain('data-width="33"');
  // And a `col` share does not widen the image presets: 35 is no image width.
  expect(clean(figure("", "35"))).toBe(`<figure><img src="${SRC}" alt=""></figure>`);
});
