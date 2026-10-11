import { expect, test, type Page } from "@playwright/test";

/**
 * Раскладка Редактора в браузере (OLDSUI-74): то, чего jsdom не умеет, —
 * настоящая сетка с контейнерным запросом, геометрия стрелок и Tab внутри окна
 * Radix со своей ловушкой фокуса.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/**
 * Дать ProseMirror прочитать каретку после щелчка. Выделение из DOM он берёт
 * по `selectionchange`, а это отдельная задача после `mouseup`: клавиша,
 * нажатая сразу за щелчком, видела бы прежнюю каретку. Человек так быстро не
 * нажимает; два кадра — с запасом.
 */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

test("inside a Dialog: two columns stand side by side and Tab walks them", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--layout-in-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();

  const columns = field.locator('[data-block="layout"] > [data-block="column"]');
  await expect(columns).toHaveCount(2);
  const [left, right] = [await columns.nth(0).boundingBox(), await columns.nth(1).boundingBox()];
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  expect(Math.abs(right!.y - left!.y)).toBeLessThan(1);

  await columns.nth(0).getByText("First column.").click();
  await settle(page);
  await page.keyboard.press("Tab");
  await page.keyboard.type("Typed ");
  await expect(columns.nth(1)).toContainText("Typed Right");
  await expect(field).toBeFocused();

  // Из последней колонки Tab уходит дальше по окну, а окно остаётся открытым.
  await page.keyboard.press("Tab");
  await expect(field).not.toBeFocused();
  await expect(dialog).toBeVisible();
});

test("arrows cross the columns and leave the layout below", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--layouts"));
  const field = page.getByRole("textbox", { name: "Document" });
  const goals = field.getByText("Ship the new search", { exact: false });
  await goals.click();
  await page.keyboard.press("End");
  await settle(page);

  // Из конца левой колонки `→` — в начало правой.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("x");
  await expect(field.getByRole("heading", { name: "xRisks" })).toBeVisible();

  // Из нижней строки колонки `↓` — к Блоку под Раскладкой, а не в соседнюю колонку.
  await field.getByText("The index rebuild", { exact: false }).click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("~");
  await expect(field.getByRole("heading", { name: "~Plan" })).toBeVisible();
});

test("on a phone the columns stack in reading order", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(STORY("content-richtextview--layout-narrow"));
  const columns = page.locator('[data-layout="50-50"] > [data-block="column"]');
  const [left, right] = [await columns.nth(0).boundingBox(), await columns.nth(1).boundingBox()];
  expect(right!.y).toBeGreaterThan(left!.y + left!.height);
  expect(Math.abs(right!.x - left!.x)).toBeLessThan(1);
});
