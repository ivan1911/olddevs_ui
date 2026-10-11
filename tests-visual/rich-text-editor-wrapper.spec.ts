import { expect, test, type Page } from "@playwright/test";

/**
 * Обёртка Редактора в браузере (OLDSUI-77): то, чего jsdom не умеет, —
 * настоящие стили (пунктир в Редакторе, без рамки в Просмотре, отступы между
 * Блоками) и стрелки, которые ведёт сам браузер.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/** Дать ProseMirror прочитать каретку после щелчка (как в спеке Раскладки). */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

test("in the editor a wrapper has a dashed border and inner padding", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--wrappers"));
  const field = page.getByRole("textbox", { name: "Document" });
  const wrapper = field.locator('[data-block="wrapper"]').first();
  await expect(wrapper).toBeVisible();

  const style = await wrapper.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      border: css.borderTopStyle,
      width: css.borderTopWidth,
      padding: css.paddingLeft,
      // Отступ первого Блока внутри — как между Блоками Документа.
      gap: getComputedStyle(element.firstElementChild!).marginBottom,
    };
  });
  expect(style).toEqual({ border: "dashed", width: "1px", padding: "8px", gap: "12px" });
});

test("RichTextView shows no border and keeps the document spacing", async ({ page }) => {
  await page.goto(STORY("content-richtextview--wrappers"));
  const wrapper = page.locator('[data-block="wrapper"]').first();
  await expect(wrapper).toBeVisible();

  const style = await wrapper.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      border: css.borderTopWidth,
      padding: css.paddingLeft,
      gap: getComputedStyle(element.firstElementChild!).marginBottom,
    };
  });
  expect(style).toEqual({ border: "0px", padding: "0px", gap: "12px" });
});

test("Enter in an empty last line leaves the wrapper; up from its top goes above", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--wrappers"));
  const field = page.getByRole("textbox", { name: "Document" });
  const wrapper = field.locator('[data-block="wrapper"]').first();

  // Новый пункт, пустой пункт выходит из списка в абзац Обёртки, пустой
  // последний абзац — из Обёртки.
  await wrapper.getByText("Write the changelog").click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Outside");
  await expect(wrapper).not.toContainText("Outside");
  await expect(field.locator(':scope > p:has-text("Outside")')).toHaveCount(1);

  // Из первой строки Обёртки `↑` — к Блоку над ней.
  await wrapper.getByRole("heading", { name: "Before the release" }).click();
  await page.keyboard.press("Home");
  await settle(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("~");
  await expect(wrapper).not.toContainText("~");
  // Абзац над Обёрткой — первый абзац Документа.
  await expect(field.locator(":scope > p").first()).toContainText("~");
});

/**
 * Вид Обёртки с тоном (OLDSUI-78): подложка, полоса, отступы — без пунктира.
 * `scope` — где искать: в Редакторе это поле Документа, а не страница. До
 * Готовности Скелет (OLDSUI-110) рисует ту же Обёртку, и движок подменяет её
 * через миг — замер мог достаться уже отцепленному узлу с пустыми стилями.
 */
async function toneLook(page: Page, tone: string, scope = page.locator("body")) {
  const wrapper = scope.locator(`[data-block="wrapper"][data-tone="${tone}"]`).first();
  await expect(wrapper).toBeVisible();
  return wrapper.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      background: css.backgroundColor,
      stripe: `${css.borderLeftStyle} ${css.borderLeftWidth} ${css.borderLeftColor}`,
      // Пунктира нет: у остальных сторон рамки нет вовсе.
      top: css.borderTopWidth,
      padding: `${css.paddingTop} ${css.paddingLeft}`,
    };
  });
}

test("a toned wrapper looks the same in the editor and in the view, without the dashed frame", async ({
  page,
}) => {
  for (const tone of ["neutral", "accent", "success", "warning", "danger"]) {
    await page.goto(STORY("inputs-richtexteditor--wrapper-tones"));
    const inEditor = await toneLook(page, tone, page.getByRole("textbox", { name: "Document" }));
    await page.goto(STORY("content-richtextview--wrapper-tones"));
    const inView = await toneLook(page, tone);

    expect(inEditor, tone).toEqual(inView);
    expect(inEditor.stripe, tone).toMatch(/^solid 3px rgb/);
    expect(inEditor.top, tone).toBe("0px");
    expect(inEditor.background, tone).not.toBe("rgba(0, 0, 0, 0)");
    expect(inEditor.padding, tone).toBe("10px 12px");
  }
});
