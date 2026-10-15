import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Невидимые символы (OLDSUI-278) в браузере: то, чего jsdom не умеет, — знаки
 * из `::before` с нулевой шириной, которые не сдвигают текст, не выделяются и не
 * ловят мышь, и неизменность сохранённого HTML при показе.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/** Сколько знаков каждого вида нарисовано в Документе. */
async function marks(field: Locator) {
  const count = (kind: string) => field.locator(`.tiptap-invisible-character--${kind}`).count();
  return {
    space: await count("space"),
    break: await count("break"),
    paragraph: await count("paragraph"),
  };
}

/** Меню «…» фиксированной Панели: пункт «Невидимые символы» живёт в нём, кнопки нет. */
const openMore = async (page: Page) => {
  await page.getByRole("button", { name: "More formatting" }).click();
  return page.getByRole("menu", { name: "More formatting" });
};
const itemOf = (menu: Locator) =>
  menu.getByRole("menuitemcheckbox", { name: "Invisible characters" });

/** Переключить показ пунктом «…»: меню закрывается выбором. */
async function toggle(page: Page) {
  await itemOf(await openMore(page)).click();
  await expect(page.getByRole("menu", { name: "More formatting" })).toBeHidden();
}

/** Отмечен ли пункт: открыть «…», прочитать, закрыть Escape. */
async function checked(page: Page) {
  const menu = await openMore(page);
  const value = await itemOf(menu).getAttribute("aria-checked");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  return value;
}

/** Текст знака из `::before` и то, как он устроен: ширина, выделение, мышь. */
function look(mark: Locator) {
  return mark.evaluate((element) => {
    const css = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      content: before.content,
      beforeWidth: before.width,
      display: before.display,
      userSelect: css.userSelect,
      pointerEvents: css.pointerEvents,
    };
  });
}

test("the «…» menu item turns spaces, hard breaks and paragraph ends visible", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });

  await expect(field).toContainText("Spaces sit between these words");
  expect(await checked(page)).toBe("false");
  expect(await marks(field)).toEqual({ space: 0, break: 0, paragraph: 0 });

  await toggle(page);
  expect(await checked(page)).toBe("true");
  const shown = await marks(field);
  // Три абзаца (в том числе пустой) — три знака; у заголовка своего знака нет; один
  // мягкий перенос; пробелов в тексте много.
  expect(shown.paragraph).toBe(3);
  expect(shown.break).toBe(1);
  expect(shown.space).toBeGreaterThan(15);

  // Знак — `·`, `↵`, `¶`: нулевая ширина, мышь и выделение его не видят.
  expect(await look(field.locator(".tiptap-invisible-character--space").first())).toEqual({
    content: '"·"',
    beforeWidth: "0px",
    display: "inline-block",
    userSelect: "none",
    pointerEvents: "none",
  });
  expect((await look(field.locator(".tiptap-invisible-character--break"))).content).toBe('"↵"');
  expect(
    (await look(field.locator(".tiptap-invisible-character--paragraph").first())).content
  ).toBe('"¶"');

  await toggle(page);
  expect(await checked(page)).toBe("false");
  expect(await marks(field)).toEqual({ space: 0, break: 0, paragraph: 0 });
});

test("the fixed toolbar of the full preset stays one row in a 640 px column", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(page.getByRole("button", { name: "Invisible characters" })).toHaveCount(0);

  // Одна строка кнопок — около 30 px; с лишней кнопкой Панель переносилась и вырастала до 62.
  const height = await toolbar.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(40);
});

test("showing the marks does not move the text", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field).toContainText("Spaces sit between these words");

  const layout = () =>
    field.evaluate((element) => ({
      size: [element.getBoundingClientRect().width, element.getBoundingClientRect().height],
      blocks: Array.from(element.children, (child) => {
        const box = child.getBoundingClientRect();
        return [box.top, box.height, box.width];
      }),
    }));
  const before = await layout();
  await toggle(page);
  expect(await checked(page)).toBe("true");
  expect(await layout()).toEqual(before);
});

test("with the option visible the marks are there from the start, and the item is checked", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters-shown"));
  const field = page.getByRole("textbox", { name: "Document" });

  expect(await checked(page)).toBe("true");
  await expect(field.locator(".tiptap-invisible-character--paragraph")).toHaveCount(3);
  await expect(field.locator(".tiptap-invisible-character--break")).toHaveCount(1);
});

test("the marks follow the typing; the extra space shows up as a second dot", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters-shown"));
  const field = page.getByRole("textbox", { name: "Document" });
  const last = field.locator(":scope > p").last();
  await expect(last).toContainText("Type a second space");

  const spaces = () => last.locator(".tiptap-invisible-character--space").count();
  const before = await spaces();
  await last.click();
  await page.keyboard.press("End");
  await page.keyboard.type("  ");
  await expect.poll(spaces).toBe(before + 2);
});

test("the paragraph mark of the empty field gives way to the placeholder", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters-shown"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field).toContainText("Type a second space");

  await field.click();
  // Первое `Mod+A` выделяет Блок под кареткой, второе — весь Документ.
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await expect(field.locator("p.is-editor-empty")).toHaveCount(1);
  await expect(
    field.locator("p.is-editor-empty > .tiptap-invisible-character--paragraph")
  ).toBeHidden();
});

test("an external toggle drives the same state, and the saved HTML and onChange stay untouched", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters-external-toggle"));
  const field = page.getByRole("textbox", { name: "Document" });
  const external = page.getByRole("button", { name: /invisible characters$/ });
  const saved = page.getByLabel("Saved HTML");
  const changes = page.getByLabel("Change count");

  await expect(external).toHaveText("Show invisible characters");
  await expect(external).not.toHaveAttribute("aria-pressed", "true");
  await expect(saved).toContainText("<h2>Invisible characters</h2>");
  const html = await saved.textContent();
  expect(html).not.toContain("tiptap-invisible-character");

  await external.click();
  await expect(external).toHaveText("Hide invisible characters");
  await expect(external).toHaveAttribute("aria-pressed", "true");
  // Пункт «…» в том же Редакторе отмечен вместе с внешней кнопкой: состояние одно.
  expect(await checked(page)).toBe("true");
  await expect(field.locator(".tiptap-invisible-character--paragraph")).toHaveCount(3);
  await expect(saved).toHaveText(html!);
  await expect(changes).toHaveText("0");

  await external.click();
  await expect(field.locator(".tiptap-invisible-character")).toHaveCount(0);
  await expect(saved).toHaveText(html!);
  await expect(changes).toHaveText("0");
});

test("from the keyboard: «…» opens with Enter, the item is the last one, Space and Enter toggle it", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field).toContainText("Spaces sit between these words");

  const more = page.getByRole("button", { name: "More formatting" });
  const item = page.getByRole("menuitemcheckbox", { name: "Invisible characters" });
  await more.focus();
  await page.keyboard.press("Enter");
  // `↑` из начала списка уходит в конец: последний пункт — «Невидимые символы».
  await page.keyboard.press("ArrowUp");
  await expect(item).toBeFocused();

  await page.keyboard.press("Space");
  await expect(item).toBeHidden();
  await expect(field.locator(".tiptap-invisible-character--paragraph").first()).toBeAttached();

  await more.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await expect(item).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Enter");
  await expect(field.locator(".tiptap-invisible-character")).toHaveCount(0);
});
