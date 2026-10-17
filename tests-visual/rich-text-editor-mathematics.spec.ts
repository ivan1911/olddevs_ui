import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Formulas (Mathematics, OLDSUI-280, ADR-0070) in a browser: what jsdom cannot do,
 * namely real KaTeX rendering with its styles and fonts, the Skeleton before the lazy
 * chunk arrives (the field height), a click and keys on a formula, the popover right
 * at the formula, and the Island of `RichTextView`.
 */

const STORY = (id: string, theme = "dark") =>
  `/iframe.html?id=${id}&globals=theme:${theme};accent:blue`;
const EDITOR = "inputs-richtexteditor--mathematics";
const VIEW = "content-richtextview--mathematics";

/*
  Lazy formula chunks by URL: the file is named after its module both in the dev server
  (`/src/editor/features/mathematics/mathChunk.tsx`) and in the build
  (`/assets/mathChunk-<hash>.js`), so the pattern "up to the first dot or hyphen" matches both.
*/
const MATH_CHUNK = /\/mathChunk[.-][^/]*$/;
const KATEX_ENGINE = /\/katexEngine[.-][^/]*$/;

/** Give ProseMirror time to read the caret after a click. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

/**
 * The Document's first formula, "S = \pi r^2", and the field it sits in. The click
 * goes to the visible part of the formula (`.katex-html`), as a reader would click:
 * in `.katex` the first quarter is a one-pixel hidden MathML, and Playwright would
 * aim at it instead of the glyphs.
 */
function editor(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  const node = field.locator('[data-type="inline-math"]').first();
  return { field, first: node, glyphs: node.locator(".katex-html") };
}

/**
 * The showcase's a11y addon runs axe on its own, and two runs at once fail with "Axe is
 * already running": wait for the other one and retry (as `a11y.spec.ts` does). Any other
 * error is rethrown.
 */
async function analyzeWhenFree(page: Page, scope?: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const builder = new AxeBuilder({ page });
      return await (scope ? builder.include(scope) : builder).analyze();
    } catch (error) {
      const busy = error instanceof Error && error.message.includes("Axe is already running");
      if (!busy || attempt >= 10) throw error;
      await page.waitForTimeout(150);
    }
  }
}

// ── Rendering ────────────────────────────────────────────────────────────

test("the editor draws every formula with KaTeX: HTML for the eyes, MathML for the screen reader", async ({
  page,
}) => {
  await page.goto(STORY(EDITOR));
  const { field } = editor(page);

  // Two inline and two block formulas in the sample.
  await expect(field.locator(".katex")).toHaveCount(4);
  await expect(field.locator(".katex-display")).toHaveCount(2);
  const first = field.locator(".katex").first();
  // The screen reader reads the MathML and the annotation with the source; the HTML
  // view is hidden from it.
  await expect(first.locator("math annotation")).toHaveText("S = \\pi r^2", {
    useInnerText: false,
  });
  await expect(first.locator(".katex-html")).toHaveAttribute("aria-hidden", "true");
  // The formula source is in the node's `data-latex`, not in the Document's text.
  await expect(field.locator('[data-type="inline-math"]').first()).toHaveAttribute(
    "data-latex",
    "S = \\pi r^2"
  );
  // The fraction and the root of the block formula are drawn, not left as source.
  await expect(field.locator(".katex .mfrac")).not.toHaveCount(0);
  await expect(field.locator(".katex .sqrt")).not.toHaveCount(0);
});

test("the stylesheet and the fonts of KaTeX arrive with the lazy chunk", async ({ page }) => {
  const fonts: { url: string; status: number }[] = [];
  page.on("response", (response) => {
    if (/KaTeX_[\w-]+\.(woff2|woff|ttf)/.test(response.url())) {
      fonts.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto(STORY(EDITOR));
  const first = editor(page).field.locator(".katex").first();
  await expect(first).toBeVisible();

  // The KaTeX CSS is applied: the formula's font is its own, not the Document's font.
  await expect
    .poll(() => first.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("KaTeX_Main");
  // The fonts resolve from the `katex` package and load: not a single 404.
  await expect.poll(() => fonts.length).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.filter((font) => font.status !== 200)).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.fonts.check("1em KaTeX_Main"))).toBe(true);
});

test("an unreadable formula stays as source, underlined as an error", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--mathematics-invalid"));
  const field = editor(page).field;
  const broken = field.locator('[data-type="inline-math"]');

  await expect(broken).toHaveText("\\frac{1");
  await expect(broken).toHaveClass(/inline-math-error/);
  const look = await broken.evaluate((element) => {
    const css = getComputedStyle(element);
    return { font: css.fontFamily, line: css.textDecorationLine, style: css.textDecorationStyle };
  });
  expect(look.font).toMatch(/mono/i);
  expect(look).toMatchObject({ line: "underline", style: "wavy" });
  await expect(field.locator('[data-type="block-math"]')).toHaveText("\\badcommand{x}");
});

// ── Search ───────────────────────────────────────────────────────────────

test("search finds the LaTeX of a formula and lights the whole formula", async ({ page }) => {
  await page.goto(STORY(EDITOR));
  const { field } = editor(page);
  await expect(field.locator(".katex").first()).toBeVisible();

  await page.getByRole("button", { name: "Find" }).click();
  const panel = page.getByRole("search", { name: "Find and replace" });
  await panel.getByRole("textbox", { name: "Find" }).fill("\\pi");

  // "\pi" is in the source of two formulas: the inline one with the area and Euler's.
  // There is no text match for this query.
  await expect(panel.getByRole("status")).toHaveText("1 of 2");
  const lit = field.locator(".rte-search-match");
  await expect(lit).toHaveCount(2);
  await expect(lit.first()).toHaveAttribute("data-type", "inline-math");
  await expect(field.locator(".rte-search-current")).toHaveCount(1);
  // The highlight sits on the formula itself, not on a stretch of text inside it.
  const fill = await lit.first().evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");

  await panel.getByRole("button", { name: "Next match" }).click();
  await expect(field.locator(".rte-search-current")).toHaveCount(1);
  await expect(panel.getByRole("status")).toHaveText("2 of 2");
  // There is nothing to replace in formulas, so both replace buttons are disabled.
  await expect(panel.getByRole("button", { name: "Replace all" })).toBeDisabled();
});

// ── Skeleton ─────────────────────────────────────────────────────────────

test("before the chunk arrives the field shows the LaTeX in monospace, and its height barely changes", async ({
  page,
}) => {
  // The formula chunk is held back: the Skeleton stays up while we wait. The file name
  // differs: `mathChunk.tsx` in the dev server and `assets/mathChunk-<hash>.js` in the
  // built showcase (`storybook-static`).
  await page.route(MATH_CHUNK, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto(STORY(EDITOR));
  const skeleton = page.locator('#storybook-root [data-type="inline-math"]').first();
  await expect(skeleton).toHaveText("S = \\pi r^2");
  await expect(page.locator("[contenteditable]")).toHaveCount(0);
  expect(await skeleton.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(
    /mono/i
  );
  const root = page.locator("#storybook-root > div");
  const before = (await root.boundingBox())!.height;

  await expect(page.locator("[contenteditable] .katex").first()).toBeVisible({ timeout: 15_000 });
  const after = (await root.boundingBox())!.height;
  // The block formula in the Skeleton is at least 4 rem tall: the field neither
  // collapses nor jumps by more than a tenth.
  expect(Math.abs(after - before) / after).toBeLessThan(0.1);
});

// ── Popover ──────────────────────────────────────────────────────────────

test("a click opens the popover at the formula; Apply redraws it, and focus returns to the text", async ({
  page,
}) => {
  await page.goto(STORY(EDITOR));
  const { field, first, glyphs } = editor(page);
  await glyphs.click();

  const popover = page.getByRole("dialog", { name: "Formula" });
  await expect(popover).toBeVisible();
  const latex = popover.getByRole("textbox", { name: "LaTeX" });
  await expect(latex).toHaveValue("S = \\pi r^2");
  await expect(latex).toBeFocused();
  // The popover sits next to the formula: its frame is no more than a couple of lines away.
  const formulaBox = (await first.boundingBox())!;
  const popoverBox = (await popover.boundingBox())!;
  expect(Math.abs(popoverBox.y - (formulaBox.y + formulaBox.height))).toBeLessThan(60);

  await latex.fill("x^3 + y^3");
  // Live preview: the source and the rendering both come from the same KaTeX.
  const preview = popover.getByRole("group", { name: "Preview" });
  await expect(preview.locator("annotation")).toHaveText("x^3 + y^3");
  await popover.getByRole("button", { name: "Apply" }).click();

  await expect(popover).toBeHidden();
  await expect(field.locator(".katex annotation").first()).toHaveText("x^3 + y^3");
  await expect(field.locator('[data-type="inline-math"]').first()).toHaveAttribute(
    "data-latex",
    "x^3 + y^3"
  );
  await expect(field).toBeFocused();
});

test("invalid LaTeX shows the error in the field, cannot be applied and leaves the formula alone", async ({
  page,
}) => {
  await page.goto(STORY(EDITOR));
  const { field, glyphs } = editor(page);
  await glyphs.click();

  const popover = page.getByRole("dialog", { name: "Formula" });
  const latex = popover.getByRole("textbox", { name: "LaTeX" });
  await latex.fill("\\frac{1");
  await expect(latex).toHaveAttribute("aria-invalid", "true");
  await expect(popover.getByText(/^Invalid LaTeX: /)).toBeVisible();
  await expect(popover.getByRole("button", { name: "Apply" })).toBeDisabled();
  await latex.press("Enter");
  await expect(popover).toBeVisible();

  await latex.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field.locator('[data-type="inline-math"]').first()).toHaveAttribute(
    "data-latex",
    "S = \\pi r^2"
  );
  await expect(field.locator(".katex").first()).toBeVisible();
});

test("from the keyboard: Shift+Right selects a formula, Enter opens the popover, Escape gives the field back", async ({
  page,
}) => {
  await page.goto(STORY(EDITOR));
  const { field } = editor(page);
  // The engine with formulas has arrived: until then the Skeleton is up, and when the field
  // is swapped the caret and focus are reset in the middle of the key presses (in the built
  // showcase the chunk takes noticeably longer than in dev).
  await expect(field.locator(".katex").first()).toBeVisible();
  /*
    The caret goes right before the formula, as a DOM selection, and ProseMirror has time to read it.
    Not with twenty `→` presses: ProseMirror reads the selection from the DOM by `selectionchange`,
    Playwright's queue of key presses gets ahead of it, and the previous selection is written back:
    the caret either jumped over the formula or bounced back (3 runs out of 8 on the build).
  */
  await field.locator("p", { hasText: "The area of a circle is" }).evaluate((paragraph) => {
    const text = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  });
  await settle(page);
  // The caret steps over an inline atom without selecting it (that is how ProseMirror works),
  // so the formula is selected with `Shift+→` or a click, and Enter on it opens the
  // editing popover.
  await page.keyboard.press("Shift+ArrowRight");
  await settle(page);

  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Formula" });
  await expect(popover.getByRole("textbox", { name: "LaTeX" })).toHaveValue("S = \\pi r^2");
  await expect(popover.getByRole("textbox", { name: "LaTeX" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
  // Enter did not split the paragraph, and the formula is still in place.
  await expect(field.locator("p", { hasText: "The area of a circle is" })).toHaveCount(1);
  await expect(field.locator('[data-type="inline-math"]').first()).toHaveAttribute(
    "data-latex",
    "S = \\pi r^2"
  );
});

test("the slash menu inserts a formula: / formula, Enter, type, Enter", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--mathematics-insert-slash"));
  const field = page.getByRole("textbox", { name: "Document" });
  const list = page.getByRole("listbox", { name: "Insert block" });
  await expect(list.getByRole("option", { name: /^Formula/ })).toBeVisible();
  // "formula" matches both items; the first one is the inline formula, and Enter picks it.
  await expect(list.getByRole("option", { name: /^Block formula/ })).toBeVisible();

  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Formula" });
  await expect(popover.getByRole("textbox", { name: "LaTeX" })).toBeFocused();
  await page.keyboard.type("a^2 + b^2 = c^2");
  await expect(popover.getByRole("group", { name: "Preview" }).locator(".katex")).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(popover).toBeHidden();
  await expect(field.locator(".katex annotation")).toHaveText("a^2 + b^2 = c^2");
  await expect(field.locator('[data-type="inline-math"]')).toHaveCount(1);
});

test("the popover opened by a story is within the viewport and passes axe in all three themes", async ({
  page,
}) => {
  for (const theme of ["dark", "light", "dim"]) {
    await page.goto(STORY("inputs-richtexteditor--mathematics-popover", theme));
    const popover = page.getByRole("dialog", { name: "Formula" });
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("group", { name: "Preview" }).locator(".katex")).toBeVisible();
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }",
    });
    const result = await analyzeWhenFree(page);
    const blocking = result.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(
      blocking.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    ).toEqual([]);
  }
});

// ── View ─────────────────────────────────────────────────────────────────

test("RichTextView draws the formulas by its island, with the same stylesheet", async ({
  page,
}) => {
  await page.goto(STORY(VIEW));
  const view = page.locator("#storybook-root");

  // The four readable formulas (two inline and two block) are rendered; the unreadable
  // one stays as source.
  await expect(view.locator(".katex")).toHaveCount(4);
  await expect(view.locator(".katex-display")).toHaveCount(2);
  const first = view.locator(".katex").first();
  await expect(first.locator("math annotation")).toHaveText("S = \\pi r^2");
  await expect
    .poll(() => first.evaluate((e) => getComputedStyle(e).fontFamily))
    .toContain("KaTeX_Main");
  const broken = view.locator("[data-math-error]");
  await expect(broken).toHaveCount(1);
  await expect(broken).toHaveText("\\frac{1");
  expect(await broken.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/mono/i);
});

test("RichTextView shows the LaTeX source until its island has KaTeX, then the formula", async ({
  page,
}) => {
  // `katexEngine.ts` in the dev server and `assets/katexEngine-<hash>.js` (with its CSS
  // next to it) in the built showcase.
  await page.route(KATEX_ENGINE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.goto(STORY(VIEW));
  const view = page.locator("#storybook-root");

  const formula = view.locator('[data-type="inline-math"]').first();
  await expect(formula).toHaveText("S = \\pi r^2");
  expect(await formula.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(
    /mono/i
  );
  await expect(view.locator(".katex")).toHaveCount(0);

  await expect(view.locator(".katex").first()).toBeVisible({ timeout: 15_000 });
  await expect(formula.locator("annotation")).toHaveText("S = \\pi r^2");
});

test("the macros of tool('mathematics') reach the view without naming the tool there", async ({
  page,
}) => {
  await page.goto(STORY("content-richtextview--mathematics-macros"));
  const view = page.locator("#storybook-root");

  await expect(view.locator(".katex")).toHaveCount(1);
  await expect(view.locator("[data-math-error]")).toHaveCount(0);
  // `\RR` is blackboard R: a glyph from the `KaTeX_AMS` set.
  await expect(view.locator(".katex .mathbb")).toHaveCount(1);
});

test("the editor and the view pass axe in all three themes", async ({ page }) => {
  for (const id of [EDITOR, VIEW, "content-richtextview--mathematics-paper"]) {
    for (const theme of ["dark", "light", "dim"]) {
      await page.goto(STORY(id, theme));
      await expect(page.locator("#storybook-root .katex").first()).toBeVisible();
      await page.addStyleTag({
        content:
          "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }",
      });
      const result = await analyzeWhenFree(page, "#storybook-root");
      const blocking = result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );
      expect(blocking.map((v) => `${id} ${theme}: ${v.id}`)).toEqual([]);
    }
  }
});
