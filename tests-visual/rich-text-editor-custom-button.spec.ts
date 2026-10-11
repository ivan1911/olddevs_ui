import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Поповер кнопки своего Инструмента в браузере (OLDSUI-105): то, чего jsdom не
 * умеет, — положение у кнопки и у каретки. Роли, имена, `aria-*`, сочетания и
 * справочник проверены в `tests/rich-text-editor-custom-button.test.tsx`.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element has no box");
  return box as Box;
}

/** Каретка Документа — прямоугольник выделения в координатах окна. */
async function caretBox(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const range = window.getSelection()!.getRangeAt(0).cloneRange();
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/** Поповер стоит вплотную к якорю: рядом по вертикали и якорь — в пределах его ширины. */
function expectAnchoredAt(popover: Box, anchor: Box) {
  const below = popover.y - (anchor.y + anchor.height);
  const above = anchor.y - (popover.y + popover.height);
  expect(Math.min(Math.abs(below), Math.abs(above))).toBeLessThan(40);
  expect(anchor.x).toBeGreaterThanOrEqual(popover.x - 8);
  expect(anchor.x).toBeLessThanOrEqual(popover.x + popover.width + 8);
}

test("a click opens the popover at the button; Escape returns the caret to the text", async ({
  page,
}) => {
  await page.goto(STORY("custom-tool-buttons"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();
  await page.keyboard.press("End");
  const button = page.getByRole("button", { name: "Symbol", exact: true });

  await button.click();
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  expectAnchoredAt(await boxOf(popover), await boxOf(button));

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
});

test("the shortcut opens the popover at the caret, not at the button", async ({ page }) => {
  await page.goto(STORY("custom-tool-buttons"));
  const field = page.getByRole("textbox", { name: "Document" });
  // Каретка — в середине второго абзаца: далеко от кнопки Панели.
  await field.getByText("The Stamp, Pin and Symbol").click({ position: { x: 120, y: 8 } });
  const caret = await caretBox(page);

  await page.keyboard.press("ControlOrMeta+Shift+J");
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  const box = await boxOf(popover);
  expectAnchoredAt(box, caret);
  expect(box.y).toBeGreaterThan((await boxOf(page.getByRole("toolbar", { name: "Formatting" }))).y);

  await popover.getByRole("button", { name: "★" }).click();
  await expect(popover).toBeHidden();
  await expect(field).toContainText("★");
  await expect(field).toBeFocused();
});

test("the tooltip of an own button names its shortcut", async ({ page }) => {
  await page.goto(STORY("custom-tool-buttons"));
  const button = page.getByRole("button", { name: "Stamp", exact: true });

  await button.hover();
  await expect(page.getByRole("tooltip")).toContainText(/Ctrl\+Shift\+Y|⌘\+⇧\+Y/);
});
