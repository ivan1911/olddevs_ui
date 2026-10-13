import { expect, test, type Page } from "@playwright/test";

/**
 * Подменю `Menu` раскрывается сбоку от своего пункта (OLDSUI-254).
 *
 * `SubmenuTrigger` из react-aria отдаёт вложенному поповеру место «справа
 * сверху» (`end top`), но `Menu` кита раньше всегда передавал свой
 * `placement="bottom start"`, и явный проп перебивал контекст: подменю
 * раскрывалось ПОД пунктом. Положение — это геометрия, jsdom её не считает,
 * поэтому проверка здесь, прямоугольниками настоящего браузера.
 */

const STORY =
  "/iframe.html?id=overlays-menu--sections-and-submenus&globals=theme:light;accent:blue";

/** Допуск на тень, рамку и внутренний отступ панели. */
const TOLERANCE = 4;

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: ReturnType<Page["locator"]>): Promise<Box> {
  const result = await locator.boundingBox();
  if (!result) throw new Error("the element has no bounding box");
  return result;
}

/** Открывает корневое меню и подменю «Move to…», возвращает прямоугольники пункта и подменю. */
async function openSubmenu(page: Page): Promise<{ item: Box; submenu: Box }> {
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("menu").first()).toBeVisible();

  const item = page.getByRole("menuitem", { name: "Move to…" });
  await item.click();
  const submenu = page.locator('[data-trigger="SubmenuTrigger"]');
  await expect(submenu).toBeVisible();
  // Позицию react-aria выставляет после измерения: ждём, пока поповер встанет.
  await expect(submenu).toHaveAttribute("data-placement", /.+/);

  return { item: await box(item), submenu: await box(submenu) };
}

test("on a desktop screen a submenu opens to the right of its item, aligned with its top", async ({
  page,
}) => {
  await page.goto(STORY);
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.x).toBeGreaterThanOrEqual(item.x + item.width - TOLERANCE);
  // Верх подменю у верха пункта, а не под ним: допуск — отступ панели и рамка.
  expect(Math.abs(submenu.y - item.y)).toBeLessThanOrEqual(16);
  expect(submenu.y).toBeLessThan(item.y + item.height);
});

test("near the right edge of the screen a submenu flips to the left of its item", async ({
  page,
}) => {
  await page.goto(STORY);
  // Кнопка прижата к правому краю: справа от корневого меню места для подменю нет.
  await page.getByRole("button", { name: "View" }).evaluate((node) => {
    node.style.position = "fixed";
    node.style.top = "80px";
    node.style.right = "8px";
  });
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.x + submenu.width).toBeLessThanOrEqual(item.x + TOLERANCE);
  expect(Math.abs(submenu.y - item.y)).toBeLessThanOrEqual(16);
});

test("on a phone width a submenu opens below its item, on top of the parent menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(STORY);
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.y).toBeGreaterThanOrEqual(item.y + item.height - TOLERANCE);
  // По поперечной оси react-aria держит подменю внутри экрана.
  expect(submenu.x).toBeGreaterThanOrEqual(0);
  expect(submenu.x + submenu.width).toBeLessThanOrEqual(375);
});
