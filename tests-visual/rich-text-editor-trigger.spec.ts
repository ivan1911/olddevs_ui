import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Свой символ-триггер в браузере (ADR-0064, OLDSUI-193): набор `@` настоящими
 * клавишами открывает список у каретки, выбор заменяет `@запрос` атомом, внутри
 * слова список молчит. Правила открытия, запрос, асинхронные пункты и ошибки
 * набора проверены в `tests/rich-text-editor-trigger.test.tsx`; здесь — то, чего
 * jsdom не умеет: положение у каретки, настоящий ввод и фокус, щелчок мышью и
 * axe открытого списка.
 */

const STORY = (id = "mention-trigger-idle", theme = "dark") =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:${theme};accent:blue`;

/** Последний (пустой) абзац: `@` в начале Блока открывает список. */
async function lastParagraph(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  const paragraph = field.locator("p").last();
  await paragraph.click();
  return { field, paragraph };
}

test("typing @ opens the list under the typed character, and focus stays in the field", async ({
  page,
}) => {
  await page.goto(STORY("mention-trigger-filtered"));
  const field = page.getByRole("textbox", { name: "Document" });
  const listbox = page.getByRole("listbox", { name: "People" });

  await expect(listbox).toBeVisible();
  await expect(field).toBeFocused();
  await expect(listbox.getByRole("option")).toHaveText(["Grace Hopper"]);

  // Список стоит под набранным `@запрос`: левый край — у символа, верх — ниже него.
  const typed = (await field.locator(".suggestion").boundingBox())!;
  const panel = (await listbox.boundingBox())!;
  expect(Math.abs(panel.x - typed.x)).toBeLessThan(24);
  expect(panel.y).toBeGreaterThanOrEqual(typed.y + typed.height - 1);
});

test("the real keys: the query filters, arrows move, Enter replaces @query with the atom", async ({
  page,
}) => {
  await page.goto(STORY());
  const { field, paragraph } = await lastParagraph(page);
  const listbox = page.getByRole("listbox", { name: "People" });

  // Фильтр истории ищет подстроку: «ce» оставляет ровно двоих — Lovelace и Grace.
  await page.keyboard.type("@ce");
  await expect(listbox.getByRole("option")).toHaveText(["Ada Lovelace", "Grace Hopper"]);
  const first = await field.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  await expect(field).not.toHaveAttribute("aria-activedescendant", first!);

  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
  // Атом в поле — нередактируемый узел: в Редакторе его рисует узел-представление, а не HTML Документа.
  await expect(
    paragraph.locator('[contenteditable="false"]', { hasText: "@Grace Hopper" })
  ).toHaveCount(1);
  await expect(paragraph).toContainText("@Grace Hopper");
  await expect(paragraph).not.toContainText("@ce");
  await expect(field).toBeFocused();
});

test("a click on a row picks it with the mouse; the caret stays after the atom", async ({
  page,
}) => {
  await page.goto(STORY());
  const { field, paragraph } = await lastParagraph(page);

  await page.keyboard.type("@");
  await page.getByRole("option", { name: "Margaret Hamilton" }).click();

  await expect(paragraph).toContainText("@Margaret Hamilton");
  await expect(field).toBeFocused();
  // Печать продолжается сразу за упоминанием.
  await page.keyboard.type("hello");
  await expect(paragraph).toContainText("@Margaret Hamilton hello");
});

test("an at sign inside a word does not open the list; after a space it does", async ({ page }) => {
  await page.goto(STORY());
  const { paragraph } = await lastParagraph(page);
  const listbox = page.getByRole("listbox", { name: "People" });

  await page.keyboard.type("write to a@b");
  await expect(listbox).toBeHidden();
  await expect(paragraph).toHaveText("write to a@b");

  await page.keyboard.type(" @");
  await expect(listbox).toBeVisible();
});

test("Escape closes the list and keeps the typed text; the same @ does not reopen it", async ({
  page,
}) => {
  await page.goto(STORY());
  const { field, paragraph } = await lastParagraph(page);
  const listbox = page.getByRole("listbox", { name: "People" });

  await page.keyboard.type("@gr");
  await expect(listbox).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(paragraph).toHaveText("@gr");
  await expect(field).toBeFocused();
});

test("nothing found shows the disabled row", async ({ page }) => {
  await page.goto(STORY("mention-trigger-nothing-found"));
  const listbox = page.getByRole("listbox", { name: "People" });

  await expect(listbox.getByRole("option")).toHaveText(["Nothing found"]);
  await expect(listbox.getByRole("option")).toHaveAttribute("aria-disabled", "true");
});

for (const theme of ["dark", "light", "dim"] as const) {
  test(`the open list and the field pass axe — theme ${theme}`, async ({ page }) => {
    await page.goto(STORY("mention-trigger", theme));
    // Входная анимация начинается с прозрачности: axe посчитал бы по ней контраст.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; transition: none !important; }",
    });
    await expect(page.getByRole("listbox", { name: "People" })).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include("#storybook-root")
      .include('[role="listbox"]')
      .analyze();
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    ).toEqual([]);
  });
}
