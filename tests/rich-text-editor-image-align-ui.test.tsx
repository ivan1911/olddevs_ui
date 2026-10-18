// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import type { Editor } from "@tiptap/core";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The image alignment controls (OLDSUI-311, ADR-0081): the three toggles in the image panel and in
 * the "Edit image" popover, and the `Ctrl/⌘+Shift+L/E/R` keys on a selected image.
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

/** A panel with an image selected (position 7: after the one-letter-word paragraph "Intro"). */
async function openPanel(value: string) {
  const { editor, ...rest } = renderEditor({ defaultValue: `<p>Intro</p>${value}` });
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(7));
  const toolbar = await screen.findByRole("toolbar", { name: "Image" });
  return { editor, toolbar, ...rest };
}

const pressed = (name: string, scope: HTMLElement = document.body) =>
  within(scope).getByRole("button", { name }).getAttribute("aria-pressed");

test("the panel has three alignment toggles before the widths, with the centre pressed", async () => {
  const { toolbar } = await openPanel(figure());

  const group = within(toolbar).getByRole("group", { name: "Image alignment" });
  expect(
    within(group)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
  ).toEqual(["Left, text wraps around", "Center", "Right, text wraps around"]);
  expect(pressed("Center", group)).toBe("true");
  expect(pressed("Left, text wraps around", group)).toBe("false");
  const widths = within(toolbar).getByRole("group", { name: "Width" });
  expect(
    within(widths)
      .getAllByRole("button")
      .map((b) => b.textContent)
  ).toEqual(["25%", "33%", "50%", "75%", "100%"]);
  // The alignment group comes first in the toolbar.
  expect(group.compareDocumentPosition(widths) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("Left in the panel floats the image at 50% and keeps it selected", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure());

  await user.click(screen.getByRole("button", { name: "Left, text wraps around" }));

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "50")}`);
  await waitFor(() => {
    expect(pressed("Left, text wraps around")).toBe("true");
    expect(pressed("Center")).toBe("false");
    expect(pressed("50%")).toBe("true");
  });

  await user.click(screen.getByRole("button", { name: "Right, text wraps around" }));
  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="right"', "50")}`);

  await user.click(screen.getByRole("button", { name: "Center" }));
  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure("", "50")}`);
});

test("pressing the pressed side again keeps it", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure(' data-align="left"', "33"));

  await user.click(screen.getByRole("button", { name: "Left, text wraps around" }));

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "33")}`);
});

test("100% in the panel puts an aligned image back in the centre", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure(' data-align="right"', "50"));

  await user.click(screen.getByRole("button", { name: "100%" }));

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure("", "100")}`);
  await waitFor(() => expect(pressed("Center")).toBe("true"));
});

test("the new width presets work in the panel", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure(' data-align="left"', "50"));

  await user.click(screen.getByRole("button", { name: "25%" }));
  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "25")}`);
  await user.click(screen.getByRole("button", { name: "33%" }));
  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="left"', "33")}`);
});

test("in a table cell the alignment toggles are unavailable", async () => {
  const { editor } = renderEditor({
    defaultValue: `<table><tbody><tr><td><p>a</p>${figure("", "50")}</td></tr></tbody></table>`,
  });
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image") at = pos;
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(at));
  const toolbar = await screen.findByRole("toolbar", { name: "Image" });

  for (const name of ["Left, text wraps around", "Center", "Right, text wraps around"]) {
    expect(within(toolbar).getByRole("button", { name }).hasAttribute("disabled"), name).toBe(true);
  }
  // The width presets stay available there.
  expect(within(toolbar).getByRole("button", { name: "75%" }).hasAttribute("disabled")).toBe(false);
});

test("the Edit image popover has the same three toggles", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure());

  await user.click(screen.getByRole("button", { name: "Edit image" }));
  const dialog = await screen.findByRole("dialog", { name: "Image" });
  const group = within(dialog).getByRole("group", { name: "Image alignment" });
  expect(pressed("Center", group)).toBe("true");

  await user.click(within(group).getByRole("button", { name: "Right, text wraps around" }));
  // Choosing a side sets the width shown next to it, as the panel does.
  expect(pressed("50%", dialog)).toBe("true");
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure(' data-align="right"', "50")}`);
});

test("100% in the popover clears the side chosen there", async () => {
  const user = userEvent.setup();
  const { editor } = await openPanel(figure(' data-align="left"', "75"));

  await user.click(screen.getByRole("button", { name: "Edit image" }));
  const dialog = await screen.findByRole("dialog", { name: "Image" });
  await user.click(within(dialog).getByRole("button", { name: "100%" }));
  expect(pressed("Center", dialog)).toBe("true");
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(`<p>Intro</p>${figure("", "100")}`);
});

test("the new strings follow the provider's language", async () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={`<p>Intro</p>${figure()}`} />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(7));
  const t = ru.editor;

  const toolbar = await screen.findByRole("toolbar", { name: t.image });
  const group = within(toolbar).getByRole("group", { name: t.imageAlign });
  expect(within(group).getByRole("button", { name: t.imageAlignLeft })).toBeDefined();
  expect(within(group).getByRole("button", { name: t.imageAlignRight })).toBeDefined();
  expect(within(group).getByRole("button", { name: t.imageAlignCenter })).toBeDefined();
});

/** A keydown on the field, with the layout-independent `keyCode` the engine's keymap reads. */
function press(editor: Editor, key: "l" | "e" | "r"): boolean {
  const event = new KeyboardEvent("keydown", {
    key: key.toUpperCase(),
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: key.toUpperCase().charCodeAt(0) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

test("Ctrl+Shift+L, E and R on a selected image align the image, not the text around it", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${figure("", "50")}<p>After</p>`,
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(editor.state.doc.firstChild!.nodeSize));

  expect(press(editor, "l")).toBe(true);
  expect(editor.getHTML()).toBe(`<p>Before</p>${figure(' data-align="left"', "50")}<p>After</p>`);

  press(editor, "r");
  expect(editor.getHTML()).toBe(`<p>Before</p>${figure(' data-align="right"', "50")}<p>After</p>`);

  press(editor, "e");
  expect(editor.getHTML()).toBe(`<p>Before</p>${figure("", "50")}<p>After</p>`);
});

test("the keys keep aligning text when no image is selected", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${figure(' data-align="left"', "50")}<p>After</p>`,
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection(3));

  press(editor, "e");
  expect(editor.getHTML()).toBe(
    `<p data-align="center">Before</p>${figure(' data-align="left"', "50")}<p>After</p>`
  );
  press(editor, "r");
  expect(editor.getHTML()).toBe(
    `<p data-align="right">Before</p>${figure(' data-align="left"', "50")}<p>After</p>`
  );
});

test("the keys on an image with the caret in its caption leave the image alone", () => {
  const { editor } = renderEditor({
    defaultValue: `<figure><img src="${PHOTO}" alt="A lake" data-width="50"><figcaption>Dawn</figcaption></figure>`,
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection(4));

  press(editor, "r");

  expect(editor.getHTML()).not.toContain("data-align");
});

test("without the align Tool the keys still align a selected image", () => {
  const { editor } = renderEditor({
    tools: ["bold", "image"],
    defaultValue: `<p>Before</p>${figure("", "50")}`,
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(editor.state.doc.firstChild!.nodeSize));

  press(editor, "r");

  expect(editor.getHTML()).toBe(`<p>Before</p>${figure(' data-align="right"', "50")}`);
});
