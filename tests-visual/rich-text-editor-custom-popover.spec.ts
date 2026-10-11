import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Поповер пункта вставки и Действия над Блоком в браузере (история 39,
 * ADR-0058, п. 5.6): то, чего jsdom не умеет, — положение у каретки (там, где
 * стоял «/») и у Блока Ручки. Открытие из каждого места, Escape, возврат фокуса
 * и ошибки набора проверены в `tests/rich-text-editor-custom-popover.test.tsx`;
 * поповер уходит в портал, поэтому axe открытого поповера — здесь же.
 */

const STORY = (theme = "dark") =>
  `/iframe.html?id=inputs-richtexteditor--custom-entry-popovers&globals=theme:${theme};accent:blue`;

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

/** Поповер вплотную к якорю по вертикали. */
function expectNextTo(popover: Box, anchor: Box) {
  const below = popover.y - (anchor.y + anchor.height);
  const above = anchor.y - (popover.y + popover.height);
  expect(Math.min(Math.abs(below), Math.abs(above))).toBeLessThan(16);
}

const SLASH_TEXT = "Type / and pick Symbol";
const BLOCK_TEXT = "Append symbol in the block menu";

/** Поповер у «/»: набрать « /sym» в конце абзаца и выбрать пункт. Каретка — где стоял «/». */
async function openFromSlash(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText(SLASH_TEXT).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  const caret = await caretBox(page);
  await page.keyboard.type("/sym");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  return { field, caret, popover };
}

/** Поповер Действия у Блока: каретка в абзаце, меню Ручки, «Append symbol». */
async function openFromHandle(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  const paragraph = field.locator("p", { hasText: BLOCK_TEXT });
  await paragraph.click({ position: { x: 40, y: 8 } });
  await page.getByRole("button", { name: "Block actions" }).click();
  await page.getByRole("menuitem", { name: "Append symbol" }).click();
  const popover = page.getByRole("dialog", { name: "Append symbol" });
  await expect(popover).toBeVisible();
  return { field, paragraph, popover };
}

test("the popover of an item picked in / stands where the slash was; Escape returns the caret", async ({
  page,
}) => {
  await page.goto(STORY());
  const { field, caret, popover } = await openFromSlash(page);

  const box = await boxOf(popover);
  expectNextTo(box, caret);
  // Левый край поповера — у каретки (`align="start"`), а не у начала строки или кнопки.
  expect(Math.abs(box.x - caret.x)).toBeLessThan(24);
  // Набранная «/команда» убрана, как у обычного пункта.
  await expect(field).not.toContainText("/sym");

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
  expect(Math.abs((await caretBox(page)).x - caret.x)).toBeLessThan(2);
});

test("the popover of a block action stands at the block of the handle", async ({ page }) => {
  await page.goto(STORY());
  const { field, paragraph, popover } = await openFromHandle(page);

  const box = await boxOf(popover);
  const block = await boxOf(paragraph);
  expectNextTo(box, block);
  expect(Math.abs(box.x - block.x)).toBeLessThan(24);

  await popover.getByRole("button", { name: "★" }).click();
  await expect(popover).toBeHidden();
  await expect(paragraph).toHaveText(/★$/);
  await expect(field).toBeFocused();
});

test("from + and Add of the handle the popover stays open at the caret: the closing menu does not take the focus back", async ({
  page,
}) => {
  await page.goto(STORY());
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText(SLASH_TEXT).click();
  const caret = await caretBox(page);
  const popover = page.getByRole("dialog", { name: "Symbol" });

  await page.getByRole("button", { name: "Insert block" }).click();
  await page.getByRole("menuitem", { name: "Symbol" }).click();
  await expect(popover).toBeVisible();
  // Меню снимается и возвращает фокус своему триггеру — поповер при этом не закрывается.
  await page.waitForTimeout(300);
  await expect(popover).toBeVisible();
  expectNextTo(await boxOf(popover), caret);
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();

  await page.getByRole("button", { name: "Block actions" }).click();
  await page.getByRole("menuitem", { name: "Add" }).click();
  await page.getByRole("menu", { name: "Add" }).getByRole("menuitem", { name: "Symbol" }).click();
  await expect(popover).toBeVisible();
  await page.waitForTimeout(300);
  await expect(popover).toBeVisible();
  expectNextTo(await boxOf(popover), caret);
});

for (const theme of ["dark", "light", "dim"] as const) {
  test(`the open popovers and the field pass axe — theme ${theme}`, async ({ page }) => {
    await page.goto(STORY(theme));
    // Входная анимация начинается с прозрачности: axe посчитал бы по ней контраст.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; transition: none !important; }",
    });
    const audit = async () => {
      const { violations } = await new AxeBuilder({ page })
        .include("#storybook-root")
        .include('[role="dialog"]')
        .analyze();
      return violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    };

    await openFromSlash(page);
    expect(await audit()).toEqual([]);
    await page.keyboard.press("Escape");

    await openFromHandle(page);
    expect(await audit()).toEqual([]);
  });
}
