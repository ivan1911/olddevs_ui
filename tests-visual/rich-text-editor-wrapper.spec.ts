import { expect, test, type Page } from "@playwright/test";

/**
 * Editor Wrapper in a browser (OLDSUI-77): what jsdom cannot do, namely the real
 * styles (dashed border in the Editor, no border in the View, spacing between
 * Blocks) and arrow keys that the browser handles itself.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/** Give ProseMirror time to read the caret after a click (as in the Layout spec). */
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
      // The spacing of the first Block inside matches the spacing between the Document's Blocks.
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

  // A new item: an empty item leaves the list into a paragraph of the Wrapper, and an
  // empty last paragraph leaves the Wrapper.
  await wrapper.getByText("Write the changelog").click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Outside");
  await expect(wrapper).not.toContainText("Outside");
  await expect(field.locator(':scope > p:has-text("Outside")')).toHaveCount(1);

  // From the first line of the Wrapper, `↑` goes to the Block above it.
  await wrapper.getByRole("heading", { name: "Before the release" }).click();
  await page.keyboard.press("Home");
  await settle(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("~");
  await expect(wrapper).not.toContainText("~");
  // The paragraph above the Wrapper is the Document's first paragraph.
  await expect(field.locator(":scope > p").first()).toContainText("~");
});

/**
 * The look of a Wrapper with a tone (OLDSUI-78): background, stripe and padding, with
 * no dashed border. `scope` is where to look: in the Editor it is the Document field,
 * not the page. Until Readiness the Skeleton (OLDSUI-110) draws the same Wrapper, and
 * the engine replaces it a moment later, so the measurement could land on a node that
 * has already been detached and has empty styles.
 */
async function toneLook(page: Page, tone: string, scope = page.locator("body")) {
  const wrapper = scope.locator(`[data-block="wrapper"][data-tone="${tone}"]`).first();
  await expect(wrapper).toBeVisible();
  return wrapper.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      background: css.backgroundColor,
      stripe: `${css.borderLeftStyle} ${css.borderLeftWidth} ${css.borderLeftColor}`,
      // There is no dashed border: the other sides have no border at all.
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
