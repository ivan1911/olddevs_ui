import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Popover of an Insert item and of a Block action in a browser (story 39,
 * ADR-0058, item 5.6): what jsdom cannot do, namely the position relative to the
 * caret (where the "/" was) and to the Block of the Block handle. Opening from each
 * place, Escape, focus return and typing errors are checked in
 * `tests/rich-text-editor-custom-popover.test.tsx`. The popover goes into a portal,
 * so axe on the open popover is also here.
 */

const STORY = (theme = "dark") =>
  `/iframe.html?id=inputs-richtexteditor--custom-entry-popovers&globals=theme:${theme};accent:blue`;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element has no box");
  return box as Box;
}

/** The Document's caret: the selection rectangle in window coordinates. */
async function caretBox(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const range = window.getSelection()!.getRangeAt(0).cloneRange();
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/** The popover sits vertically next to its anchor. */
function expectNextTo(popover: Box, anchor: Box) {
  const below = popover.y - (anchor.y + anchor.height);
  const above = anchor.y - (popover.y + popover.height);
  expect(Math.min(Math.abs(below), Math.abs(above))).toBeLessThan(16);
}

const SLASH_TEXT = "Type / and pick Symbol";
const BLOCK_TEXT = "Append symbol in the block menu";

/**
 * Popover from "/": type " /sym" at the end of the paragraph and pick the item.
 * The caret is where the "/" was.
 */
async function openFromSlash(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText(SLASH_TEXT).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  const caret = await caretBox(page);
  await page.keyboard.type("/sym");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  return { field, caret, popover };
}

/**
 * Popover of a Block action: the caret is in the paragraph, the Block handle menu,
 * "Append symbol".
 */
async function openFromHandle(page: Page) {
  const field = page.getByRole("textbox", { name: "Document" });
  const paragraph = field.locator("p", { hasText: BLOCK_TEXT });
  await paragraph.click({ position: { x: 40, y: 8 } });
  await page.getByRole("button", { name: "Block actions" }).click();
  await page.getByRole("menuitem", { name: "Append symbol" }).click();
  const popover = page.getByRole("dialog", { name: "Append symbol" });
  await expect(popover).toBeVisible();
  return { field, paragraph, popover };
}

test("the popover of an item picked in / stands where the slash was; Escape returns the caret", async ({
  page,
}) => {
  await page.goto(STORY());
  const { field, caret, popover } = await openFromSlash(page);

  const box = await boxOf(popover);
  expectNextTo(box, caret);
  // The popover's left edge is at the caret (`align="start"`), not at the start of the
  // line or at the button.
  expect(Math.abs(box.x - caret.x)).toBeLessThan(24);
  // The typed "/command" is removed, as it is for a regular item.
  await expect(field).not.toContainText("/sym");

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
  expect(Math.abs((await caretBox(page)).x - caret.x)).toBeLessThan(2);
});

test("the popover of a block action stands at the block of the handle", async ({ page }) => {
  await page.goto(STORY());
  const { field, paragraph, popover } = await openFromHandle(page);

  const box = await boxOf(popover);
  const block = await boxOf(paragraph);
  expectNextTo(box, block);
  expect(Math.abs(box.x - block.x)).toBeLessThan(24);

  await popover.getByRole("button", { name: "★" }).click();
  await expect(popover).toBeHidden();
  await expect(paragraph).toHaveText(/★$/);
  await expect(field).toBeFocused();
});

test("from + and Add of the handle the popover stays open at the caret: the closing menu does not take the focus back", async ({
  page,
}) => {
  await page.goto(STORY());
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText(SLASH_TEXT).click();
  const caret = await caretBox(page);
  const popover = page.getByRole("dialog", { name: "Symbol" });

  await page.getByRole("button", { name: "Insert block" }).click();
  await page.getByRole("menuitem", { name: "Symbol" }).click();
  await expect(popover).toBeVisible();
  // The menu closes and returns focus to its trigger, and the popover stays open.
  await page.waitForTimeout(300);
  await expect(popover).toBeVisible();
  expectNextTo(await boxOf(popover), caret);
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();

  await page.getByRole("button", { name: "Block actions" }).click();
  await page.getByRole("menuitem", { name: "Add" }).click();
  await page.getByRole("menu", { name: "Add" }).getByRole("menuitem", { name: "Symbol" }).click();
  await expect(popover).toBeVisible();
  await page.waitForTimeout(300);
  await expect(popover).toBeVisible();
  expectNextTo(await boxOf(popover), caret);
});

for (const theme of ["dark", "light", "dim"] as const) {
  test(`the open popovers and the field pass axe — theme ${theme}`, async ({ page }) => {
    await page.goto(STORY(theme));
    // The entrance animation starts from transparency: axe would compute contrast from that.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; transition: none !important; }",
    });
    const audit = async () => {
      const { violations } = await new AxeBuilder({ page })
        .include("#storybook-root")
        .include('[role="dialog"]')
        .analyze();
      return violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    };

    await openFromSlash(page);
    expect(await audit()).toEqual([]);
    await page.keyboard.press("Escape");

    await openFromHandle(page);
    expect(await audit()).toEqual([]);
  });
}
