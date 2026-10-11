import { expect, test } from "@playwright/test";
import { focusToolbarButton } from "./editor-toolbar.js";

/**
 * Меню «Таблица» Редактора в браузере (OLDSUI-45): то, чего jsdom не умеет.
 *
 * Меню react-aria внутри окна Radix в jsdom не раскрывается — ловушка фокуса
 * окна возвращает фокус (`tests/rich-text-editor-toolbar.test.tsx`), поэтому
 * стек слоёв ADR-0041 с настоящим `Dialog` проверяется здесь: подменю, сетка
 * размера и Escape слой за слоем.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("inside a Dialog: the keyboard reaches the size grid, picks a size, and focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // Имя обязательно: подменю react-aria — тоже `role="dialog"` («Table»).
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.click();
  // Указатель — прочь с поля: сетка следует за наведением, а подменю может
  // встать прямо под ним (так вышло, когда «…» укоротило ряд Панели, OLDSUI-65).
  await page.mouse.move(0, 0);

  // Alt+F10 — в Панель, стрелками до «Таблица ▾».
  await expect(await focusToolbarButton(page, "Table")).toBeFocused();

  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Table" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();

  // → открывает подменю с сеткой; фокус приходит в сетку, когда подменю встало,
  // и меню под ней при этом не закрывается.
  await page.keyboard.press("ArrowRight");
  const grid = page.getByRole("grid", { name: "Table size" });
  await expect(grid).toBeFocused();
  await expect(menu).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status").filter({ hasText: "columns" })).toHaveText(
    "4 columns, 4 rows"
  );
  await page.keyboard.press("Enter");

  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field.locator("tr")).toHaveCount(4);
  await expect(field.locator("tr").first().locator("th")).toHaveCount(4);
  await expect(field).toBeFocused();
});

/*
  Фокус в сетку ждёт сигнала поповера (место посчитано, анимация входа
  доиграна), а не таймера. Проверка — с включённой анимацией и процессором,
  замедленным вшестеро: на таком устройстве прежние 50 мс были гонкой.
*/
test.describe("with motion and a slow CPU", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("inside a Dialog: → still lands in the size grid and keeps the menu open", async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.goto(STORY("inside-dialog"));
    const field = page.getByRole("textbox", { name: "Document" });
    await field.click();
    // Указатель — прочь с поля: сетка следует за наведением, а подменю может
    // встать прямо под ним (так вышло, когда «…» укоротило ряд Панели, OLDSUI-65).
    await page.mouse.move(0, 0);

    await page.getByRole("button", { name: "Table", exact: true }).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Table" });
    await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();
    await expect(menu).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(field.locator("tr")).toHaveCount(3);
    await expect(field).toBeFocused();
  });
});

test("inside a Dialog: Escape closes the grid, then the menu, then the window — one layer at a time", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // Имя обязательно: подменю react-aria — тоже `role="dialog"` («Table»).
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await page.getByRole("textbox", { name: "Document" }).click();

  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("grid")).toBeHidden();
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(dialog).toBeVisible();

  // Фокус вернулся на «Таблица ▾», и у кнопки, пришедшей с клавиатуры,
  // открылась подсказка — тоже слой (ADR-0041): Escape снимает сначала её.
  await expect(page.getByRole("button", { name: "Table", exact: true })).toBeFocused();
  const tooltip = page.getByRole("tooltip", { name: "Table" });
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("inside a Dialog: → and ← walk the Row submenu, Escape closes only the submenu", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // Имя обязательно: подменю react-aria — тоже `role="dialog"` («Table»).
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();
  // Курсор мыши — прочь с поля: путь клавиатурный, а меню «Таблица» после
  // перекладки Панели (OLDSUI-64) раскрывается прямо под точкой щелчка, и
  // наведение открыло бы соседнее подменю, как только `←` закроет «Строку».
  await page.mouse.move(0, 0);

  // Сначала таблица — с клавиатуры, через сетку: пункты меню кита внутри
  // `Dialog` здесь мышью не трогаем (щелчок по ним в окне — отдельная задача
  // кита), сетку 3×3 берём как есть.
  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field.locator("tr")).toHaveCount(3);
  await expect(field).toBeFocused();

  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Row" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const row = page.getByRole("menu", { name: "Row" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Insert row above" })).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(row).toBeHidden();
  await expect(page.getByRole("menuitem", { name: "Row" })).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(row).toBeHidden();
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(field.locator("tr")).toHaveCount(4);
  await expect(field).toBeFocused();
});

test("Insert table… opens a window over the Dialog; Enter inserts, focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  // «Вставить таблицу…» — второй пункт; с клавиатуры, не мышью (см. выше).
  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Insert table…" })).toBeFocused();
  await page.keyboard.press("Enter");
  const insert = page.getByRole("dialog", { name: "Insert table" });
  await expect(insert).toBeVisible();
  const columns = insert.getByRole("textbox", { name: "Columns" });
  await expect(columns).toBeFocused();

  await columns.fill("12");
  await insert.getByRole("textbox", { name: "Rows" }).fill("30");
  await page.keyboard.press("Enter");

  await expect(insert).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Edit the note" })).toBeVisible();
  await expect(field.locator("tr")).toHaveCount(30);
  await expect(field.locator("tr").first().locator("th")).toHaveCount(12);
  await expect(field).toBeFocused();
});
