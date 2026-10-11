// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../src/components/overlays/Menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/overlays/Popover.js";
import {
  GLASS_INVERSE_CLASS,
  GLASS_MENU_CLASS,
  GLASS_PANEL_CLASS,
} from "../src/editor/styles/glass.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { testAskTool, testPickerTool, testRemarkTool } from "./editor-test-tools.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

// Карточка у текста грузится лениво (`RichTextEditor.tsx`): чанк прогрет заранее.
beforeAll(() => import("../src/editor/ui/TextCard.js"));

afterEach(cleanup);

/**
 * Стекло на всплывающих поверхностях Редактора (OLDSUI-118): плавающие
 * панели, меню выделения, списки меню и поповеры — полупрозрачная подложка
 * своей поверхности с размытием фона. Те же `Menu` и `Popover` вне Редактора
 * остаются сплошными.
 *
 * jsdom не считает стили, поэтому проверяется класс поверхности: что из него
 * выходит на экране, показывают истории и визуальные снимки.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Hello world</p>" {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

/** Сплошные подложки, которые стекло заменяет: остаться рядом с ним они не должны. */
const SOLID = ["bg-bg-1", "bg-surface-elevated", "bg-surface-inverse"];

/**
 * Классы поверхности целиком: подложка, размытие, сплошной фолбэк — и ни
 * одной сплошной подложки без условия. Оставь `cn` обе, исход решал бы
 * порядок правил в CSS, а не разметка.
 */
function expectSurface(node: Element | null, surface: string) {
  expect(node).not.toBeNull();
  expect(node).toHaveProperty("className");
  const classes = new Set((node as HTMLElement).className.split(/\s+/));
  for (const name of surface.split(/\s+/)) expect(classes).toContain(name);
  for (const name of SOLID) expect(classes).not.toContain(name);
}

/** Панель всплывающего списка: узел попоувера, в котором лежит меню. */
const panelOf = (menu: HTMLElement) => menu.closest("[data-trigger]");

test("the floating toolbar sits on the glass panel surface", async () => {
  const { editor } = renderEditor({ toolbar: "floating" });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  const toolbar = await screen.findByRole("toolbar", { name: "Formatting" });
  // Классы — на узле `BubbleMenu`, обёртке Панели.
  expectSurface(toolbar.closest('[class*="backdrop-blur"]'), GLASS_PANEL_CLASS);
});

test("the selection bubble sits on the glass inverse surface", async () => {
  const { editor } = renderEditor({ toolbar: "bubble" });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  const bubble = await screen.findByRole("toolbar", { name: "Selection formatting" });
  expectSurface(bubble.closest('[class*="backdrop-blur"]'), GLASS_INVERSE_CLASS);
});

test.each([
  ["More formatting", /^More formatting$/],
  ["block type", /^Block type/],
  ["alignment", /^Alignment/],
  ["lists", /^(Lists|List:)/],
  ["insert", /^Insert block$/],
  ["table", /^Table$/],
])("the %s menu of the toolbar opens on the glass menu surface", async (_, name) => {
  renderEditor({ preset: "full" });
  await userEvent.click(screen.getByRole("button", { name }));

  expectSurface(panelOf(await screen.findByRole("menu")), GLASS_MENU_CLASS);
});

test.each([
  ["Link", "Hello", "Formatting"],
  ["Emoji", null, "Formatting"],
  ["Keyboard shortcuts", null, "Formatting"],
  // Поповеры-сетки цвета (OLDSUI-153) — то же стекло поповеров Редактора.
  // «Цвет» — в меню выделения, «Маркер» — на Панели (OLDSUI-154).
  ["Color: Default", "Hello", "Selection formatting"],
  ["Highlight: None", null, "Formatting"],
])("the %s popover opens on the glass panel surface", async (name, selection, toolbar) => {
  const { editor } = renderEditor({ preset: "full" });
  if (selection) {
    act(() => editor.view.focus());
    act(() => void editor.commands.setTextSelection({ from: 1, to: 1 + selection.length }));
  }
  const host = await screen.findByRole("toolbar", { name: toolbar });
  await userEvent.click(within(host).getByRole("button", { name }));

  expectSurface(await screen.findByRole("dialog"), GLASS_PANEL_CLASS);
});

/*
  Поверхности эпика OLDSUI-98 — всплывают над Документом так же, как
  встроенные, и лежат на том же стекле: рамка поповера записи своего
  Инструмента (у кнопки и у каретки) и Карточка у текста.
*/
test("the popover of a custom tool button opens on the glass panel surface", async () => {
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testPickerTool] });
  await userEvent.click(screen.getByRole("button", { name: "Picker" }));

  expectSurface(await screen.findByRole("dialog", { name: "Picker" }), GLASS_PANEL_CLASS);
});

test("the popover of a custom insert item opens at the caret on the glass panel surface", async () => {
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testAskTool] });
  act(() => editor.view.focus());
  await userEvent.click(screen.getByRole("button", { name: /^Insert block$/ }));
  await userEvent.click(
    within(await screen.findByRole("menu")).getByRole("menuitem", { name: /^Ask/ })
  );

  expectSurface(await screen.findByRole("dialog", { name: "Ask" }), GLASS_PANEL_CLASS);
});

test("the text card opens on the glass panel surface", async () => {
  // Карточка — ленивый чанк: `render` в `act` дожидается его.
  const ref = createRef<RichTextEditorHandle>();
  await act(async () => {
    render(
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue='<p>One <span data-mark="test_remark">two three</span> four</p>'
        tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      />
    );
  });
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(8);
  });

  expectSurface(await screen.findByRole("dialog", { name: "Remark" }), GLASS_PANEL_CLASS);
});

test("the same Menu and Popover outside the editor stay solid", async () => {
  render(
    <>
      <MenuTrigger>
        <MenuButton>Actions</MenuButton>
        <Menu>
          <MenuItem>Rename</MenuItem>
        </Menu>
      </MenuTrigger>
      <Popover>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent aria-label="Details">Body</PopoverContent>
      </Popover>
    </>
  );

  await userEvent.click(screen.getByRole("button", { name: "Actions" }));
  const panel = panelOf(await screen.findByRole("menu"));
  expect(panel?.className).toContain("bg-surface-elevated");
  expect(panel?.className).not.toContain("backdrop-blur");

  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Details" }));
  const dialog = await screen.findByRole("dialog", { name: "Details" });
  expect(dialog.className).toContain("bg-bg-1");
  expect(dialog.className).not.toContain("backdrop-blur");
});

test("every glass surface turns solid when transparency is reduced or contrast raised", () => {
  for (const [surface, token] of [
    [GLASS_PANEL_CLASS, "bg-bg-1"],
    [GLASS_MENU_CLASS, "bg-surface-elevated"],
    [GLASS_INVERSE_CLASS, "bg-surface-inverse"],
  ] as const) {
    const classes = surface.split(/\s+/);
    for (const query of ["[@media(prefers-reduced-transparency:reduce)]", "contrast-more"]) {
      expect(classes).toContain(`${query}:${token}`);
      expect(classes).toContain(`${query}:backdrop-blur-none`);
    }
  }
});

/*
  На iOS стекло не держится (OLDSUI-147): в Safari на iOS 27 меню Редактора
  вышли без подложки — пункты легли на текст Документа в полную силу.
  `-webkit-touch-callout` понимает только WebKit на iOS (и Chrome там же —
  это тот же WebKit), поэтому условие ловит ровно его и не трогает десктоп.
*/
test.each([
  ["panel", GLASS_PANEL_CLASS, "bg-bg-1"],
  ["menu", GLASS_MENU_CLASS, "bg-surface-elevated"],
  ["inverse", GLASS_INVERSE_CLASS, "bg-surface-inverse"],
])("on iOS WebKit the %s glass falls back to its solid surface without blur", (_, glass, solid) => {
  const classes = glass.split(/\s+/);
  expect(classes).toContain(`[@supports(-webkit-touch-callout:none)]:${solid}`);
  expect(classes).toContain("[@supports(-webkit-touch-callout:none)]:backdrop-blur-none");
});
