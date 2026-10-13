import { expect, test, type Page } from "@playwright/test";

/**
 * Прицел мегаменю настоящей мышью (OLDSUI-256).
 *
 * jsdom геометрии не знает, и Прицел там проверяется на подменённых
 * прямоугольниках. Здесь — настоящая раскладка истории и настоящий указатель:
 * курсор идёт к Полке наискосок через соседнюю Категорию, затем — прямо вниз
 * по Столбцу.
 *
 * Шаги — по одному на кадр с паузой: `mouse.move` со `steps` шлёт события
 * подряд без пауз, и Прицел, прореженный до кадра, видел бы из них один шаг.
 */

const STORY = "/iframe.html?id=navigation-megamenu--catalog&globals=theme:light;accent:blue";

async function glide(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps
    );
    await page.waitForTimeout(20);
  }
}

async function center(page: Page, name: string) {
  const box = await page.getByRole("button", { name }).boundingBox();
  if (!box) throw new Error(`no box for ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("cutting diagonally across a neighbor to the showcase keeps the showcase", async ({
  page,
}) => {
  await page.goto(STORY);
  const start = await center(page, "Computers");
  await page.mouse.move(start.x, start.y);
  await expect(page.getByRole("button", { name: "Computers" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );

  const showcase = await page.getByRole("region", { name: "Computers" }).boundingBox();
  if (!showcase) throw new Error("the showcase has no box");
  const phones = await page.getByRole("button", { name: "Phones" }).boundingBox();
  if (!phones) throw new Error("no box for Phones");
  // Цель — точка в Полке, путь к которой пересекает край Столбца на высоте
  // строки «Phones»: курсор её заденет.
  const target = { x: showcase.x + 120, y: phones.y + phones.height / 2 + 60 };
  await glide(page, start, target);

  await expect(page.getByRole("button", { name: "Computers" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.getByRole("button", { name: "Phones" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(page.getByRole("link", { name: "Laptops" })).toBeVisible();
});

test("moving straight down the column switches categories without waiting", async ({ page }) => {
  await page.goto(STORY);
  const start = await center(page, "Computers");
  await page.mouse.move(start.x, start.y);
  const books = await center(page, "Books");
  await glide(page, start, books);

  // Сразу, без ожидания остановки: путь вниз — не к Полке, Прицел не включался.
  expect(await page.getByRole("button", { name: "Books" }).getAttribute("aria-expanded")).toBe(
    "true"
  );
});

/*
  Выпадающий вид у правого края окна (OLDSUI-257): Полка переходит на другую
  сторону Столбца и остаётся в окне. Сторона меряется при открытии Категории, а
  не на монтировании: в этот момент Radix ещё не расставил оверлей.
*/
test("in the dropdown near the right edge the showcase flips and stays in the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    "/iframe.html?id=navigation-megamenu--dropdown-in-top-bar&globals=theme:light;accent:blue"
  );
  const button = page.getByRole("button", { name: "Catalog" });
  // Кнопка — к правому краю окна, как в шапке с каталогом справа.
  await button.evaluate((node) => {
    Object.assign((node as HTMLElement).style, { position: "fixed", right: "8px", top: "8px" });
  });
  await button.click();
  await page.getByRole("button", { name: "Computers" }).hover();

  const showcase = await page.getByRole("region", { name: "Computers" }).boundingBox();
  const column = await page.getByRole("button", { name: "Computers" }).boundingBox();
  if (!showcase || !column) throw new Error("no boxes");
  expect(showcase.x).toBeGreaterThanOrEqual(0);
  expect(showcase.x + showcase.width).toBeLessThanOrEqual(1280);
  expect(showcase.x + showcase.width).toBeLessThanOrEqual(column.x + 4);
});

/*
  Выпадающий вид на ширине телефона (OLDSUI-262). Обёртка Radix меряет оверлей
  по содержимому, и без явной ширины каталог сжимался до самой длинной подписи,
  менял ширину при спуске в Категорию, а подпись без пробелов выталкивала его
  за край окна. Теперь оверлей — во всю ширину окна без отступов по краям.
*/
test("on a phone the dropdown spans the viewport and keeps its width when drilling down", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    "/iframe.html?id=navigation-megamenu--dropdown-in-top-bar&globals=theme:light;accent:blue"
  );
  await page.getByRole("button", { name: "Catalog" }).click();
  const nav = page.getByRole("navigation", { name: "Catalog" });

  // Длинная подпись без пробелов: прежде она выталкивала оверлей за край.
  await page
    .getByRole("button", { name: "Health" })
    .locator("[data-mega-label]")
    .evaluate((node) => {
      node.textContent = "Supercalifragilisticexpialidocious-health-and-personal-care";
    });

  const column = await nav.boundingBox();
  if (!column) throw new Error("no box for the column");
  expect(column.x).toBeGreaterThanOrEqual(8 - 1);
  expect(column.x + column.width).toBeLessThanOrEqual(375 - 8 + 1);
  expect(column.width).toBeGreaterThan(375 - 16 - 2);

  await page.getByRole("button", { name: "Computers" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  const drilled = await nav.boundingBox();
  if (!drilled) throw new Error("no box for the drilled view");
  expect(drilled.width).toBeCloseTo(column.width, 0);
  expect(drilled.x).toBeCloseTo(column.x, 0);
});
