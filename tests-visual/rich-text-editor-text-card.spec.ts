import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Text card in a browser (OLDSUI-113): what jsdom cannot do, namely the position
 * below the range, flipping at the window edge, and staying inside the window. Roles,
 * names, focus, Escape, `Alt+F10`, choosing the narrowest Text card and the phrase for
 * the screen reader are checked in `tests/rich-text-editor-text-card.test.tsx`. axe
 * passes the `TextCardOpen` story in `a11y.spec.ts`, but only on the canvas: the Text
 * card goes into a portal, so its axe check is here too, as a separate test.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element has no box");
  return box as Box;
}

/**
 * The Text card loads lazily: its chunk arrives after the Editor, and a click before
 * that would go nowhere. Readiness is the Text card's live region: a second
 * `role="status"` next to the field's Field notice region.
 */
async function open(page: Page, id: string) {
  await page.goto(STORY(id));
  await expect(page.getByRole("textbox", { name: "Document" })).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveCount(2);
}

const MARK = '[data-mark="acme_comment"]';

/** The Text card sits right under the range, with its left edge at the start of the range. */
function expectBelow(card: Box, range: Box) {
  const gap = card.y - (range.y + range.height);
  expect(gap).toBeGreaterThanOrEqual(-2);
  expect(gap).toBeLessThan(24);
  expect(Math.abs(card.x - range.x)).toBeLessThan(24);
}

/** The Text card is fully inside the window. */
async function expectInViewport(page: Page, card: Box) {
  const { width, height } = page.viewportSize()!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(width);
  expect(card.y + card.height).toBeLessThanOrEqual(height);
}

test("a click on the range opens the card under it, typing goes on, the focus stays", async ({
  page,
}) => {
  await open(page, "text-card");
  const field = page.getByRole("textbox", { name: "Document" });
  const mark = field.locator(MARK).first();
  const card = page.getByRole("dialog", { name: "Comment" });

  // Hovering does not open the Text card.
  await mark.hover();
  await expect(card).toBeHidden();

  await mark.click({ position: { x: 24, y: 8 } });
  await expect(card).toBeVisible();
  expectBelow(await boxOf(card), await boxOf(mark));
  await expectInViewport(page, await boxOf(card));

  await page.keyboard.type("!");
  await expect(field).toBeFocused();
  await expect(card).toBeVisible();
  await expect(field).toContainText("!");
});

test("the card follows the range when the text before it changes", async ({ page }) => {
  await open(page, "text-card");
  const field = page.getByRole("textbox", { name: "Document" });
  const mark = field.locator(MARK).nth(1);
  const card = page.getByRole("dialog", { name: "Comment" });

  await mark.click({ position: { x: 20, y: 8 } });
  await expect(card).toBeVisible();
  const before = await boxOf(card);

  // A long insert at the start of the paragraph wraps the line: the comment moves down,
  // the caret moves with it, and the Text card follows the range.
  await page.evaluate(() => {
    // Tiptap puts the engine on the root of the editable area.
    type Engine = {
      view: { dispatch: (tr: unknown) => void };
      state: { tr: { insertText: (text: string, pos: number) => unknown } };
    };
    const dom = document.querySelector<HTMLElement & { editor?: Engine }>(".ProseMirror")!;
    const editor = dom.editor!;
    editor.view.dispatch(editor.state.tr.insertText("Padding ".repeat(14), 1));
  });
  await expect(card).toBeVisible();
  await expect.poll(async () => (await boxOf(card)).y).toBeGreaterThan(before.y + 10);
  expectBelow(await boxOf(card), await boxOf(mark));
});

test("with no room below the card flips above the range", async ({ page }) => {
  await open(page, "text-card-near-edge");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const field = page.getByRole("textbox", { name: "Document" });
  const mark = field.locator(MARK).nth(1);
  await mark.click({ position: { x: 20, y: 8 } });

  const card = page.getByRole("dialog", { name: "Comment" });
  await expect(card).toBeVisible();
  const box = await boxOf(card);
  const range = await boxOf(mark);
  // Above the range, right next to it, and fully inside the window.
  expect(box.y + box.height).toBeLessThanOrEqual(range.y + 2);
  expect(range.y - (box.y + box.height)).toBeLessThan(24);
  await expectInViewport(page, box);
});

test("a narrow window keeps the card inside it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "text-card");
  const field = page.getByRole("textbox", { name: "Document" });
  // The second comment is short and on one line: the click lands on it, not between lines.
  await field
    .locator(MARK)
    .nth(1)
    .click({ position: { x: 30, y: 8 } });

  const card = page.getByRole("dialog", { name: "Comment" });
  await expect(card).toBeVisible();
  await expectInViewport(page, await boxOf(card));
});

test("Alt+F10 leads into the card, Escape returns the caret; a click opens it again", async ({
  page,
}) => {
  await open(page, "text-card");
  const field = page.getByRole("textbox", { name: "Document" });
  const mark = field.locator(MARK).first();
  const card = page.getByRole("dialog", { name: "Comment" });

  await mark.click({ position: { x: 24, y: 8 } });
  await expect(card).toBeVisible();

  await page.keyboard.press("Alt+F10");
  await expect(card.getByRole("button", { name: "Resolve" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(field).toBeFocused();
  // The caret is in place: what was typed went into the comment.
  await page.keyboard.type("Z");
  await expect(mark).toContainText("Z");
  await expect(card).toBeHidden();

  await mark.click({ position: { x: 24, y: 8 } });
  await expect(card).toBeVisible();
});

test("a readOnly field opens the card by a click and closes it by a click aside", async ({
  page,
}) => {
  await open(page, "text-card-read-only");
  const field = page.getByRole("textbox", { name: "Document" });
  const mark = field.locator(MARK).first();
  const card = page.getByRole("dialog", { name: "Comment" });

  await mark.click({ position: { x: 24, y: 8 } });
  await expect(card).toBeVisible();
  expectBelow(await boxOf(card), await boxOf(mark));

  await page.mouse.click(1000, 600);
  await expect(card).toBeHidden();
});

for (const theme of ["dark", "light", "dim"] as const) {
  test(`the open card and the field pass axe — theme ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=inputs-richtexteditor--text-card-open&globals=theme:${theme};accent:blue`
    );
    const card = page.getByRole("dialog", { name: "Comment" });
    await expect(card).toBeVisible();
    // The entrance animation starts from transparency: axe would compute contrast from that.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; transition: none !important; }",
    });

    const { violations } = await new AxeBuilder({ page })
      .include("#storybook-root")
      .include('[role="dialog"]')
      .analyze();
    const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      blocking.map(
        (v) => `${v.impact}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
      )
    ).toEqual([]);
  });
}
