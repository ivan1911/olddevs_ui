// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Плавающая Панель (OLDSUI-42): над непустым выделением, а на сенсорных
 * экранах — фиксированная, чтобы не спорить с системным меню выделения.
 *
 * Выделение и фокус ставятся командами движка (`ref.editor`): мышью и
 * клавиатурой jsdom выделять не умеет. Фокус — `view.focus()`, а не команда
 * `focus()`: та ставит его в следующем кадре.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      toolbar="floating"
      defaultValue="<p>Hello world</p>"
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  act(() => editor.view.focus());
  return { ...view, ref, editor };
}

test("the floating toolbar appears over a non-empty selection only", async () => {
  const { editor } = renderEditor();

  act(() => void editor.commands.setTextSelection(3));
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", { name: "Formatting" });
  expect(toolbar.querySelector('[aria-label="Bold"]')).not.toBeNull();

  act(() => void editor.commands.setTextSelection(3));
  await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull());
});

/** Сенсорный экран: `matchMedia("(pointer: coarse)")` совпадает, и о смене сообщается. */
function stubPointer(initial: "coarse" | "fine") {
  let coarse = initial === "coarse";
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        get matches() {
          return query === "(pointer: coarse)" && coarse;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList
  );
  return {
    switchTo(next: "coarse" | "fine") {
      coarse = next === "coarse";
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

test("on a touch screen the floating toolbar falls back to the fixed one, and back", async () => {
  const pointer = stubPointer("coarse");
  const { editor } = renderEditor();

  // Фиксированная Панель видна без выделения — это и есть отступление.
  act(() => void editor.commands.setTextSelection(3));
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();

  pointer.switchTo("fine");
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(await screen.findByRole("toolbar", { name: "Formatting" })).toBeDefined();
});

/** `Alt+F10` в документе — так, как его слышит движок. */
function pressAltF10(editor: RichTextEditorHandle["editor"]) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", altKey: true, bubbles: true, cancelable: true })
    );
  });
}

test("Alt+F10 moves focus from the selection into the floating toolbar, Shift+Tab back", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ preset: "basic" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  // Сразу, не дожидаясь задержки показа: клавиатура показывает Панель сама.
  pressAltF10(editor);
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  // Первая кнопка Панели `basic` — жирный: «¶» из одного «Текста» не рисуется
  // (OLDSUI-154), за жирным — курсив.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
  expect(toolbar.getAttribute("aria-keyshortcuts")).toBe("Alt+F10");

  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }));
  await user.keyboard("{ArrowLeft}{Enter}");
  expect(editor.getHTML()).toBe("<p><strong>Hello</strong> world</p>");
  // Действие возвращает фокус в документ, на то же выделение (в следующем кадре).
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));

  pressAltF10(editor);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(editor.view.dom);
  expect(editor.state.selection.from).toBe(1);
  expect(editor.state.selection.to).toBe(6);
});

test("Alt+F10 reaches the fixed toolbar too, and does nothing without a toolbar", () => {
  const { editor } = renderEditor({ toolbar: "fixed", preset: "basic" });

  pressAltF10(editor);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
  cleanup();

  const without = renderEditor({ toolbar: "none" });
  pressAltF10(without.editor);
  expect(document.activeElement).toBe(without.editor.view.dom);
});
