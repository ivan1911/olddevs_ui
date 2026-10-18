// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { cleanPastedHtml } from "../src/editor/features/pasteCleanup/cleanPastedHtml.js";
import { tableColumnWidths } from "../src/editor/features/pasteCleanup/tableColumnWidths.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  Paste cleanup, table column widths (OLDSUI-310, ADR-0080): the widths each office application writes
  are turned into `colgroup` shares by the `tableColumnWidths` step, and a foreign `colgroup` from any
  other source is read by the table node itself. The fixtures are real clipboard captures
  (`fixtures/paste/`); the few synthetic snippets say so.
*/

beforeAll(loadLazyBuiltins);
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures", "paste");

function fixture(name: string): { "text/html": string; "text/plain": string } {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));
}

function paste(editor: Editor, payload: { text?: string; html?: string }) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) =>
        (type === "text/plain" ? payload.text : type === "text/html" ? payload.html : "") ?? "",
      types: Object.keys(payload).map((key) => (key === "text" ? "text/plain" : "text/html")),
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Pastes clipboard HTML into an empty Editor and returns the saved HTML. */
function pastedHtml(html: string, text = ""): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" />);
  paste(ref.current!.editor!, { html, text });
  return ref.current!.getHTML();
}

const pasted = (name: string) => {
  const { "text/html": html, "text/plain": text } = fixture(name);
  return pastedHtml(html, text);
};

/** The shares of the tables in the saved HTML, one list per table. */
const sharesOf = (html: string): number[][] =>
  Array.from(html.matchAll(/<colgroup>(.*?)<\/colgroup>/g), ([, cols]) =>
    Array.from(cols!.matchAll(/data-width="(\d+)"/g), ([, share]) => Number(share))
  );

describe("Excel", () => {
  // The workbook: five columns of 132, 84, 72, 84 and 60 points (`style` in points, the `width`
  // attribute is the same in rounded pixels).
  test.each(["chrome", "safari", "firefox"])("a range from Excel for Mac in %s", (browser) => {
    expect(sharesOf(pasted(`excel-mac-${browser}-range`))).toEqual([[30, 20, 15, 20, 15]]);
  });

  test.each(["chrome", "firefox"])("a range from Excel for Windows in %s", (browser) => {
    // Another zoom, so other pixels and points: the same proportions, the same shares.
    expect(sharesOf(pasted(`excel-win-${browser}-range`))).toEqual([[30, 20, 15, 20, 15]]);
  });

  test("a single cell has one column and so no widths", () => {
    expect(pasted("excel-mac-chrome-cell")).not.toContain("colgroup");
  });

  test("no pixels, points or style stay in the Document", () => {
    const html = pasted("excel-mac-chrome-range");
    expect(html).not.toMatch(/[^-]width[=:]|style=/);
  });

  test("a hidden column (width 0) leaves the range to its content", () => {
    // Synthetic: Excel writes `display:none` and a zero width for a hidden column.
    const html =
      '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table>' +
      "<col width=0 style='display:none;mso-width-source:userset;width:0pt'>" +
      "<col width=64 style='width:48pt'><col width=64 style='width:48pt'>" +
      "<tr><td>a</td><td>b</td><td>c</td></tr></table></body></html>";
    expect(pastedHtml(html)).not.toContain("colgroup");
  });
});

describe("Google Docs and Google Sheets", () => {
  test("Docs widths of columns the author resized become shares", () => {
    // Real captures: three columns of 200 pixels each.
    expect(sharesOf(pasted("gdocs-chrome-whole"))).toEqual([[35, 35, 30]]);
  });

  test("a Docs table whose columns have no width is left to its content", () => {
    expect(pasted("gdocs-chromium-tables")).not.toContain("colgroup");
  });

  test("a Sheets range of 20 columns or fewer becomes shares, the way the table is read", () => {
    // Synthetic, in the shape of the capture (`gsheets-chrome-range`: `<col width="69"/>` then 60s):
    // 22 columns in the real one, which is more than the Editor builds, so it keeps none.
    const html =
      '<google-sheets-html-origin><table xmlns="http://www.w3.org/1999/xhtml" dir="ltr" border="1" ' +
      'style="table-layout:fixed;width:0px" data-sheets-root="1"><colgroup>' +
      '<col width="100"/><col width="200"/><col width="100"/><col width="200"/></colgroup><tbody>' +
      "<tr><td>a</td><td>b</td><td>c</td><td>d</td></tr></tbody></table></google-sheets-html-origin>";
    expect(sharesOf(pastedHtml(html))).toEqual([[15, 35, 15, 35]]);
  });

  test("the real Sheets range has 22 columns, more than a table can hold shares for", () => {
    expect(pasted("gsheets-chrome-range")).not.toContain("colgroup");
  });
});

describe("Word", () => {
  test.each(["chrome", "safari", "firefox"])(
    "the cell widths of a table from Word for Mac in %s become shares, merges and all",
    (browser) => {
      const html = pasted(`word-mac-${browser}-table`);

      // Three columns of 150 pt each, with a merged cell in the table.
      expect(sharesOf(html)).toEqual([[35, 35, 30]]);
      expect(html).toMatch(/colspan="2"|rowspan="2"/);
    }
  );

  test("a table from Word for Windows", () => {
    expect(sharesOf(pasted("word-win-chrome-table"))).toEqual([[35, 35, 30]]);
  });

  test("Word 2007 in Firefox: two columns of the same width", () => {
    expect(sharesOf(pasted("word2007-win-firefox-table"))).toEqual([[50, 50]]);
  });

  test("the width in percent is read as it is", () => {
    // Synthetic: Word writes `width="25%"` when the table was set in percent.
    const html =
      '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><table class="MsoTableGrid">' +
      '<tr><td width="25%" style="width:25%"><p class="MsoNormal">a</p></td>' +
      '<td width="75%" style="width:75%"><p class="MsoNormal">b</p></td></tr></table></body></html>';
    expect(sharesOf(pastedHtml(html))).toEqual([[25, 75]]);
  });

  test("the first row is merged: the widths come from a row that is not", () => {
    // Synthetic: a title across the whole table, then the real columns.
    const html =
      '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><table class="MsoTableGrid">' +
      '<tr><td colspan="2" width="400" style="width:300pt"><p class="MsoNormal">Title</p></td></tr>' +
      '<tr><td width="100" style="width:75pt"><p class="MsoNormal">a</p></td>' +
      '<td width="300" style="width:225pt"><p class="MsoNormal">b</p></td></tr></table></body></html>';
    expect(sharesOf(pastedHtml(html))).toEqual([[25, 75]]);
  });

  test("a table without cell widths, or with one missing, is left to its content", () => {
    const table = (cells: string) =>
      '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><table class="MsoTableGrid"><tr>' +
      `${cells}</tr></table></body></html>`;
    expect(pastedHtml(table("<td><p>a</p></td><td><p>b</p></td>"))).not.toContain("colgroup");
    expect(pastedHtml(table('<td width="100"><p>a</p></td><td><p>b</p></td>'))).not.toContain(
      "colgroup"
    );
  });
});

describe("the step itself", () => {
  const html = (colgroup: string) =>
    '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table>' +
    `${colgroup}<tr><td>a</td><td>b</td></tr></table></body></html>`;

  test("writes a canonical colgroup and removes the source's own markup", () => {
    const out = cleanPastedHtml(
      html("<col width=100 style='width:75pt'><col width=300 style='width:225pt'>"),
      [tableColumnWidths]
    );

    expect(out).toContain(
      '<table><colgroup><col data-width="25"><col data-width="75"></colgroup><tbody>'
    );
    expect(out).not.toContain("width=100");
  });

  test("is for office sources only: a web page's table is left to the table node", () => {
    const web =
      '<table><colgroup><col width="100"><col width="300"></colgroup><tr><td>a</td><td>b</td></tr></table>';

    expect(cleanPastedHtml(web, [tableColumnWidths])).toBe(web);
  });

  test("a copy from a web page is read by the table node: pixels become shares there", () => {
    const web =
      '<table><colgroup><col width="100"><col width="300"></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';

    expect(sharesOf(pastedHtml(web))).toEqual([[25, 75]]);
    expect(pastedHtml(web)).not.toMatch(/[^-]width="|style=/);
  });

  test("a web page's colgroup in percent, and one with a column missing its width", () => {
    const pct =
      '<table><colgroup><col style="width: 30%"><col style="width: 70%"></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
    const partial =
      '<table><colgroup><col width="100"><col></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';

    expect(sharesOf(pastedHtml(pct))).toEqual([[30, 70]]);
    expect(pastedHtml(partial)).not.toContain("colgroup");
  });
});
