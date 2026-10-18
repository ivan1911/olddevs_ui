// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";

afterEach(cleanup);

/**
 * The Skeleton of a table with widths (OLDSUI-310): until the table chunk has loaded, the Document is
 * static HTML shaped by the light parts of the Tool, so the widths are drawn already and the field does
 * not jump when the engine arrives. The Skeleton reads only the Editor's own markup (`col[data-width]`);
 * the widths other applications write are the engine's to read, which is the lazy part.
 *
 * The file stands alone on purpose: the loader's cache lives on the module, so the first `full` Editor
 * in a file is the one that sees the Skeleton (`rich-text-editor-lazy-builtins.test.tsx`).
 */

const cols = (...shares: number[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;
const OWN = `<table>${cols(40, 60)}<tbody><tr><td><p>Ada</p></td><td><p>Lin</p></td></tr></tbody></table>`;
const FOREIGN =
  '<table><colgroup><col width="100"><col width="300"></colgroup><tbody><tr><td><p>Ada</p></td>' +
  "<td><p>Lin</p></td></tr></tbody></table>";

test("the Skeleton draws the widths the Editor wrote, and the engine keeps them when it arrives", async () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(<RichTextEditor ref={ref} aria-label="Body" value={OWN} />);

  expect(ref.current?.editor).toBeNull();
  expect(
    Array.from(container.querySelectorAll("table > colgroup > col"), (col) =>
      col.getAttribute("data-width")
    )
  ).toEqual(["40", "60"]);

  await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 });
  expect(ref.current?.getHTML()).toBe(OWN);
});

test("a table with the widths of another application is the engine's to read: the Skeleton has none, the Document does", async () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(<RichTextEditor ref={ref} aria-label="Body" value={FOREIGN} />);

  // The chunk is cached from the first test, so the engine is already there: this is its read.
  await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 });
  expect(container.querySelectorAll("table > colgroup > col")).toHaveLength(2);
  expect(ref.current?.getHTML()).toBe(
    `<table>${cols(25, 75)}<tbody><tr><td><p>Ada</p></td><td><p>Lin</p></td></tr></tbody></table>`
  );
});
