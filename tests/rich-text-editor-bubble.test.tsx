// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
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
 * Меню выделения — `toolbar="bubble"` (OLDSUI-69): компактная плашка над
 * непустым выделением, на сенсорном экране — фиксированная Панель.
 *
 * Через публичный `RichTextEditor`, как тесты плавающей Панели: плашка —
 * `role="toolbar"` со своим именем, кнопки — ролями и именами, результат —
 * выходным HTML. Выделение и фокус ставятся командами движка (`ref.editor`):
 * мышью и клавиатурой jsdom выделять не умеет. Фокус — `view.focus()`, а не
 * команда `focus()`: та ставит его в следующем кадре.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        toolbar="bubble"
        defaultValue="<p>Hello world</p>"
        {...props}
      />
      <button type="button">Outside</button>
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  act(() => editor.view.focus());
  return { ...view, ref, editor };
}

const BUBBLE = { name: "Selection formatting" } as const;
const bubble = () => screen.queryByRole("toolbar", BUBBLE);

/** Имена кнопок плашки по порядку — так их обходят стрелки. */
const names = (toolbar: HTMLElement) =>
  within(toolbar)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));

test("the bubble appears over a non-empty selection only", async () => {
  const { editor } = renderEditor();

  act(() => void editor.commands.setTextSelection(3));
  expect(bubble()).toBeNull();

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(await screen.findByRole("toolbar", BUBBLE)).toBeDefined();
  // Это не Панель: её в режиме bubble нет ни над полем, ни над выделением.
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();

  act(() => void editor.commands.setTextSelection(3));
  await waitFor(() => expect(bubble()).toBeNull());
});

test("the bubble hides when focus leaves the editor", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await screen.findByRole("toolbar", BUBBLE);

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(bubble()).toBeNull());
});

test("a selected image gets its own toolbar, not the bubble", async () => {
  const { editor } = renderEditor({
    defaultValue: '<p>Intro</p><figure><img src="https://example.com/a.png" alt="A"></figure>',
  });

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await screen.findByRole("toolbar", BUBBLE);

  act(() => void editor.commands.setNodeSelection(7));
  await waitFor(() => expect(bubble()).toBeNull());
});

test("the bubble carries the kit's set: block type, marks, link and emoji — no history, no reference", async () => {
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);

  // «Списки ▾» — за «¶»; цвет — одна кнопка «Цвет» с обеими сетками, «Маркер»
  // стоит на Панели (OLDSUI-154).
  expect(names(toolbar)).toEqual([
    "Block type: Text",
    "Lists",
    "Bold",
    "Italic",
    "Underline",
    "Color: Default",
    "More formatting",
    "Link",
    "Emoji",
  ]);
});

test("a tool switched off takes its button out of the bubble", async () => {
  const { editor } = renderEditor({ tools: ["italic", "link", "history"] });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);

  // Без единого Блока из «¶» нет и самого меню, без редких меток и цвета — «…»,
  // без `emoji` — сетки.
  expect(names(toolbar)).toEqual(["Italic", "Link"]);
});

test("bold, italic and underline are toggles with aria-pressed", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p><strong>Hello</strong> world</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);

  const button = (name: string) => within(toolbar).getByRole("button", { name });
  expect(button("Bold").getAttribute("aria-pressed")).toBe("true");
  expect(button("Italic").getAttribute("aria-pressed")).toBe("false");
  expect(button("Underline").getAttribute("aria-pressed")).toBe("false");
  // Подсказка с сочетанием — из общей таблицы; скринридеру — `aria-keyshortcuts`.
  expect(button("Italic").getAttribute("aria-keyshortcuts")).toMatch(/\+I$/);

  await user.click(button("Italic"));
  await user.click(button("Underline"));
  expect(editor.getHTML()).toBe("<p><strong><em><u>Hello</u></em></strong> world</p>");
  expect(button("Italic").getAttribute("aria-pressed")).toBe("true");
  expect(button("Underline").getAttribute("aria-pressed")).toBe("true");
});

test("without the color tool the bubble keeps the highlight button: it opens the row of markers", async () => {
  const user = userEvent.setup();
  // С инструментом `color` маркер ставится из «Цвета» (OLDSUI-154); без него —
  // своей кнопкой, иначе в плашке его не поставить.
  const { editor } = renderEditor({ tools: ["bold", "italic", "underline", "highlight", "link"] });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);
  const highlight = () => within(toolbar).getByRole("button", { name: /^Highlight:/ });

  // Один щелчок жёлтым ушёл (OLDSUI-153): щелчок открывает ряд маркеров.
  await user.click(highlight());
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
  const row = await screen.findByRole("menu", { name: "Highlight" });
  await user.click(within(row).getByRole("menuitemradio", { name: "Yellow" }));
  expect(editor.getHTML()).toBe('<p><mark data-color="yellow">Hello</mark> world</p>');
  expect(highlight().getAttribute("aria-label")).toBe("Highlight: Yellow");
});

test("«…» in the bubble holds strikethrough instead of underline; colours are buttons next to it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    tools: ["bold", "strike", "underline", "highlight", "history"],
  });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);
  expect(names(toolbar)).toEqual(["Bold", "Underline", "Highlight: None", "More formatting"]);

  await user.click(within(toolbar).getByRole("button", { name: "More formatting" }));
  const menu = screen.getByRole("menu", { name: "More formatting" });
  // Подчёркнутый — кнопка ряда, в «…» плашки его нет; зачёркнутый — наоборот.
  expect(within(menu).queryByRole("menuitemcheckbox", { name: /^Underline/ })).toBeNull();
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: /^Strikethrough/ }));
  expect(editor.getHTML()).toBe("<p><s>Hello</s> world</p>");

  // Подменю цвета в «…» больше нет (OLDSUI-153).
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await user.click(within(toolbar).getByRole("button", { name: "More formatting" }));
  expect(screen.queryByRole("menuitem", { name: /^Highlight|^Text color/ })).toBeNull();
});

/*
  Блок кода — пункт «…» (OLDSUI-76): «…» плашки — то же меню, что у Панели, и
  пункт в нём есть, хотя кнопки Блока кода у плашки не было. Отдельной кнопки
  нет и здесь.
*/
test("«…» in the bubble holds the Code block check item", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);
  expect(within(toolbar).queryByRole("button", { name: "Code block" })).toBeNull();

  await user.click(within(toolbar).getByRole("button", { name: "More formatting" }));
  const item = within(screen.getByRole("menu", { name: "More formatting" })).getByRole(
    "menuitemcheckbox",
    { name: /^Code block/ }
  );
  expect(item.getAttribute("aria-checked")).toBe("false");
  expect(item.querySelector("kbd")?.textContent).toBe("Ctrl+Alt+C");
  await user.click(item);
  expect(editor.getHTML()).toBe("<pre><code>Hello world</code></pre>");
});

test("the link button opens the same link popover as the toolbar", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);

  await user.click(within(toolbar).getByRole("button", { name: "Link" }));
  expect(await screen.findByRole("textbox", { name: "Address" })).toBeDefined();
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

test("on a touch screen the bubble falls back to the fixed toolbar, and back", async () => {
  const pointer = stubPointer("coarse");
  const { editor } = renderEditor();

  // Фиксированная Панель видна без выделения — это и есть отступление.
  act(() => void editor.commands.setTextSelection(3));
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(bubble()).toBeNull();

  pointer.switchTo("fine");
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 4 }));
  expect(await screen.findByRole("toolbar", BUBBLE)).toBeDefined();
});

test("read-only has no bubble", async () => {
  const { editor } = renderEditor({ readOnly: true });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(bubble()).toBeNull();
});

/** `Alt+F10` в документе — так, как его слышит движок. */
function pressAltF10(editor: RichTextEditorHandle["editor"]) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", altKey: true, bubbles: true, cancelable: true })
    );
  });
}

test("Alt+F10 moves focus into the bubble, the arrows walk it, an action returns to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  // Сразу, не дожидаясь задержки показа: клавиатура показывает плашку сама.
  pressAltF10(editor);
  const toolbar = screen.getByRole("toolbar", BUBBLE);
  expect(document.activeElement).toBe(
    within(toolbar).getByRole("button", { name: "Block type: Text" })
  );
  expect(toolbar.getAttribute("aria-keyshortcuts")).toBe("Alt+F10");

  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Lists" }));
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Bold" }));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Emoji" }));
  await user.keyboard("{Home}{ArrowRight}{ArrowRight}{Enter}");
  expect(editor.getHTML()).toBe("<p><strong>Hello</strong> world</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("on an empty selection Alt+F10 does nothing", () => {
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection(3));
  pressAltF10(editor);
  expect(bubble()).toBeNull();
  expect(document.activeElement).toBe(editor.view.dom);
});

test("Escape in a menu of the bubble closes only the menu", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  pressAltF10(editor);

  await user.keyboard("{Enter}");
  expect(screen.getByRole("menu", { name: "Block type: Text" })).toBeDefined();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  const toolbar = screen.getByRole("toolbar", BUBBLE);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      within(toolbar).getByRole("button", { name: "Block type: Text" })
    )
  );
});

test("the bubble speaks the provider's language", async () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" toolbar="bubble" defaultValue="<p>Hi there</p>" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 3 }));

  const toolbar = await screen.findByRole("toolbar", { name: ru.editor.selectionToolbar });
  expect(within(toolbar).getByRole("button", { name: ru.editor.bold })).toBeDefined();
});

/*
  Показ пересчитывается по таймеру после каждой правки. Меню из плашки живёт в
  портале, вне её узла: без исключения правка за миг до открытия меню прятала
  бы плашку вместе с кнопкой меню, а Escape возвращал бы фокус в никуда.
*/
test("an open menu keeps the bubble, even when an edit lands just before it opens", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);

  await user.click(within(toolbar).getByRole("button", { name: "Bold" }));
  // Действие возвращает фокус в Документ кадром позже; таймер показа после
  // правки (250 мс) ещё идёт, когда открывается меню.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  await user.click(within(toolbar).getByRole("button", { name: "Block type: Text" }));
  expect(screen.getByRole("menu", { name: "Block type: Text" })).toBeDefined();
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

  // Открытое меню react-aria прячет остальное от скринридера (`aria-hidden`),
  // поэтому плашка проверяется узлом: она на месте, в документе.
  expect(toolbar.isConnected).toBe(true);
  // Escape закрывает только меню; фокус остаётся в плашке (куда именно —
  // решает `Toolbar`: он возвращает на последнюю кнопку, где был фокус).
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(toolbar.contains(document.activeElement)).toBe(true));
});

test("with the fixed toolbar the bubble appears over a selection too; selectionMenu={false} turns it off", async () => {
  const { editor, unmount } = renderEditor({ toolbar: undefined });
  // Панель сверху на месте — плашка её не заменяет.
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(await screen.findByRole("toolbar", BUBBLE)).toBeDefined();
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();
  unmount();

  const off = renderEditor({ toolbar: "fixed", selectionMenu: false });
  act(() => void off.editor.commands.setTextSelection({ from: 1, to: 6 }));
  // Таймер показа плашки не должен ничего нарисовать и позже.
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(bubble()).toBeNull();
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();
});

test("with the fixed toolbar and the bubble, Alt+F10 still goes to the fixed toolbar", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ toolbar: "fixed" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await screen.findByRole("toolbar", BUBBLE);

  await user.keyboard("{Alt>}{F10}{/Alt}");
  const panel = screen.getByRole("toolbar", { name: "Formatting" });
  expect(panel.contains(document.activeElement)).toBe(true);
});

test("no bubble at all when none of its tools is on", async () => {
  const { editor } = renderEditor({ toolbar: "fixed", tools: ["history", "table", "image"] });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(bubble()).toBeNull();
});

test("over the fixed toolbar the bubble does not claim Alt+F10 — the Panel does", async () => {
  const { editor, unmount } = renderEditor({ toolbar: "fixed" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", BUBBLE);
  expect(toolbar.hasAttribute("aria-keyshortcuts")).toBe(false);
  expect(
    screen.getByRole("toolbar", { name: "Formatting" }).getAttribute("aria-keyshortcuts")
  ).toBe("Alt+F10");
  unmount();

  const own = renderEditor({ toolbar: "bubble" });
  act(() => void own.editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect((await screen.findByRole("toolbar", BUBBLE)).getAttribute("aria-keyshortcuts")).toBe(
    "Alt+F10"
  );
});
