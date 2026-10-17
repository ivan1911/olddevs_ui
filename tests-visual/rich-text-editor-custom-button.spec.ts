import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Popover of a custom Tool's button in a browser (OLDSUI-105): what jsdom cannot
 * do, namely the position relative to the button and to the caret. Roles, names,
 * `aria-*`, shortcuts and the reference are checked in
 * `tests/rich-text-editor-custom-button.test.tsx`.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

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

/**
 * The popover sits right next to its anchor: vertically adjacent, and the anchor lies
 * within its width.
 */
function expectAnchoredAt(popover: Box, anchor: Box) {
  const below = popover.y - (anchor.y + anchor.height);
  const above = anchor.y - (popover.y + popover.height);
  expect(Math.min(Math.abs(below), Math.abs(above))).toBeLessThan(40);
  expect(anchor.x).toBeGreaterThanOrEqual(popover.x - 8);
  expect(anchor.x).toBeLessThanOrEqual(popover.x + popover.width + 8);
}

test("a click opens the popover at the button; Escape returns the caret to the text", async ({
  page,
}) => {
  await page.goto(STORY("custom-tool-buttons"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();
  await page.keyboard.press("End");
  const button = page.getByRole("button", { name: "Symbol", exact: true });

  await button.click();
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  expectAnchoredAt(await boxOf(popover), await boxOf(button));

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(field).toBeFocused();
});

test("the shortcut opens the popover at the caret, not at the button", async ({ page }) => {
  await page.goto(STORY("custom-tool-buttons"));
  const field = page.getByRole("textbox", { name: "Document" });
  // The caret is in the middle of the second paragraph, far from the Toolbar button.
  await field.getByText("The Stamp, Pin and Symbol").click({ position: { x: 120, y: 8 } });
  const caret = await caretBox(page);

  await page.keyboard.press("ControlOrMeta+Shift+J");
  const popover = page.getByRole("dialog", { name: "Symbol" });
  await expect(popover).toBeVisible();
  const box = await boxOf(popover);
  expectAnchoredAt(box, caret);
  expect(box.y).toBeGreaterThan((await boxOf(page.getByRole("toolbar", { name: "Formatting" }))).y);

  await popover.getByRole("button", { name: "★" }).click();
  await expect(popover).toBeHidden();
  await expect(field).toContainText("★");
  await expect(field).toBeFocused();
});

test("the tooltip of an own button names its shortcut", async ({ page }) => {
  await page.goto(STORY("custom-tool-buttons"));
  const button = page.getByRole("button", { name: "Stamp", exact: true });

  await button.hover();
  await expect(page.getByRole("tooltip")).toContainText(/Ctrl\+Shift\+Y|⌘\+⇧\+Y/);
});
