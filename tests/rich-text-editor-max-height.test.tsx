// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/*
  Захват указателя — бухгалтерия, которая есть в любом браузере, а в jsdom её
  нет: двойной щелчок по ручке высоты шлёт `pointerdown`, и без заплатки падало
  бы окружение. Та же заплатка, что в `split-panel.test.tsx`.
*/
for (const method of ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      value: method === "hasPointerCapture" ? () => false : () => {},
    });
  }
}

/**
 * Высота поля (OLDSUI-123, ADR-0059): `maxHeight` ограничивает область
 * Документа, и длинный Документ прокручивается внутри рамки; `resizable` даёт
 * ей ручку высоты. Панель над областью и Строка статуса под ней не
 * прокручиваются. Без пропов поле растёт вместе с Документом, как раньше.
 *
 * Через публичный `RichTextEditor`. Раскладки в jsdom нет, поэтому видно
 * устройство поля — что внутри области прокрутки и что снаружи, — а сама
 * прокрутка и ручка проверяются в браузере (`tests-visual`).
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<h2>Plan</h2><p>First paragraph.</p>"
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

const textbox = () => screen.getByRole("textbox", { name: "Body" });

/** Ближайший предок Документа, который прокручивает его сам. */
function scrollArea(from: HTMLElement = textbox()): HTMLElement | null {
  for (let node = from.parentElement; node; node = node.parentElement) {
    if (node.className.includes("overflow-y-auto")) return node;
  }
  return null;
}

function areaOf(from?: HTMLElement): HTMLElement {
  const area = scrollArea(from);
  if (!area) throw new Error("the Document has no scroll area");
  return area;
}

test("without the props the field grows with the Document: nothing scrolls it", () => {
  renderEditor();
  expect(scrollArea()).toBeNull();
});

test("maxHeight in pixels limits the Document area; the toolbar and the status line stay outside", () => {
  renderEditor({ maxHeight: 320, status: <span>Saved</span> });
  const area = areaOf();
  expect(area.style.maxHeight).toBe("320px");
  expect(area.style.height).toBe("");
  expect(area.contains(screen.getByRole("toolbar"))).toBe(false);
  expect(area.contains(screen.getByText("Saved"))).toBe(false);
});

test("maxHeight takes any CSS length as a string", () => {
  renderEditor({ maxHeight: "60vh" });
  expect(areaOf().style.maxHeight).toBe("60vh");
});

const resizer = () => screen.getByRole("slider", { name: "Resize the editor" });

/**
 * Раскладки в jsdom нет: высота области на экране подставляется, как её
 * отдал бы браузер, и ползунок меряет её на фокусе.
 */
function laidOut(area: HTMLElement, height: number) {
  area.getBoundingClientRect = () => ({ height }) as DOMRect;
  act(() => resizer().focus());
}

test("resizable: maxHeight becomes the starting height, and the handle is the kit's own, not the browser corner", () => {
  renderEditor({ maxHeight: 320, resizable: true });
  const area = areaOf();
  expect(area.style.height).toBe("320px");
  expect(area.style.maxHeight).toBe("");
  // Нативный уголок `resize` не берёт тему — его нет.
  expect(area.className).not.toContain("resize-y");
  laidOut(area, 320);
  expect(resizer().getAttribute("aria-valuetext")).toBe("320 pixels high");
});

test("the arrows resize the field by 16 px, with Shift by a pixel; double click goes back to the start", async () => {
  const user = userEvent.setup();
  renderEditor({ maxHeight: 320, resizable: true });
  const area = areaOf();
  laidOut(area, 320);
  await user.keyboard("{ArrowDown}");
  expect(area.style.height).toBe("336px");
  await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
  expect(area.style.height).toBe("335px");
  await user.dblClick(resizer().parentElement!);
  expect(area.style.height).toBe("320px");
});

test("the field does not shrink below a few lines", async () => {
  const user = userEvent.setup();
  renderEditor({ maxHeight: 140, resizable: true });
  const area = areaOf();
  laidOut(area, 140);
  await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
  expect(area.style.height).toBe("128px");
});

test("resizable alone starts at the height of the Document", () => {
  renderEditor({ resizable: true });
  expect(areaOf().style.height).toBe("");
  expect(resizer()).toBeTruthy();
});

test("without resizable there is no height handle", () => {
  renderEditor({ maxHeight: 320 });
  expect(screen.queryByRole("slider", { name: "Resize the editor" })).toBeNull();
});

test("the HTML mode field takes the place of the Document inside the same area", async () => {
  const user = userEvent.setup();
  renderEditor({ maxHeight: 320 });
  const area = areaOf();
  await user.click(screen.getByRole("button", { name: "HTML" }));
  const field = screen.getByRole("textbox", { name: "HTML source" });
  expect(area.contains(field)).toBe(true);
});

test("the block handle scrolls with the Document: its place counts the scroll of the area", () => {
  const { editor } = renderEditor({ maxHeight: 320 });
  const area = areaOf();
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(2);
  });
  const handle = screen.getByRole("button", { name: "Block actions" });
  expect(area.contains(handle)).toBe(true);
  const top = parseFloat(handle.style.top);

  Object.defineProperty(area, "scrollTop", { configurable: true, value: 200 });
  act(() => void editor.commands.setTextSelection(3));
  expect(parseFloat(handle.style.top)).toBe(top + 200);
});
