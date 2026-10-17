import { expect, test, type Page } from "@playwright/test";

/**
 * Editor layout in a browser (OLDSUI-74): what jsdom cannot do, namely the real
 * grid with a container query, arrow-key geometry, and Tab inside a Radix dialog
 * with its own focus trap.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/**
 * Give ProseMirror time to read the caret after a click. It takes the selection
 * from the DOM by `selectionchange`, which is a separate task after `mouseup`: a key
 * pressed right after the click would see the previous caret. A person does not press
 * that fast; two frames is a safe margin.
 */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

test("inside a Dialog: two columns stand side by side and Tab walks them", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--layout-in-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();

  const columns = field.locator('[data-block="layout"] > [data-block="column"]');
  await expect(columns).toHaveCount(2);
  const [left, right] = [await columns.nth(0).boundingBox(), await columns.nth(1).boundingBox()];
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  expect(Math.abs(right!.y - left!.y)).toBeLessThan(1);

  await columns.nth(0).getByText("First column.").click();
  await settle(page);
  await page.keyboard.press("Tab");
  await page.keyboard.type("Typed ");
  await expect(columns.nth(1)).toContainText("Typed Right");
  await expect(field).toBeFocused();

  // From the last column, Tab moves on through the dialog, and the dialog stays open.
  await page.keyboard.press("Tab");
  await expect(field).not.toBeFocused();
  await expect(dialog).toBeVisible();
});

test("arrows cross the columns and leave the layout below", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--layouts"));
  const field = page.getByRole("textbox", { name: "Document" });
  const goals = field.getByText("Ship the new search", { exact: false });
  await goals.click();
  await page.keyboard.press("End");
  await settle(page);

  // From the end of the left column, `→` moves to the start of the right one.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("x");
  await expect(field.getByRole("heading", { name: "xRisks" })).toBeVisible();

  // From the bottom line of a column, `↓` goes to the Block below the Column layout,
  // not to the neighboring column.
  await field.getByText("The index rebuild", { exact: false }).click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("~");
  await expect(field.getByRole("heading", { name: "~Plan" })).toBeVisible();
});

test("on a phone the columns stack in reading order", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(STORY("content-richtextview--layout-narrow"));
  const columns = page.locator('[data-layout="50-50"] > [data-block="column"]');
  const [left, right] = [await columns.nth(0).boundingBox(), await columns.nth(1).boundingBox()];
  expect(right!.y).toBeGreaterThan(left!.y + left!.height);
  expect(Math.abs(right!.x - left!.x)).toBeLessThan(1);
});
