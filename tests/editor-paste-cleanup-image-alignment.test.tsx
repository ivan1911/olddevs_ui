// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { cleanPastedHtml } from "../src/editor/features/pasteCleanup/cleanPastedHtml.js";
import { detectPasteSources } from "../src/editor/features/pasteCleanup/pasteSources.js";
import { loadPasteCleanup } from "../src/editor/features/pasteCleanup/pasteCleanupTool.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  Paste cleanup, image alignment (OLDSUI-311, ADR-0081, decision 10): the side a picture had in Word
  or on a web page (`align`, `float`, `mso-wrap-style`) becomes the image's alignment. All of it is
  "synthetic": HTML written by hand from the description of the formats, because the captured
  fixtures (`fixtures/paste/`) have no floated picture. Word writes the side as the `align` attribute
  of the `<img>` (with `hspace`), and a web page as `float` in its `style` or as `align`.
*/

beforeAll(async () => {
  await loadLazyBuiltins();
  await loadPasteCleanup();
});
afterEach(cleanup);

const SRC = "https://cdn.example.com/a.png";
const WORD =
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
  'xmlns:w="urn:schemas-microsoft-com:office:word"><body>';

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  return { handle: ref.current!, editor: ref.current!.editor! };
}

function paste(editor: Editor, html: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : ""),
      types: ["text/html"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Paste into an empty Editor and return the saved HTML. */
function pasted(html: string): string {
  const { handle, editor } = renderEditor();
  paste(editor, html);
  return handle.getHTML();
}

const figure = (attrs: string, width?: string) =>
  `<figure${attrs}><img src="${SRC}" alt=""${width ? ` data-width="${width}"` : ""}></figure>`;

describe("the sources", () => {
  test("a float or an align on a picture is a source of its own", () => {
    for (const html of [
      `<img src="${SRC}" style="float:left">`,
      `<img src="${SRC}" align="right">`,
      `<figure style="float: right"><img src="${SRC}"></figure>`,
      `<img src="${SRC}" style="mso-wrap-style:square">`,
    ]) {
      expect(detectPasteSources(html).imageAlignment, html).toBe(true);
    }
  });

  test("pictures without a side, other attributes and the Editor's own markup are not", () => {
    for (const html of [
      `<img src="${SRC}" width="200">`,
      `<p style="float:left">text</p>`,
      `<figure data-align="left"><img src="${SRC}" data-width="50"></figure>`,
      `<p>an img align="left" quoted in text</p>`,
      `<img src="${SRC}" data-align="left">`,
    ]) {
      expect(detectPasteSources(html).imageAlignment, html).toBe(false);
    }
  });

  test("a clipboard with no source comes back as the same string", () => {
    const html = `<p>text</p><img src="${SRC}" width="200">`;

    expect(cleanPastedHtml(html)).toBe(html);
  });
});

describe("a web page", () => {
  test("float: left and float: right on the img become the side", () => {
    expect(pasted(`<img src="${SRC}" alt="" style="float:left; margin:0 1em">`)).toBe(
      figure(' data-align="left"', "50")
    );
    expect(pasted(`<img src="${SRC}" alt="" style="margin:0;float: right">`)).toBe(
      figure(' data-align="right"', "50")
    );
  });

  test("the obsolete align attribute on the img", () => {
    expect(pasted(`<img src="${SRC}" alt="" align="left">`)).toBe(
      figure(' data-align="left"', "50")
    );
    expect(pasted(`<img src="${SRC}" alt="" ALIGN="Right">`)).toBe(
      figure(' data-align="right"', "50")
    );
  });

  test("float or align on a figure, and a float on the img inside it, count the same", () => {
    expect(pasted(`<figure style="float:right"><img src="${SRC}" alt=""></figure>`)).toBe(
      figure(' data-align="right"', "50")
    );
    expect(pasted(`<figure align="left"><img src="${SRC}" alt=""></figure>`)).toBe(
      figure(' data-align="left"', "50")
    );
    expect(
      pasted(
        `<figure><img src="${SRC}" alt="" style="float:left"><figcaption>Dawn</figcaption></figure>`
      )
    ).toBe(
      `<figure data-align="left"><img src="${SRC}" alt="" data-width="50"><figcaption>Dawn</figcaption></figure>`
    );
  });

  test("the img itself outranks the figure around it", () => {
    expect(
      pasted(`<figure style="float:left"><img src="${SRC}" alt="" style="float:right"></figure>`)
    ).toBe(figure(' data-align="right"', "50"));
  });

  test("centre, inherit, none and other values give no side", () => {
    for (const value of ["float:none", "float:inherit", "float:center", "float:left!important"]) {
      const html = pasted(`<img src="${SRC}" alt="" style="${value}">`);
      expect(html.includes("data-align"), value).toBe(value.includes("left"));
    }
    expect(pasted(`<img src="${SRC}" alt="" align="middle">`)).toBe(
      `<figure><img src="${SRC}" alt=""></figure>`
    );
    expect(pasted(`<img src="${SRC}" alt="" align="center">`)).toBe(
      `<figure><img src="${SRC}" alt=""></figure>`
    );
  });

  test("a float on something that is not a picture does nothing", () => {
    expect(pasted(`<p style="float:left">text</p><img src="${SRC}" alt="" align="left">`)).toBe(
      `<p>text</p>${figure(' data-align="left"', "50")}`
    );
  });
});

/*
  WordPress (OLDSUI-314). The side is a class, and its float lives in the theme's stylesheet, which
  does not travel with the clipboard: the classic editor puts `alignleft` on the `img` itself, the
  block editor puts it on the `figure` (`wp-block-image`), sometimes inside a `div` of that class.
*/
describe("WordPress", () => {
  test("alignleft and alignright on the img become the side", () => {
    const classic = pasted(
      `<p><img src="${SRC}" alt="" class="alignleft size-medium wp-image-12" width="300">` +
        "The text that wraps the picture.</p>"
    );
    expect(classic).toContain(figure(' data-align="left"', "50"));
    expect(classic).toContain("The text that wraps the picture.");
    expect(pasted(`<img src="${SRC}" alt="" class="ALIGNRIGHT">`)).toBe(
      figure(' data-align="right"', "50")
    );
  });

  test("the block editor's figure, alone or in its div", () => {
    expect(
      pasted(
        `<figure class="wp-block-image alignright size-large"><img src="${SRC}" alt=""></figure>`
      )
    ).toBe(figure(' data-align="right"', "50"));
    expect(
      pasted(
        `<div class="wp-block-image"><figure class="alignleft size-large"><img src="${SRC}" alt=""><figcaption>Dawn</figcaption></figure></div>`
      )
    ).toBe(
      `<figure data-align="left"><img src="${SRC}" alt="" data-width="50"><figcaption>Dawn</figcaption></figure>`
    );
  });

  test("aligncenter and alignnone give no side, as align=center does", () => {
    expect(pasted(`<img src="${SRC}" alt="" class="aligncenter">`)).toBe(
      `<figure><img src="${SRC}" alt=""></figure>`
    );
    expect(pasted(`<img src="${SRC}" alt="" class="alignnone size-full">`)).toBe(
      `<figure><img src="${SRC}" alt=""></figure>`
    );
  });

  test("only the whole class counts, and only on a picture", () => {
    for (const name of ["myalignleft", "alignleft-wide", "has-alignleft"]) {
      expect(pasted(`<img src="${SRC}" alt="" class="${name}">`), name).toBe(
        `<figure><img src="${SRC}" alt=""></figure>`
      );
    }
    expect(detectPasteSources(`<p class="alignleft">text</p>`).imageAlignment).toBe(false);
    expect(detectPasteSources(`<img src="${SRC}" class="x alignleft">`).imageAlignment).toBe(true);
  });
});

describe("the width of the source", () => {
  test("a percentage goes to the nearest preset that leaves room for the text", () => {
    const cases: [string, string][] = [
      ["width:20%", "25"],
      ["width:30%", "33"],
      ["width: 45%", "50"],
      ["width:70%", "75"],
      // 100% leaves no room to wrap, so the nearest preset that does is 75.
      ["width:100%", "75"],
    ];
    for (const [style, width] of cases) {
      expect(pasted(`<img src="${SRC}" alt="" style="float:left;${style}">`), style).toBe(
        figure(' data-align="left"', width)
      );
    }
    expect(pasted(`<img src="${SRC}" alt="" align="left" width="40%">`)).toBe(
      figure(' data-align="left"', "33")
    );
  });

  test("pixels, points and no width give 50%", () => {
    for (const source of [
      'width="300"',
      'width="300" height="200"',
      'style="width:300px"',
      'style="width:225pt"',
      'style="width:12em"',
      "",
    ]) {
      expect(pasted(`<img src="${SRC}" alt="" align="left" ${source}>`), source).toBe(
        figure(' data-align="left"', "50")
      );
    }
  });

  test("a picture with no side keeps going in at its own size, as before", () => {
    expect(pasted(`<img src="${SRC}" alt="" style="width:30%">`)).toBe(
      `<figure><img src="${SRC}" alt=""></figure>`
    );
  });
});

describe("Word", () => {
  test("align=left and hspace on the img, in a paragraph of its own", () => {
    const html =
      `${WORD}<p class=MsoNormal><span style='mso-ignore:vglayout'>` +
      `<img width=200 height=150 src="${SRC}" align=left hspace=12 alt="Lake" v:shapes="Picture_x0020_1">` +
      `</span>The text that wraps the picture.</p></body></html>`;

    const result = pasted(html);

    expect(result).toContain(
      `<figure data-align="left"><img src="${SRC}" alt="Lake" data-width="50"></figure>`
    );
    expect(result).toContain("The text that wraps the picture.");
  });

  test("align=right", () => {
    const html = `${WORD}<p class=MsoNormal><img width=200 src="${SRC}" align=right alt=""></p></body></html>`;

    // An image inside a paragraph splits it: the empty paragraph before is the one the paste went into.
    expect(pasted(html)).toContain(figure(' data-align="right"', "50"));
  });

  test("a picture the text does not wrap (mso-wrap-style: none) stays in its line", () => {
    const html =
      `${WORD}<p class=MsoNormal><img src="${SRC}" alt="" align=left ` +
      `style='mso-wrap-style:none'></p></body></html>`;

    const result = pasted(html);
    expect(result).toContain(`<figure><img src="${SRC}" alt=""></figure>`);
    expect(result).not.toContain("data-align");
  });

  test("mso-wrap-style: square next to a float is the float", () => {
    const html =
      `${WORD}<p class=MsoNormal><img src="${SRC}" alt="" ` +
      `style='float:right;mso-wrap-style:square'></p></body></html>`;

    expect(pasted(html)).toContain(figure(' data-align="right"', "50"));
  });
});

describe("what it leaves alone", () => {
  test("the Editor's own markup keeps its side and width", () => {
    const own = `<p>Intro</p>${figure(' data-align="right"', "33")}`;

    expect(pasted(own)).toBe(own);
  });

  test("an image with a foreign address still disappears, with or without a side", () => {
    expect(pasted(`<img src="data:image/png;base64,AAAA" alt="" align="left"><p>after</p>`)).toBe(
      "<p>after</p>"
    );
  });

  test("a failing step pastes the original HTML as if there were no cleanup", () => {
    const html = `<img src="${SRC}" alt="" align="left">`;
    const broken = {
      name: "broken",
      applies: () => true,
      run: () => {
        throw new Error("boom");
      },
    };

    expect(cleanPastedHtml(html, [broken])).toBe(html);
  });
});
