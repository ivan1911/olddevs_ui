import { expect, test } from "@playwright/test";

/**
 * Сетка эмодзи Редактора в браузере (OLDSUI-68): то, чего jsdom не умеет —
 * настоящие `pointer-events` окна Radix и стек слоёв Escape (ADR-0041).
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("inside a Dialog: a mouse click picks an emoji and focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.click();
  await page.keyboard.press("End");

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeVisible();
  await expect(grid).toBeFocused();

  await grid.getByRole("gridcell", { name: "Fire" }).first().click();

  await expect(grid).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toContainText("🔥");
  await expect(field).toBeFocused();
});

test("inside a Dialog: Escape closes the grid first, then the window", async ({ page }) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(grid).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toBeFocused();
});

test("the keyboard walks the grid and Enter inserts at the caret", async ({ page }) => {
  await page.goto(STORY("playground"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(grid).toBeHidden();
  // Вторая ячейка и строка ниже — «Fire».
  await expect(field).toContainText("🔥");
  await expect(field).toBeFocused();
});

test("on the floating toolbar the grid opens and inserts after the selection", async ({ page }) => {
  await page.goto(STORY("floating-toolbar"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
  await expect(toolbar).toBeVisible();

  await toolbar.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeVisible();
  await expect(grid).toBeFocused();
  await grid.getByRole("gridcell", { name: "Fire" }).first().click();

  await expect(grid).toBeHidden();
  await expect(field).toContainText("🔥");
});
