// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RICH_TEXT_PRESETS, RichTextEditor } from "../src/editor/index.js";
import { MENU_ITEM_SHORTCUT_CLASS, MENU_PANEL_CLASS } from "../src/lib/menu.js";
import { TOUCH_HIDDEN_CLASS } from "../src/lib/touch.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/*
  Меню на телефоне (OLDSUI-147, OLDSUI-148). jsdom медиазапросы и `@supports`
  не считает, поэтому проверяется класс: что он делает на устройстве, видно
  только на устройстве.
*/

test("on iOS WebKit the menu panel overrides the max-height react-aria computes", () => {
  // react-aria на iOS 27 посчитал панели высоту около нуля: рамка схлопнулась
  // в полоску, пункты оказались спрятаны внутри неё.
  expect(MENU_PANEL_CLASS.split(/\s+/)).toContain(
    "[@supports(-webkit-touch-callout:none)]:max-h-[min(24rem,60dvh)]!"
  );
});

test("on a touch screen menu items hide their keyboard shortcuts", () => {
  expect(TOUCH_HIDDEN_CLASS).toBe("[@media(hover:none)_and_(pointer:coarse)]:hidden");
  expect(MENU_ITEM_SHORTCUT_CLASS.split(/\s+/)).toContain(TOUCH_HIDDEN_CLASS);
});

test("on a touch screen the toolbar hides the keyboard shortcuts button", () => {
  render(<RichTextEditor aria-label="Body" tools={RICH_TEXT_PRESETS.full} />);
  const button = screen.getByRole("button", { name: "Keyboard shortcuts" });
  expect(button.className.split(/\s+/)).toContain(TOUCH_HIDDEN_CLASS);
});
