import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Формулы (Mathematics, OLDSUI-280, ADR-0070) в браузере: то, чего jsdom не умеет, —
 * настоящая отрисовка KaTeX со стилями и шрифтами, Скелет до прихода ленивого чанка
 * (высота поля), щелчок и клавиши на формуле, Поповер у самой формулы и Остров
 * `RichTextView`.
 */

const STORY = (id: string, theme = "dark") =>
  `/iframe.html?id=${id}&globals=theme:${theme};accent:blue`;
const EDITOR = "inputs-richtexteditor--mathematics";
const VIEW = "content-richtextview--mathematics";

/** Дать ProseMirror прочитать каретку после щелчка. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

/**
 * Первая формула Документа — «S = \pi r^2» — и поле, в котором она стоит. Щелчок —
 * по видимой части формулы (`.katex-html`), как щёлкнул бы читатель: у `.katex` первой
 * идёт четверть для скрытого MathML размером в один пиксель, и Playwright целился бы
 * в неё, а не в знаки.
 */
function editor(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  const node = field.locator('[data-type="inline-math"]').first();
  return { field, first: node, glyphs: node.locator(".katex-html") };
}

// ── Отрисовка ────────────────────────────────────────────────────────────

test("the editor draws every formula with KaTeX: HTML for the eyes, MathML for the screen reader", async ({
  page,
}) => {
  await page.goto(STORY(EDITOR));
  const { field } = editor(page);

  // Две строчные и две блочные формулы образца.
  await expect(field.locator(".katex")).toHaveCount(4);
  await expect(field.locator(".katex-display")).toHaveCount(2);
  const first = field.locator(".katex").first();
  // Скринридер читает MathML и аннотацию с исходником; HTML-вид от него скрыт.
  await expect(first.locator("math annotation")).toHaveText("S = \\pi r^2", {
    useInnerText: false,
  });
  await expect(first.locator(".katex-html")).toHaveAttribute("aria-hidden", "true");
  // Исходник формулы — в `data-latex` узла, а не в тексте Документа.
  await expect(field.locator('[data-type="inline-math"]').first()).toHaveAttribute(
    "data-latex",
    "S = \\pi r^2"
  );
  // Дробь и корень блочной формулы нарисованы, а не оставлены исходником.
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

  // CSS KaTeX применён: шрифт формулы — его собственный, а не шрифт Документа.
  await expect
    .poll(() => first.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("KaTeX_Main");
  // Шрифты резолвятся из пакета `katex` и грузятся: ни одного 404.
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

// ── Скелет ───────────────────────────────────────────────────────────────

test("before the chunk arrives the field shows the LaTeX in monospace, and its height barely changes", async ({
  page,
}) => {
  // Чанк формул задержан: Скелет стоит, пока ждём.
  await page.route("**/features/mathematics/mathChunk*", async (route) => {
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
  // Блок-формула в Скелете не ниже 4 rem: поле не схлопывается и не прыгает больше чем на десятую.
  expect(Math.abs(after - before) / after).toBeLessThan(0.1);
});

// ── Поповер ──────────────────────────────────────────────────────────────

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
  // Поповер стоит рядом с формулой: рамка не дальше пары строк от неё.
  const formulaBox = (await first.boundingBox())!;
  const popoverBox = (await popover.boundingBox())!;
  expect(Math.abs(popoverBox.y - (formulaBox.y + formulaBox.height))).toBeLessThan(60);

  await latex.fill("x^3 + y^3");
  // Живой предпросмотр: исходник и отрисовка из того же KaTeX.
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
  // Из заголовка — вниз, в первую строку абзаца, и в её начало; затем к формуле.
  await field.getByRole("heading", { name: "Formulas" }).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await settle(page);
  const lead = "The area of a circle is ";
  for (let step = 0; step < lead.length; step++) await page.keyboard.press("ArrowRight");
  // Строчный атом каретка перешагивает без выделения (так устроен ProseMirror), поэтому
  // формулу выделяют `Shift+→` или щелчком — и Enter на ней открывает правку.
  await page.keyboard.press("Shift+ArrowRight");
  await settle(page);

  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Formula" });
  await expect(popover.getByRole("textbox", { name: "LaTeX" })).toHaveValue("S = \\pi r^2");
  await expect(popover.getByRole("textbox", { name: "LaTeX" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
  // Enter не расщепил абзац, формула на месте.
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
  // «formula» подходит обоим пунктам; первый — строчная, её и выбирает Enter.
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
    const result = await new AxeBuilder({ page }).analyze();
    const blocking = result.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(
      blocking.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    ).toEqual([]);
  }
});

// ── Просмотр ─────────────────────────────────────────────────────────────

test("RichTextView draws the formulas by its island, with the same stylesheet", async ({
  page,
}) => {
  await page.goto(STORY(VIEW));
  const view = page.locator("#storybook-root");

  // Четыре читаемые формулы (две строчные и две блочные) отрисованы, нечитаемая — исходник.
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
  await page.route("**/features/mathematics/katexEngine*", async (route) => {
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
  // `\RR` — блэкборд-R: символ из набора `KaTeX_AMS`.
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
      const result = await new AxeBuilder({ page }).include("#storybook-root").analyze();
      const blocking = result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );
      expect(blocking.map((v) => `${id} ${theme}: ${v.id}`)).toEqual([]);
    }
  }
});
