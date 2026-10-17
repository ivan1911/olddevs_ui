// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { cleanPastedHtml } from "../src/editor/features/pasteCleanup/cleanPastedHtml.js";
import { backgroundMarkers } from "../src/editor/features/pasteCleanup/backgroundMarkers.js";
import { parseCssColor } from "../src/editor/features/pasteCleanup/cssColor.js";
import { excelCellStyles } from "../src/editor/features/pasteCleanup/excelCellStyles.js";
import { markerForColor } from "../src/editor/features/pasteCleanup/markerForColor.js";
import { EDITOR_MARKER_NAMES } from "../src/editor/styles/palette.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  Paste cleanup (OLDSUI-274), agent B: Excel cell styles from the class rules of the `<style>` block,
  and backgrounds (highlight, shading, cell fill) turned into the `highlight` Mark with the nearest
  palette marker. The fixtures are real clipboard captures (`fixtures/paste/`); the source
  workbook and document are described in the generators of the spec's `samples/`. The few synthetic
  HTML snippets below say so: no capture has those shapes.
*/

beforeAll(loadLazyBuiltins);
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures", "paste");

interface Fixture {
  "text/html": string;
  "text/plain": string;
}

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as Fixture;
}

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
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

/** Paste a fixture into an empty Editor and return the saved HTML. */
function pasted(name: string, props: Partial<RichTextEditorProps> = {}): string {
  const { editor, handle } = renderEditor(props);
  const { "text/html": html, "text/plain": text } = fixture(name);
  paste(editor, { html, text });
  return handle.getHTML();
}

/** Paste synthetic clipboard HTML. */
function pastedHtml(html: string, props: Partial<RichTextEditorProps> = {}): string {
  const { editor, handle } = renderEditor(props);
  paste(editor, { html, text: "" });
  return handle.getHTML();
}

const WITHOUT_HIGHLIGHT = RICH_TEXT_PRESETS.full.filter((tool) => tool !== "highlight");
const BROWSERS = ["chrome", "safari", "firefox"] as const;

const cell = (align: string | null, inner: string) =>
  `<td${align ? ` data-align="${align}"` : ""}><p>${inner}</p></td>`;
const mark = (color: string, inner: string) => `<mark data-color="${color}">${inner}</mark>`;

describe("Excel cell styles", () => {
  // The workbook: bold filled centered header (A1:E1), italic A2, underline A3, strikethrough A5,
  // fills on B3, C4 and E2, red text on B4, A6:B6 merged.
  const EXCEL_ROWS = [
    // The header: bold, centered, a light blue fill.
    ...["Fruit", "Origin", "Price", "Updated", "Share"].map((text) =>
      cell("center", mark("blue", `<strong>${text}</strong>`))
    ),
    // Row 2: italic A2, a green fill on E2; the right alignment of the dates is Excel's own `align`.
    cell(null, "<em>Apple</em>"),
    cell("center", "Spain"),
    cell("right", "€1.20"),
    cell("right", "01.10.2026"),
    cell("right", mark("green", "25%")),
    // Row 3: underline A3, a yellow fill on B3.
    cell(null, "<u>Pear</u>"),
    cell("center", mark("yellow", "Italy")),
    // Row 4: a peach fill on C4; the red text of B4 is not carried over.
    cell("center", "Portugal"),
    cell("right", mark("orange", "€2.10")),
    // Row 5: strikethrough A5 (Excel writes this one as `<s>` itself).
    cell(null, "<s>Discontinued</s>"),
    // Row 6: A6:B6 merged, bold, right aligned.
    '<td colspan="2" data-align="right"><p><strong>Total</strong></p></td>',
  ];

  test.each(["chrome", "firefox"])(
    "a range from Excel in %s keeps bold, italic, underline, alignment and the fill",
    (browser) => {
      const html = pasted(`excel-mac-${browser}-range`);

      for (const expected of EXCEL_ROWS) expect(html).toContain(expected);
      // Numbers, dates and text color stay plain: formats and colors are not carried over.
      expect(html).not.toMatch(/style=|class=|color:/);
      expect(html.match(/<mark/g)).toHaveLength(5 + 3);
    }
  );

  test.each(["chrome", "firefox"])("one cell from Excel in %s keeps its italic", (browser) => {
    expect(pasted(`excel-mac-${browser}-cell`)).toBe(
      "<table><tbody><tr><td><p><em>Apple</em></p></td></tr></tbody></table>"
    );
  });

  test.each(["chrome", "firefox"])(
    "the whole sheet from Excel in %s carries the styles",
    (browser) => {
      const html = pasted(`excel-mac-${browser}-whole`);

      for (const expected of EXCEL_ROWS) expect(html).toContain(expected);
      // The note under the table: italic, and its gray text color is not mapped.
      expect(html).toContain("<em>OLDSUI-274: copy A1:E6 once");
    }
  );

  test("Safari keeps the cell styles as inline values, so bold, italic and alignment need no cleanup", () => {
    const html = pasted("excel-mac-safari-range");

    expect(html).toContain(cell("center", '<mark data-color="blue"><strong>Fruit</strong></mark>'));
    expect(html).toContain(cell(null, "<em>Apple</em>"));
    expect(html).toContain(cell(null, "<u>Pear</u>"));
    expect(html).toContain('<td colspan="2" data-align="right"><p><strong>Total</strong></p></td>');
    expect(pasted("excel-mac-safari-cell")).toContain("<p><em>Apple</em></p>");
  });

  test("Safari's fills become markers: its HTML is recognized as Excel by the cell classes", () => {
    // Safari drops the Office namespaces and the `<style>` block; `detectPasteSources` tells Excel by
    // the `xl65`-style class on each cell, and the step reads the inline `background: rgb(...)`.
    const { "text/html": html } = fixture("excel-mac-safari-range");

    const cleaned = cleanPastedHtml(html);

    expect(cleaned.match(/<mark data-color="blue">/g)).toHaveLength(5);
    expect(cleaned).toContain('<mark data-color="green">25%</mark>');
    expect(cleaned).toContain('<mark data-color="yellow">Italy</mark>');
    expect(cleaned).toContain('<mark data-color="orange">€2.10</mark>');
  });

  test("without the highlight Tool the text arrives without the fill, and keeps its bold", () => {
    const html = pasted("excel-mac-chrome-range", { tools: WITHOUT_HIGHLIGHT });

    expect(html).not.toContain("<mark");
    expect(html).toContain(cell("center", "<strong>Fruit</strong>"));
    expect(html).toContain(cell("right", "25%"));
  });

  describe("on synthetic Excel HTML (no capture has these shapes)", () => {
    const excel = (css: string, body: string) =>
      `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style><!--${css}--></style></head>` +
      `<body><table>${body}</table></body></html>`;
    const run = (css: string, body: string) => cleanPastedHtml(excel(css, body), [excelCellStyles]);

    test("the cascade: the td rule, then the classes, then the cell's own style", () => {
      const out = run(
        "td{font-weight:400;text-align:general} .a{font-weight:700} .b{font-style:italic} .c{font-weight:400}",
        '<tr><td class="a b">one</td><td class="a c">two</td><td class="c" style="font-weight:bold">three</td></tr>'
      );

      expect(out).toContain('<td class="a b"><strong><em>one</em></strong></td>');
      expect(out).toContain('<td class="a c">two</td>');
      expect(out).toContain('<td class="c" style="font-weight:bold"><strong>three</strong></td>');
    });

    test("underline and strikethrough are read from text-decoration, and not from `none`", () => {
      const out = run(
        "td{text-decoration:none} .u{text-decoration:underline;text-underline-style:single} .s{text-decoration:line-through} .both{text-decoration:underline line-through}",
        '<tr><td class="u">u</td><td class="s">s</td><td class="both">b</td></tr>'
      );

      expect(out).toContain("<u>u</u>");
      expect(out).toContain("<s>s</s>");
      expect(out).toContain("<u><s>b</s></u>");
    });

    test("an alignment replaces Excel's own align; general leaves it; the fill is an inline background", () => {
      const out = run(
        ".l{text-align:left} .c{text-align:center} .g{text-align:general} .f{background:#FFC000;mso-pattern:black none} .w{background:windowtext}",
        '<tr><td class="l" align="right">a</td><td class="c" align="right">b</td>' +
          '<td class="g" align="right">c</td><td class="f">d</td><td class="w">e</td></tr>'
      );

      expect(out).toContain('<td class="l" style="text-align:left">a</td>');
      expect(out).toContain('<td class="c" align="right" style="text-align:center">b</td>');
      expect(out).toContain('<td class="g" align="right">c</td>');
      expect(out).toContain('<td class="f" style="background:#FFC000">d</td>');
      // `windowtext` is a system color, not a fill.
      expect(out).toContain('<td class="w">e</td>');
    });

    test("an empty cell (Excel writes &nbsp;) and a cell without a class are left alone", () => {
      const out = run(
        ".b{font-weight:700;background:#FFFF00}",
        '<tr><td class="b">&nbsp;</td><td>plain</td></tr>'
      );

      expect(out).toContain('<td class="b" style="background:#FFFF00">&nbsp;</td>');
      expect(out).toContain("<td>plain</td>");
    });

    test("the rules of other selectors are not mistaken for a cell's", () => {
      const out = run(
        "tr{font-weight:700} col{text-align:center} @page{margin:.75in} .x{color:red}",
        '<tr><td class="x">x</td></tr>'
      );

      expect(out).toContain('<td class="x">x</td>');
    });
  });
});

describe("Google Sheets", () => {
  // Sheets writes every property inline on the cell, so nothing in `excelCellStyles` is needed:
  // the Schema reads bold and alignment, and `backgroundMarkers` reads the fill.
  test.each(BROWSERS)(
    "a range from Sheets in %s has bold, alignment and the fills as markers",
    (browser) => {
      const html = pasted(`gsheets-${browser}-range`);

      expect(html).toContain(cell("center", mark("blue", "<strong>Share</strong>")));
      expect(html).toContain(cell("right", mark("green", "25%")));
      expect(html).toContain(cell("right", "<strong>100%</strong>"));
      expect(html.match(/<mark/g)).toHaveLength(2);
    }
  );

  test.each(BROWSERS)("one cell from Sheets in %s keeps its bold", (browser) => {
    expect(pasted(`gsheets-${browser}-cell`)).toBe("<p><strong>Share</strong></p>");
  });

  test("without the highlight Tool the Sheets fill leaves the text", () => {
    const html = pasted("gsheets-chrome-range", { tools: WITHOUT_HIGHLIGHT });

    expect(html).not.toContain("<mark");
    expect(html).toContain(cell("center", "<strong>Share</strong>"));
    expect(html).toContain(cell("right", "25%"));
  });
});

describe("Word highlight and shading", () => {
  // Word's nine highlight colors (`mso-highlight`, or the CSS name Safari writes), then the
  // character shading (peach, light blue, white), then a paragraph with a pale green background.
  const HIGHLIGHT =
    `<p>${mark("yellow", "yellow")} ${mark("green", "green")} ${mark("blue", "cyan")} ` +
    `${mark("pink", "magenta")} ${mark("blue", "blue")} ${mark("red", "red")} ` +
    `${mark("yellow", "darkYellow")} ${mark("gray", "lightGray")} ${mark("gray", "darkGray")}</p>`;
  const SHADING = `<p>Character shading (not highlight): ${mark("orange", "peach")}, ${mark("blue", "light blue")}, white.</p>`;
  const PARAGRAPH = `<p>${mark("green", "A whole paragraph with a pale green background.")}</p>`;

  test.each(BROWSERS)(
    "the highlight section from Word for Mac in %s maps to the nearest markers",
    (browser) => {
      const html = pasted(`word-mac-${browser}-highlight`);

      expect(html).toContain(HIGHLIGHT);
      expect(html).toContain(SHADING);
      expect(html).toContain(PARAGRAPH);
      expect(html).not.toContain("white</mark>");
    }
  );

  test.each(BROWSERS)("a filled table cell from Word for Mac in %s becomes a marker", (browser) => {
    const html = pasted(`word-mac-${browser}-table`);

    expect(html).toContain(
      `<td><p>${mark("blue", "<strong>Fruit</strong>")}</p></td>` +
        `<td><p>${mark("blue", "<strong>Origin</strong>")}</p></td>` +
        `<td><p data-align="right">${mark("blue", "<strong>Price</strong>")}</p></td>`
    );
    expect(html).toContain(`<td><p data-align="center">${mark("yellow", "Italy")}</p></td>`);
    expect(html.match(/<mark/g)).toHaveLength(4);
  });

  test("without the highlight Tool the Word text arrives without a Mark", () => {
    const html = pasted("word-mac-chrome-highlight", { tools: WITHOUT_HIGHLIGHT });

    expect(html).not.toContain("<mark");
    expect(html).toContain(
      "<p>yellow green cyan magenta blue red darkYellow lightGray darkGray</p>"
    );
    expect(html).toContain("<p>A whole paragraph with a pale green background.</p>");
  });

  test("a Word list item with a shaded paragraph is still a list item, without its marker", () => {
    // Synthetic: no capture has a shaded list item. The marker span and the comments around it
    // must stay outside the mark, where the list step looks for them.
    const html = pastedHtml(
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><body>' +
        "<p class=MsoListParagraphCxSpFirst style='margin-left:.5in;text-indent:-.25in;mso-list:l0 level1 lfo1;background:#FFF2CC'>" +
        "<![if !supportLists]><span style='mso-list:Ignore'>•<span>&nbsp;</span></span><![endif]>Shaded item</p>" +
        "<p class=MsoListParagraphCxSpLast style='margin-left:.5in;text-indent:-.25in;mso-list:l0 level1 lfo1'>" +
        "<![if !supportLists]><span style='mso-list:Ignore'>•<span>&nbsp;</span></span><![endif]>Plain item</p>" +
        "</body></html>"
    );

    expect(html).toBe(
      `<ul><li><p>${mark("yellow", "Shaded item")}</p></li><li><p>Plain item</p></li></ul>`
    );
  });
});

describe("Google Docs highlight", () => {
  test.each(BROWSERS)(
    "the highlight, the shaded paragraph and the cell fills from Docs in %s",
    (browser) => {
      const html = pasted(`gdocs-${browser}-whole`);

      // The Docs highlighter is #ffff00; `#ffffff` and `transparent` on the other spans are no marker.
      expect(html).toContain(mark("yellow", "yellow"));
      expect(html).toContain(
        `<p>${mark("green", "A whole paragraph with a pale green background.")}</p>`
      );
      expect(html).toContain(`<th><p>${mark("blue", "<strong>Fruit</strong>")}</p></th>`);
      expect(html).toContain(`<td><p data-align="center">${mark("yellow", "Italy")}</p></td>`);
      expect(html).not.toContain("white</mark>");
    }
  );

  test("the plain Docs captures (no highlights) come out without a marker", () => {
    for (const name of ["inline-formatting", "lists", "tables"]) {
      expect(pasted(`gdocs-chromium-${name}`)).not.toContain("<mark");
      cleanup();
    }
  });

  test("a text color is not turned into a marker", () => {
    // Synthetic: Docs writes `color`, and `background-color:transparent` next to it.
    const html = pastedHtml(
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1">' +
        '<span style="color:#ff0000;background-color:transparent;">red text</span></b>'
    );

    expect(html).not.toContain("<mark");
  });
});

describe("other sources", () => {
  test("a background in HTML from a web page or an editor is not a marker", () => {
    // The page's own markup, as in the pilot test: no Office signs, so no step runs at all.
    const page =
      "<meta charset='utf-8'><p>See <span style=\"background-color: #ffeb3b\">this</span> and " +
      '<code style="background: rgb(246, 248, 250)">code</code></p>';
    const vscode =
      '<meta charset="utf-8"><div style="color: #cccccc;background-color: #1f1f1f;">' +
      '<div><span style="background-color: #264f78">const</span> a = 1;</div></div>';

    expect(cleanPastedHtml(page)).toBe(page);
    expect(cleanPastedHtml(vscode)).toBe(vscode);
    expect(pastedHtml(page)).not.toContain("<mark");
    expect(pastedHtml(vscode)).not.toContain("<mark");
  });

  test("a Google Docs page background on a div is not text marking", () => {
    // Synthetic: a `div` (the page wrapper of an Office web app) and the `body` are not marked.
    const html = pastedHtml(
      '<meta charset="utf-8"><div style="background-color:#ffff00"><b id="docs-internal-guid-1" style="font-weight:normal;">' +
        '<p style="background-color:#ffffff">text</p></b></div>'
    );

    expect(html).not.toContain("<mark");
    expect(html).toContain("text");
  });
});

describe("backgroundMarkers on synthetic Office HTML", () => {
  const word = (body: string) =>
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><body>${body}</body></html>`;
  const run = (body: string) => cleanPastedHtml(word(body), [backgroundMarkers]);

  test("a name in mso-highlight alone, without a background, is the color", () => {
    expect(run("<p><span style='mso-highlight:lime'>x</span></p>")).toBe(
      `<p><span>${mark("green", "x")}</span></p>`
    );
  });

  test("an inner background wins over an outer one, as in the source", () => {
    const out = run(
      "<p style='background:#E2EFDA'>outer <span style='background:#FFF2CC'>inner</span> end</p>"
    );

    expect(out).toBe(
      `<p>${mark("green", `outer <span>${mark("yellow", "inner")}</span> end`)}</p>`
    );
  });

  test("a filled cell marks the text of each of its paragraphs, not the cell", () => {
    const out = run(
      "<table><tr><td style='background:#BDD7EE'><p>one</p>\n<p>two</p><p>&nbsp;</p></td></tr></table>"
    );

    expect(out).toContain(`<p>${mark("blue", "one")}</p>`);
    expect(out).toContain(`<p>${mark("blue", "two")}</p>`);
    // An empty paragraph has nothing to mark.
    expect(out).toContain("<p>&nbsp;</p>");
  });

  test("the bgcolor attribute of an old cell is a fill", () => {
    expect(
      run("<table><tr><td bgcolor='#FFFF00'>x</td><td bgcolor='FF0000'>y</td></tr></table>")
    ).toContain(
      `<td bgcolor="#FFFF00">${mark("yellow", "x")}</td><td bgcolor="FF0000">${mark("red", "y")}</td>`
    );
  });

  test("white, black, near-white, transparent and unknown backgrounds are dropped", () => {
    for (const value of [
      "white",
      "#FFFFFF",
      "#fff",
      "black",
      "rgb(0, 0, 0)",
      "rgb(250, 250, 250)",
      "transparent",
      "rgba(255, 235, 59, 0)",
      "windowtext",
      "inherit",
      "linear-gradient(red, blue)",
    ]) {
      expect(run(`<p><span style="background:${value}">x</span></p>`), value).not.toContain(
        "<mark"
      );
    }
  });

  test("a color after an image or a repeat in the shorthand is found", () => {
    expect(
      run("<p><span style='background:url(a.png) no-repeat rgb(226, 239, 218)'>x</span></p>")
    ).toContain(mark("green", "x"));
  });

  test("the text color of a span is left alone", () => {
    const out = run("<p><span style='color:#C00000;mso-color-alt:windowtext'>red</span></p>");

    expect(out).toBe('<p><span style="color:#C00000;mso-color-alt:windowtext">red</span></p>');
  });
});

describe("the nearest marker", () => {
  const marker = (text: string) => {
    const color = parseCssColor(text);
    return color ? markerForColor(color) : undefined;
  };

  // The kit's own marker tokens (`--od-marker-*`, in `styles.css`): each one must map back to its own
  // marker, in the dark and in the light variant. If a token is changed, this tells.
  test.each([
    ["#ffea80", "yellow"],
    ["#aaff80", "green"],
    ["#ff80bf", "pink"],
    ["#5a5a5a", "gray"],
    ["#603b2c", "brown"],
    ["#854c1d", "orange"],
    ["#28456c", "blue"],
    ["#492f64", "purple"],
    ["#6e3630", "red"],
    ["#e3e2e0", "gray"],
    ["#eee0da", "brown"],
    ["#fadec9", "orange"],
    ["#d3e5ef", "blue"],
    ["#e8deee", "purple"],
    ["#ffe2dd", "red"],
  ])("the token %s is %s", (value, expected) => {
    expect(marker(value)).toBe(expected);
  });

  test("the names stay inside the palette", () => {
    const all = new Set<string>();
    for (let hue = 0; hue < 360; hue += 3) {
      for (const [saturation, lightness] of [
        [0, 0.5],
        [0.9, 0.5],
        [0.4, 0.3],
        [0.9, 0.85],
        [0.5, 0.7],
      ] as const) {
        const a = saturation * Math.min(lightness, 1 - lightness);
        const channel = (n: number) => {
          const k = (n + hue / 30) % 12;
          return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        const name = markerForColor({
          red: channel(0),
          green: channel(8),
          blue: channel(4),
          alpha: 1,
        });
        if (name) all.add(name);
      }
    }
    expect([...all].sort()).toEqual([...EDITOR_MARKER_NAMES].sort());
  });

  test.each([
    // Word's highlighter, by name.
    ["yellow", "yellow"],
    ["lime", "green"],
    ["aqua", "blue"],
    ["fuchsia", "pink"],
    ["blue", "blue"],
    ["red", "red"],
    ["navy", "blue"],
    ["teal", "blue"],
    ["green", "green"],
    ["purple", "purple"],
    ["maroon", "red"],
    ["olive", "yellow"],
    ["darkgray", "gray"],
    ["lightgrey", "gray"],
    // Excel and Docs palettes.
    ["#D9E2F3", "blue"],
    ["#E2EFDA", "green"],
    ["#FFF2CC", "yellow"],
    ["#F8CBAD", "orange"],
    ["#BDD7EE", "blue"],
    ["#FF0000", "red"],
    ["#C00000", "red"],
    ["#FFFF00", "yellow"],
    ["#92D050", "green"],
    ["#00B0F0", "blue"],
    ["#7030A0", "purple"],
    ["#F2F2F2", "gray"],
    ["#808080", "gray"],
    ["rgb(217, 226, 243)", "blue"],
    ["#d9e2f3", "blue"],
  ])("%s is %s", (value, expected) => {
    expect(marker(value)).toBe(expected);
  });

  test.each(["white", "black", "#fafafa", "#101010", "transparent", "rgba(255, 0, 0, 0.05)"])(
    "%s is no marker",
    (value) => {
      expect(marker(value)).toBeNull();
    }
  );

  test("a color that is not a color is not read", () => {
    for (const value of ["windowtext", "auto", "none", "#12", "rgb(1, 2)", "notacolor"]) {
      expect(parseCssColor(value), value).toBeNull();
    }
  });
});

test("the steps of agent B are in the pipeline, in order", () => {
  const html = fixture("excel-mac-chrome-range")["text/html"];

  // Excel's fill is read by `backgroundMarkers` only after `excelCellStyles` put it on the cell.
  expect(cleanPastedHtml(html, [backgroundMarkers, excelCellStyles])).not.toContain("<mark");
  expect(cleanPastedHtml(html, [excelCellStyles, backgroundMarkers])).toContain("<mark");
});
