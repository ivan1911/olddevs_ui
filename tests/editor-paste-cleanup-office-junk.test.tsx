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
import { horizontalRules } from "../src/editor/features/pasteCleanup/horizontalRules.js";
import { officeJunk } from "../src/editor/features/pasteCleanup/officeJunk.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  Paste cleanup, Office junk and horizontal rules (OLDSUI-274). The fixtures are real clipboard
  captures (`fixtures/paste/`, their origin is in `fixtures/paste/NOTICE`). Where no capture shows a
  shape, the test says "synthetic": it is HTML written by hand from the description of the format.
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

/** What the cleanup step hands to the Schema: the clipboard HTML of a fixture, cleaned. */
function cleaned(name: string): Document {
  const html = cleanPastedHtml(fixture(name)["text/html"]);
  return new DOMParser().parseFromString(html, "text/html");
}

/** The two steps of this file, on their own and in their order, for synthetic HTML. */
function clean(html: string): string {
  return cleanPastedHtml(html, [horizontalRules, officeJunk]);
}

/** The markup without attributes: what remains after the cleanup, without Word's styles. */
function bare(html: string): string {
  return html.replace(/\s+[\w:-]+=(?:"[^"]*"|'[^']*')/g, "");
}

/** The signs of Word in the HTML string; the steps do not run without them. */
const WORD =
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
  'xmlns:w="urn:schemas-microsoft-com:office:word"><body>';
const DOCS = '<b id="docs-internal-guid-test" style="font-weight:normal;">';

const WITHOUT_RULE = RICH_TEXT_PRESETS.full.filter((tool) => tool !== "horizontalRule");

describe("horizontal rules", () => {
  test.each(["chrome", "safari", "firefox"])(
    "a line inserted in Google Docs (%s) is one divider, with no empty paragraphs around it",
    (browser) => {
      // The test document with "Insert → Horizontal line" added at its end, captured 2026-10-18.
      const html = pasted(`gdocs-${browser}-rule-native`);

      expect(html.match(/<hr>/g)).toHaveLength(3);
      expect(html).not.toContain("<p></p><hr>");
      expect(html).not.toContain("<hr><p></p>");
    }
  );

  /** Section 5 of the test document: a bottom border on an empty paragraph, a top border on a text one. */
  const RULES =
    "<h1>5. Horizontal rules</h1><p>Text above a paragraph with a bottom border.</p><hr>" +
    "<p>Text below the bottom border.</p><hr><p>A paragraph with a top border.</p>";

  test.each(["chrome", "safari", "firefox"])(
    "a bottom and a top paragraph border from Word for Mac in %s become <hr>",
    (browser) => {
      const html = pasted(`word-mac-${browser}-rule`);

      expect(html).toContain(RULES);
      // The empty bordered paragraph is replaced by the line, not kept next to it.
      expect(html).not.toContain("<p></p>");
      expect(html).not.toContain("&nbsp;");
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "the rules inside the whole Word document from %s",
    (browser) => {
      const html = pasted(`word-mac-${browser}-whole`);

      expect(html).toContain(RULES);
      expect(html.match(/<hr>/g)).toHaveLength(2);
    }
  );

  // The Docs copies come from an uploaded .docx: Docs kept the two paragraph borders as `border-top`
  // and `border-bottom` of the paragraph. A native "Insert > Horizontal line" is in no capture.
  test.each(["chrome", "safari", "firefox"])(
    "the paragraph borders of a .docx opened in Google Docs, copied in %s, become <hr>",
    (browser) => {
      const html = pasted(`gdocs-${browser}-whole`);

      expect(html).toContain(RULES);
      expect(html.match(/<hr>/g)).toHaveLength(2);
    }
  );

  test("the borders of table cells in Google Docs are not rules", () => {
    expect(pasted("gdocs-chromium-tables")).not.toContain("<hr>");
    expect(pasted("gdocs-chrome-whole").match(/<hr>/g)).toHaveLength(2);
  });

  test.each(["word-mac-chrome-rule", "gdocs-chrome-whole"])(
    "without the horizontalRule Tool the Schema drops the line and the text stays (%s)",
    (name) => {
      const html = pasted(name, { tools: WITHOUT_RULE });

      expect(html).not.toContain("<hr");
      expect(html).toContain(
        "<p>Text above a paragraph with a bottom border.</p><p>Text below the bottom border.</p>" +
          "<p>A paragraph with a top border.</p>"
      );
    }
  );

  test("the Word table of the Windows capture has no rules in it", () => {
    expect(pasted("word2007-win-firefox-table")).not.toContain("<hr>");
  });

  // Synthetic: HTML written from the shape of Word's CSS, for what the captures do not show.
  describe("shapes (synthetic)", () => {
    const border = (style: string, body = "Text") =>
      `${WORD}<p class=MsoNormal style='${style}'>${body}</p>`;

    test("a text paragraph gets the line on its bordered side", () => {
      expect(bare(clean(border("border-bottom:solid windowtext 1.0pt")))).toBe("<p>Text</p><hr>");
      expect(bare(clean(border("border-top:solid windowtext 1.0pt")))).toBe("<hr><p>Text</p>");
      expect(bare(clean(border("border-top:solid black 1pt;border-bottom:solid black 1pt")))).toBe(
        "<hr><p>Text</p><hr>"
      );
    });

    test("an empty paragraph with the border in any of its forms is only the line", () => {
      const empty = "<o:p>&nbsp;</o:p>";
      expect(bare(clean(border("border-bottom:solid windowtext 1.0pt", empty)))).toBe("<hr>");
      expect(
        bare(clean(border("border:none;mso-border-bottom-alt:solid windowtext .75pt", empty)))
      ).toBe("<hr>");
      expect(bare(clean(border("border-top:1px solid #ccc", "<br>")))).toBe("<hr>");
    });

    test("paragraphs that share a border get one line above and one below", () => {
      const html =
        `${WORD}<div style='mso-element:para-border-div;border-top:solid black 1pt;` +
        "border-bottom:solid black 1pt'><p class=MsoNormal style='border:none;" +
        "mso-border-top-alt:solid black 1pt;mso-border-bottom-alt:solid black 1pt'>One</p>" +
        "<p class=MsoNormal style='border:none;mso-border-alt:none'>Two</p></div>";

      expect(bare(clean(html))).toBe("<hr><p>One</p><p>Two</p><hr>");
    });

    test("the border group of Safari has no marker, only the border of its own", () => {
      const html =
        `${WORD}<div style="border-width: medium medium 1pt; border-style: none none solid; ` +
        'padding: 0in 0in 1pt;"><p class="MsoNormal" style="border: medium; padding: 0in;">' +
        "<o:p> </o:p></p></div>";

      expect(bare(clean(html))).toBe("<hr>");
    });

    test("a box or a bar on the side is not a rule", () => {
      expect(clean(border("border:solid black 1pt"))).not.toContain("<hr>");
      expect(clean(border("border-left:solid black 3pt"))).not.toContain("<hr>");
      expect(
        clean(border("border-bottom:solid black 1pt;border-right:solid black 1pt"))
      ).not.toContain("<hr>");
      const group = `${WORD}<div style='mso-element:para-border-div;border:solid black 1pt'><p class=MsoNormal style='border:none;mso-border-alt:solid black .5pt'>Boxed</p></div>`;
      expect(clean(group)).not.toContain("<hr>");
    });

    test("no border, a hidden border and a border of no width are not rules", () => {
      expect(clean(border("border:none"))).not.toContain("<hr>");
      expect(clean(border("border-bottom:none;border-top:hidden"))).not.toContain("<hr>");
      expect(clean(border("border-bottom:solid black 0pt"))).not.toContain("<hr>");
      expect(clean(border("border-bottom:1pt black"))).not.toContain("<hr>");
    });

    test("a border on a heading is a line after it", () => {
      expect(bare(clean(`${WORD}<h1 style="border-bottom:solid #4F81BD 1pt">Title</h1>`))).toBe(
        "<h1>Title</h1><hr>"
      );
    });

    test("a bordered paragraph with an image is not an empty line holder", () => {
      const html = border("border-bottom:solid black 1pt", '<img src="https://example.com/a.png">');

      expect(bare(clean(html))).toBe("<p><img></p><hr>");
    });

    test("HTML from other sources keeps its borders as they are", () => {
      const page = '<p style="border-bottom:1px solid #ccc">A line under a page paragraph</p>';
      const docsOnly = `${DOCS}<table><tbody><tr><td style="border-bottom:solid #000 1pt">Cell</td></tr></tbody></table></b>`;

      expect(cleanPastedHtml(page, [horizontalRules, officeJunk])).toBe(page);
      expect(clean(docsOnly)).not.toContain("<hr>");
    });
  });
});

describe("Word bookmarks", () => {
  test.each(["chrome", "safari", "firefox"])(
    "the links section from Word for Mac in %s: the external link stays, bookmark links go",
    (browser) => {
      const html = pasted(`word-mac-${browser}-links`);

      expect(html).toContain(
        "<h1>7. Bookmarks and links</h1><p>Go to the table section or back to the first section. " +
          "Each section heading is a bookmark.</p>"
      );
      // One link is left: the external one, whatever the Schema does to its address afterwards.
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).toMatch(
        /<a href="https?:\/\/example\.com\/docs[^"]*"[^>]*>(?:<u>)?example\.com\/docs/
      );
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "the external address is not touched by the step itself (%s)",
    (browser) => {
      const links = Array.from(cleaned(`word-mac-${browser}-links`).querySelectorAll("a"));

      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "https://example.com/docs?page=1#top",
      ]);
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "the whole Word document from %s has no bookmarks, no links into itself and no Office tags",
    (browser) => {
      const document = cleaned(`word-mac-${browser}-whole`);

      expect(document.querySelectorAll("a[name]")).toHaveLength(0);
      expect(document.querySelectorAll('a[href^="#"], a[href^="applewebdata:"]')).toHaveLength(0);
      expect(document.getElementsByTagName("o:p")).toHaveLength(0);
      // The text of the headings stays where the bookmark anchor was.
      expect(
        Array.from(document.querySelectorAll("h1"), (h) =>
          h.textContent?.replace(/\s+/g, " ").trim()
        )
      ).toContain("7. Bookmarks and links");
    }
  );

  test("the table of contents of Word keeps its entries as text", () => {
    const html = pasted("word-mac-chrome-whole");

    expect(html).toContain("1. Headings and inline marks");
    expect(html).not.toContain("PAGEREF");
    expect(html).not.toContain("_Toc");
  });

  test.each(["chrome", "safari", "firefox"])(
    "Word's empty paragraph and its soft break survive (%s)",
    (browser) => {
      const html = pasted(`word-mac-${browser}-headings`);

      expect(html).toContain("<p>This line ends with a soft break,<br>and this line continues");
      expect(html).toContain("<p></p><p>The empty paragraph above is intentional.</p>");
    }
  );

  // Synthetic: the shapes of the names Word gives its bookmarks.
  describe("bookmarks (synthetic)", () => {
    test("anchors without an address are unwrapped and keep their content", () => {
      const html =
        `${WORD}<h1><a name="_Toc12"><span>Heading</span></a></h1><p><a name="s_numbered"></a>Text ` +
        '<a name="_Hlk99">marked</a><a name="OLE_LINK2"></a> end</p>';

      expect(bare(clean(html))).toBe("<h1><span>Heading</span></h1><p>Text marked end</p>");
    });

    test("links to Word's own bookmarks are unwrapped, links out of the document stay", () => {
      const html =
        `${WORD}<p><a name="local"></a><a href="#_Toc12">toc</a> <a href="#_Hlk5">hlk</a> ` +
        '<a href="#_Ref7">ref</a> <a href="#local">local</a> <a href="#nowhere">nowhere</a> ' +
        '<a href="applewebdata://AB12-34#_Toc1">safari</a> <a href="https://example.com/a#b">web</a> ' +
        '<a href="mailto:a@example.com">mail</a> <a name="both" href="https://example.com/">both</a></p>';

      expect(clean(html)).toBe(
        "<p>toc hlk ref local nowhere safari " +
          '<a href="https://example.com/a#b">web</a> <a href="mailto:a@example.com">mail</a> ' +
          '<a name="both" href="https://example.com/">both</a></p>'
      );
    });
  });
});

describe("<o:p>", () => {
  test("the Windows capture: Word 2007 paragraph marks are gone", () => {
    const document = cleaned("word2007-win-firefox-table");

    expect(document.getElementsByTagName("o:p")).toHaveLength(0);
    expect(document.querySelectorAll("table")).toHaveLength(1);
  });

  // Synthetic: the Mac captures have empty marks only; marks with content are in older Word.
  test("an empty mark goes, a mark with content gives the content back", () => {
    const html =
      `${WORD}<p class=MsoNormal>a<o:p></o:p></p><p class=MsoNormal><o:p>&nbsp;</o:p></p>` +
      "<p class=MsoNormal><o:p> </o:p></p><p class=MsoNormal><o:p>Text <b>bold</b></o:p></p>";

    expect(bare(clean(html))).toBe("<p>a</p><p></p><p></p><p>Text <b>bold</b></p>");
  });

  test("an empty Word paragraph is still an empty paragraph in the Document", () => {
    const { editor, handle } = renderEditor();
    paste(editor, {
      html: `${WORD}<p class=MsoNormal>One<o:p></o:p></p><p class=MsoNormal><o:p>&nbsp;</o:p></p><p class=MsoNormal>Two<o:p></o:p></p>`,
    });

    expect(handle.getHTML()).toBe("<p>One</p><p></p><p>Two</p>");
  });
});

describe("conditional comments", () => {
  const commentTexts = (document: Document): string[] => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    const found: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      found.push((node as Comment).data.trim());
    }
    return found;
  };

  test.each(["chrome", "firefox"])(
    "the whole Word document from %s: the Office-only blocks are gone, the lists markers were taken",
    (browser) => {
      const raw = fixture(`word-mac-${browser}-whole`)["text/html"];
      const before = new DOMParser().parseFromString(raw, "text/html");
      const after = cleaned(`word-mac-${browser}-whole`);

      // The capture has them (the test is not vacuous) and nothing of them is left.
      expect(
        commentTexts(before).filter((text) => /^\[if (?:supportFields|gte mso)/.test(text)).length
      ).toBeGreaterThan(0);
      expect(
        commentTexts(after).filter((text) => /^\[if (?:supportFields|gte mso)/.test(text))
      ).toEqual([]);
      expect(after.body.innerHTML).not.toMatch(/PAGEREF|<w:data>/);
    }
  );

  test("Safari writes the markers as real comments; the Office-only ones do not reach the Schema", () => {
    const after = cleaned("word-mac-safari-whole");

    expect(commentTexts(after).filter((text) => /mso|supportFields/.test(text))).toEqual([]);
  });

  // Synthetic: the revealed form `<![if …]>` with real nodes between the markers is in no capture.
  describe("blocks (synthetic)", () => {
    test("an Office-only block goes with what it hides, in both forms", () => {
      const html =
        `${WORD}<p>a<!--[if gte mso 9]><xml><w:data>00AB</w:data></xml><![endif]-->b</p>` +
        "<![if gte mso 9]><p>Office only</p><![endif]><p>c<![if supportFields]><span>CODE</span><![endif]>d</p>";

      expect(clean(html)).toBe("<p>ab</p><p>cd</p>");
    });

    test("a nested block is cut as a whole", () => {
      const html = `${WORD}<![if gte mso 9]><p>one</p><![if vml]><p>two</p><![endif]><p>three</p><![endif]><p>kept</p>`;

      expect(clean(html)).toBe("<p>kept</p>");
    });

    test("the content of a block for everyone else stays", () => {
      const html =
        `${WORD}<p><![if !supportLists]>1.<![endif]> Item</p>` +
        '<p><![if !vml]><img src="https://example.com/a.png"><![endif]></p>' +
        "<!--[if !mso]><!--><p>for browsers</p><!--<![endif]-->";
      const result = clean(html);

      expect(result).toContain("<!--[if !supportLists]-->1.<!--[endif]--> Item");
      expect(result).toContain('<img src="https://example.com/a.png">');
      expect(result).toContain("<p>for browsers</p>");
    });

    test("an opening marker without a closing one cuts nothing", () => {
      const html = `${WORD}<p>a</p><![if gte mso 9]><p>b</p><p>c</p>`;

      expect(clean(html)).toContain("<p>b</p><p>c</p>");
    });

    test("Excel's conditional comments are cleared the same way", () => {
      const html =
        '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>1</td></tr>' +
        "<!--[if gte mso 9]><xml><x:ExcelWorkbook/></xml><![endif]--></table></body></html>";

      expect(clean(html)).not.toContain("ExcelWorkbook");
    });
  });
});

describe("stray <br>", () => {
  const BETWEEN_BLOCKS =
    /<\/(?:p|h[1-6]|div|table|ul|ol|b)>\s*<br\b|<br\b[^>]*>\s*<(?:p|h[1-6]|div|table|ul|ol)\b/;

  test.each([
    "gdocs-chrome-whole",
    "gdocs-firefox-whole",
    "gdocs-safari-whole",
    "gdocs-chromium-lists",
    "gdocs-chromium-tables",
    "gdocs-chromium-inline-formatting",
    "gdocs-chromium-headings-with-inline-formatting",
    "gdocs-chromium-titles-and-empty-headings",
  ])("Google Docs copy %s: no <br> is left between blocks", (name) => {
    const raw = fixture(name)["text/html"];
    const html = cleanPastedHtml(raw);

    expect(raw).toMatch(BETWEEN_BLOCKS);
    expect(html).not.toMatch(BETWEEN_BLOCKS);
    expect(html).not.toContain("Apple-interchange-newline");
  });

  test.each(["chrome", "firefox", "safari"])(
    "Google Docs copy in %s gives no empty paragraphs from the gaps, and keeps the soft break",
    (browser) => {
      const html = pasted(`gdocs-${browser}-whole`);

      expect(html).not.toMatch(/<p>(?:<br>)?<\/p>/);
      expect(html).toContain("<p>This line ends with a soft break,<br>and this line continues");
    }
  );

  test("Google Docs: the empty bordered line is the rule, not a paragraph with a break", () => {
    expect(pasted("gdocs-chrome-whole")).not.toMatch(/<p><br><\/p>/);
  });

  test("the copy from Word in Safari ends with no break from the selection", () => {
    const html = cleanPastedHtml(fixture("word-mac-safari-rule")["text/html"]);

    expect(html).not.toContain("Apple-interchange-newline");
  });

  // Synthetic: the shapes are the ones above, cut down to what the rule is about.
  describe("breaks (synthetic)", () => {
    test("a break between two blocks, before the first or after the last, is removed", () => {
      const html = `${DOCS}<br><p>a</p><br /><h1>b</h1> <br> <ul><li>c</li></ul><br></b><br class="Apple-interchange-newline">`;

      expect(bare(clean(html))).toBe(
        "<b><p>a</p><h1>b</h1> <ul><li>c</li></ul></b>".replace(" ", "  ")
      );
    });

    test("a break inside a line, or alone in a paragraph or a cell, stays", () => {
      const html =
        `${DOCS}<p>a<br>b</p><p><br></p><table><tbody><tr><td>x<br>y</td><td><br></td></tr></tbody></table>` +
        "<p><span>c</span><br><span>d</span></p></b>";

      expect(clean(html)).toBe(html);
    });

    test("a break between text and a block is a line break of the text", () => {
      const html = `${WORD}<div>text<br><p>next</p></div>`;

      expect(clean(html)).toContain("text<br>");
    });

    test("nothing is removed from HTML of other sources", () => {
      const page =
        '<p>a</p><br><p>b<o:p></o:p></p><a name="top"></a><a href="#top">up</a>' +
        '<!--[if gte mso 9]>hidden<![endif]--><br class="Apple-interchange-newline">';

      expect(clean(page)).toBe(page);
    });

    test("only the breaks go from a Docs copy: Word's bookmarks and marks are not Docs'", () => {
      const html = `${DOCS}<p>a<o:p></o:p></p><br><p><a name="x">b</a></p></b>`;

      expect(clean(html)).toContain('<p>a<o:p></o:p></p><p><a name="x">b</a></p>');
    });
  });
});
