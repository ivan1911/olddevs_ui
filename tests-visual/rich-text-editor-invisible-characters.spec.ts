import { expect, test, type Locator } from "@playwright/test";

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

test("the toolbar button turns spaces, hard breaks and paragraph ends visible", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });
  const button = page.getByRole("button", { name: "Invisible characters" });

  await expect(field).toContainText("Spaces sit between these words");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await marks(field)).toEqual({ space: 0, break: 0, paragraph: 0 });

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
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

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await marks(field)).toEqual({ space: 0, break: 0, paragraph: 0 });
});

test("showing the marks does not move the text", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });
  const button = page.getByRole("button", { name: "Invisible characters" });
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
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await layout()).toEqual(before);
});

test("with the option visible the marks are there from the start, and the button is pressed", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters-shown"));
  const field = page.getByRole("textbox", { name: "Document" });

  await expect(
    page.getByRole("button", { name: "Invisible characters", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
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
  const toggle = page.getByRole("button", { name: /invisible characters$/ });
  const saved = page.getByLabel("Saved HTML");
  const changes = page.getByLabel("Change count");

  await expect(toggle).toHaveText("Show invisible characters");
  await expect(toggle).not.toHaveAttribute("aria-pressed", "true");
  await expect(saved).toContainText("<h2>Invisible characters</h2>");
  const html = await saved.textContent();
  expect(html).not.toContain("tiptap-invisible-character");

  await toggle.click();
  await expect(toggle).toHaveText("Hide invisible characters");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // Кнопка Панели в том же Редакторе нажата вместе с внешней: состояние одно.
  await expect(
    page.getByRole("button", { name: "Invisible characters", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(field.locator(".tiptap-invisible-character--paragraph")).toHaveCount(3);
  await expect(saved).toHaveText(html!);
  await expect(changes).toHaveText("0");

  await toggle.click();
  await expect(field.locator(".tiptap-invisible-character")).toHaveCount(0);
  await expect(saved).toHaveText(html!);
  await expect(changes).toHaveText("0");
});

test("from the keyboard: the button is in the toolbar's arrow order before Find, Space and Enter toggle it", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--invisible-characters"));
  const field = page.getByRole("textbox", { name: "Document" });
  const button = page.getByRole("button", { name: "Invisible characters" });
  await expect(field).toContainText("Spaces sit between these words");

  await page.getByRole("button", { name: "Find" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(button).toBeFocused();

  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(field.locator(".tiptap-invisible-character--paragraph").first()).toBeAttached();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Find" })).toBeFocused();
});
