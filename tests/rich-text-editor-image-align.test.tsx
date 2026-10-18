// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Image alignment in the Editor (OLDSUI-311, ADR-0081): the node's `align` attribute, the rules that
 * tie it to the width, HTML, JSON and Markdown. The panel, the keys, the handles and the paste are in
 * their own files.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

const PHOTO = "https://cdn.example.com/photo.png";
const figure = (attrs = "", width = "") =>
  `<figure${attrs}><img src="${PHOTO}" alt="A lake"${width ? ` data-width="${width}"` : ""}></figure>`;

test("left and right are written on the figure and read back", () => {
  for (const side of ["left", "right"]) {
    const html = `<p>Intro</p>${figure(` data-align="${side}"`, "50")}<p>Text</p>`;
    const { editor, unmount } = renderEditor({ defaultValue: html });

    expect(editor.getHTML(), side).toBe(html);
    unmount();
  }
});

test("centre, justify and other values are the absence of the attribute", () => {
  for (const value of ["center", "justify", "start", "", "LEFT"]) {
    const { editor, unmount } = renderEditor({
      defaultValue: figure(` data-align="${value}"`, "50"),
    });

    expect(editor.getHTML(), value).toBe(figure("", "50"));
    unmount();
  }
});

test("an aligned image is never at its own size or at 100%: it gets 50%", () => {
  const own = renderEditor({ defaultValue: figure(' data-align="left"') });
  expect(own.editor.getHTML()).toBe(figure(' data-align="left"', "50"));
  own.unmount();

  const full = renderEditor({ defaultValue: figure(' data-align="right"', "100") });
  expect(full.editor.getHTML()).toBe(figure(' data-align="right"', "50"));
});

test("every narrower preset keeps its alignment", () => {
  for (const width of ["25", "33", "50", "75"]) {
    const html = figure(' data-align="left"', width);
    const { editor, unmount } = renderEditor({ defaultValue: html });

    expect(editor.getHTML(), width).toBe(html);
    unmount();
  }
});

test("Left on an image at its own size sets 50% in the same edit", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${figure()}` });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ align: "left" }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "50")}`);
  // One edit: one undo brings back both the position and the width.
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure()}`);
});

test("Left or Right on a 100% image sets 50% in the same edit", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${figure("", "100")}` });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ align: "right" }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="right"', "50")}`);
});

test("Left on a narrower image keeps its width", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${figure("", "25")}` });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ align: "left" }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "25")}`);
});

test("100% on an aligned image puts it back in the centre", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Intro</p>${figure(' data-align="left"', "50")}`,
  });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ width: "100" }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure("", "100")}`);
});

test("the centre clears the alignment and keeps the width", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Intro</p>${figure(' data-align="right"', "33")}`,
  });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ align: null }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure("", "33")}`);
});

test("clearing the width of an aligned image leaves 50%, not its own size", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Intro</p>${figure(' data-align="left"', "75")}`,
  });
  act(() => void editor.commands.setNodeSelection(7));

  act(() => void editor.chain().updateImage({ width: null }).run());

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "50")}`);
});

test("an image in a table cell takes no alignment from the commands", () => {
  const html =
    "<table><tbody><tr><td><p>a</p>" +
    figure("", "50") +
    "</td><td><p>b</p></td></tr></tbody></table>";
  const { editor } = renderEditor({ defaultValue: html });
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image") at = pos;
  });
  act(() => void editor.commands.setNodeSelection(at));

  const ok = editor.chain().updateImage({ align: "left" }).run();

  expect(ok).toBe(true);
  expect(editor.getHTML()).toBe(html);
});

const emptyDocument = {
  format: "olddevs-rich-text",
  version: 1,
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "other" }] }],
  },
};

test("the alignment travels through JSON in both directions", () => {
  const html = `<p>Intro</p>${figure(' data-align="right"', "33")}`;
  const { ref, editor } = renderEditor({ defaultValue: html });

  const json = ref.current!.getJSON();
  act(() => void ref.current!.setJSON(JSON.parse(JSON.stringify(emptyDocument))));
  expect(editor.getHTML()).toBe("<p>other</p>");
  act(() => void ref.current!.setJSON(json));

  expect(editor.getHTML()).toBe(html);
});

test("Markdown loses the alignment, as it loses the width and the caption", () => {
  const { ref } = renderEditor({
    defaultValue: figure(' data-align="left"', "50"),
  });

  expect(ref.current!.getMarkdown()).toBe(`![A lake](${PHOTO})`);
});
