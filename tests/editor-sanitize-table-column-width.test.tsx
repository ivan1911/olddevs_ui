// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
} from "../src/editor/schema-entry.js";

/**
 * Table column widths in the Schema and the sanitizer (OLDSUI-310, ADR-0080): `colgroup > col` with
 * `data-width`, a share in 5% steps summing to 100, on a real DOMPurify as on the consumer's server.
 * The Editor side, in both directions, is in `rich-text-editor-table-column-width.test.tsx`.
 */

const purify = createDOMPurify(window);
const clean = (html: string) => sanitizeRichText(html, purify);

const cols = (...shares: (number | string)[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;
const table = (colgroup: string, columns = 2) =>
  `<table>${colgroup}<tbody><tr>${"<td><p>x</p></td>".repeat(columns)}</tr></tbody></table>`;

test("the Schema lists colgroup, col and col[data-width] as data", () => {
  expect(RICH_TEXT_SCHEMA.blocks).toContain("colgroup");
  expect(RICH_TEXT_SCHEMA.blocks).toContain("col");
  expect(RICH_TEXT_SCHEMA.attributes.col).toEqual(["data-width"]);
  expect(RICH_TEXT_SCHEMA.tableColumnShares).toEqual({ step: 5, min: 5, max: 95, total: 100 });
});

test("a colgroup the Editor writes comes through unchanged", () => {
  for (const html of [
    table(cols(35, 65)),
    table(cols(5, 95)),
    table(cols(35, 35, 30), 3),
    table(cols(...Array.from({ length: 20 }, () => 5)), 20),
  ]) {
    expect(clean(html), html).toBe(html);
  }
});

test("a colgroup whose shares break the rule is removed whole, and the table stays", () => {
  const bare = table("");
  for (const colgroup of [
    cols(35, 60), // does not add up to 100
    cols(35, 70),
    cols(33, 67), // not a multiple of 5
    cols(0, 100), // outside 5 to 95
    cols(100),
    cols(2.5, 97.5),
    cols("", 100),
    cols("abc", "def"),
    "<colgroup><col><col></colgroup>",
    cols(50, 50).replace("<col ", '<col span="2" '),
    cols(50, 50).replace("</colgroup>", '<col data-width="5"></colgroup>'),
    cols(...Array.from({ length: 21 }, () => 5)),
  ]) {
    expect(clean(table(colgroup)), colgroup).toBe(bare);
  }
});

test("a value is checked per column: spaces around it are trimmed, units and signs are not accepted", () => {
  expect(clean(table('<colgroup><col data-width=" 35 "><col data-width="65"></colgroup>'))).toBe(
    table(cols(35, 65))
  );
  for (const value of ["35%", "35px", "+35", "3.5e1", "035"]) {
    expect(
      clean(table(`<colgroup><col data-width="${value}"><col data-width="65"></colgroup>`))
    ).toBe(table(""));
  }
});

test("style, class and every other attribute on a colgroup or a col are removed", () => {
  const html = table(
    '<colgroup class="x" style="width:1px" id="g"><col data-width="35" style="width:9px" class="c" width="10" onclick="steal()"><col data-width="65"></colgroup>'
  );
  expect(clean(html)).toBe(table(cols(35, 65)));
  expect(clean(html)).not.toMatch(/style|class|width="10"|onclick|id=/);
});

test("only the first colgroup of a table counts", () => {
  expect(clean(table(cols(35, 65) + cols(50, 50)))).toBe(table(cols(35, 65)));
});

test("a col or a colgroup outside its place is removed, and the text around it stays", () => {
  expect(clean('<p>a<col data-width="50">b</p>')).toBe("<p>ab</p>");
  expect(clean(`<div>${cols(50, 50)}text</div>`)).not.toMatch(/colgroup|<col/);
  expect(clean(`<p>${cols(50, 50)}text</p>`)).toBe("<p>text</p>");
});

test("data-width keeps its image rule: it is not a column share there", () => {
  const image = (width: string) =>
    `<figure><img src="https://cdn.example.com/a.png" alt="" data-width="${width}"></figure>`;
  expect(clean(image("50"))).toBe(image("50"));
  expect(clean(image("35"))).toBe(image("35").replace(' data-width="35"', ""));
  // And a share on anything else is not a width.
  expect(clean('<p data-width="35">x</p>')).toBe("<p>x</p>");
});

test("the bare config passes the tags and the attribute as harmless; the rule is in the hooks", () => {
  const config = richTextSanitizeConfig();
  expect(config.ALLOWED_TAGS).toContain("colgroup");
  expect(config.ALLOWED_TAGS).toContain("col");
  expect(config.ALLOWED_ATTR).toContain("data-width");
  // Nothing is checked without the hooks: a list that breaks the rule comes through, and the
  // Editor and the styles ignore it.
  const bare = purify.sanitize(table(cols(35, 60)), config);
  expect(bare).toContain("colgroup");
  expect(clean(table(cols(35, 60)))).not.toContain("colgroup");
});

test("a table keeps its widths next to merges and alignment", () => {
  const html =
    `<table>${cols(35, 35, 30)}<tbody><tr><th colspan="2" data-align="center"><p>h</p></th>` +
    '<th data-align="right"><p>i</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td><td><p>c</p></td></tr></tbody></table>';
  expect(clean(html)).toBe(html);
});
