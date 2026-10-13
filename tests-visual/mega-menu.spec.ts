import { expect, test, type Page } from "@playwright/test";

/**
 * Прицел мегаменю настоящей мышью (OLDSUI-256).
 *
 * jsdom геометрии не знает, и Прицел там проверяется на подменённых
 * прямоугольниках. Здесь — настоящая раскладка истории и настоящий указатель:
 * курсор идёт к Витрине наискосок через соседнюю Категорию, затем — прямо вниз
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
  // Цель — точка в Витрине, путь к которой пересекает край Столбца на высоте
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

  // Сразу, без ожидания остановки: путь вниз — не к Витрине, Прицел не включался.
  expect(await page.getByRole("button", { name: "Books" }).getAttribute("aria-expanded")).toBe(
    "true"
  );
});
