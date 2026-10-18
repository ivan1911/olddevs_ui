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

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The resize handles of an image (OLDSUI-311, ADR-0081). jsdom has no layout, so the widths are
 * given to it: the container is 800 px wide, and the figure is as wide as its current preset. What is
 * checked is the arithmetic of the drag and the handles on view, not the pixels of a browser.
 */
const PHOTO = "https://cdn.example.com/photo.png";
const CONTAINER = 800;

function renderEditor(value: string, props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={value} {...props} />);
  const editor = ref.current!.editor!;
  const figure = editor.view.dom.querySelector("figure") as HTMLElement;
  const width = Number(figure.querySelector("img")?.getAttribute("data-width") ?? 50);
  const rect = (w: number) => () => ({ width: w, height: 10, left: 0, top: 0 }) as DOMRect;
  figure.getBoundingClientRect = rect((CONTAINER * width) / 100);
  figure.parentElement!.getBoundingClientRect = rect(CONTAINER);
  return { editor, figure };
}

const doc = (attrs: string, width: string) =>
  `<figure${attrs}><img src="${PHOTO}" alt="" data-width="${width}"></figure>`;

function handle(figure: HTMLElement, side: "left" | "right"): HTMLElement {
  return figure.querySelector(`[data-resize-handle="${side}"]`) as HTMLElement;
}

/** Drag a handle by `dx` px, the way a mouse does it. */
function drag(target: HTMLElement, dx: number) {
  const at = (type: string, x: number) =>
    Object.assign(
      new MouseEvent(type, { clientX: x, button: 0, bubbles: true, cancelable: true }),
      {
        pointerId: 1,
      }
    );
  act(() => void target.dispatchEvent(at("pointerdown", 100)));
  act(() => void target.dispatchEvent(at("pointermove", 100 + dx)));
  act(() => void target.dispatchEvent(at("pointerup", 100 + dx)));
}

test("a centred image keeps two handles", () => {
  const { figure } = renderEditor(doc("", "50"));

  expect(handle(figure, "left").hidden).toBe(false);
  expect(handle(figure, "right").hidden).toBe(false);
});

test("an image on the left has one handle, on the right where the text is", () => {
  const { figure } = renderEditor(doc(' data-align="left"', "50"));

  expect(handle(figure, "left").hidden).toBe(true);
  expect(handle(figure, "right").hidden).toBe(false);
});

test("an image on the right has one handle, on the left", () => {
  const { figure } = renderEditor(doc(' data-align="right"', "50"));

  expect(handle(figure, "right").hidden).toBe(true);
  expect(handle(figure, "left").hidden).toBe(false);
});

test("the handles follow the alignment when it changes", () => {
  const { editor, figure } = renderEditor(doc(' data-align="left"', "50"));
  act(() => void editor.commands.setNodeSelection(0));

  act(() => void editor.chain().updateImage({ align: null }).run());

  const after = editor.view.dom.querySelector("figure") as HTMLElement;
  expect(handle(after, "left").hidden).toBe(false);
  expect(handle(after, "right").hidden).toBe(false);
  expect(after).toBe(figure);
});

test("a floated image grows one pixel for one, and snaps to the nearest preset", () => {
  const { editor, figure } = renderEditor(doc(' data-align="left"', "50"));

  // 400 + 200 = 600 px of 800: 75%. A centred image would have grown by twice the shift.
  drag(handle(figure, "right"), 200);

  expect(editor.getHTML()).toBe(doc(' data-align="left"', "75"));
});

test("a floated image on the right grows when its left handle goes left", () => {
  const { editor, figure } = renderEditor(doc(' data-align="right"', "50"));

  drag(handle(figure, "left"), -200);

  expect(editor.getHTML()).toBe(doc(' data-align="right"', "75"));
});

test("a floated image stops short of 100%: there would be no room for the text", () => {
  const { editor, figure } = renderEditor(doc(' data-align="left"', "50"));

  drag(handle(figure, "right"), 380);

  expect(editor.getHTML()).toBe(doc(' data-align="left"', "75"));
});

test("a floated image snaps down to 25% and 33%", () => {
  const first = renderEditor(doc(' data-align="left"', "50"));
  drag(handle(first.figure, "right"), -190);
  expect(first.editor.getHTML()).toBe(doc(' data-align="left"', "25"));
  cleanup();

  const second = renderEditor(doc(' data-align="left"', "50"));
  drag(handle(second.figure, "right"), -130);
  expect(second.editor.getHTML()).toBe(doc(' data-align="left"', "33"));
});

test("a centred image still grows to both sides, twice the shift, and can reach 100%", () => {
  const { editor, figure } = renderEditor(doc("", "50"));

  drag(handle(figure, "right"), 200);

  expect(editor.getHTML()).toBe(doc("", "100"));
});

test("a centred image snaps to the new small presets too", () => {
  const { editor, figure } = renderEditor(doc("", "50"));

  drag(handle(figure, "right"), -90);

  // 400 - 2 * 90 = 220 px of 800: 27.5%, closer to 25% than to 33%.
  expect(editor.getHTML()).toBe(doc("", "25"));
});
