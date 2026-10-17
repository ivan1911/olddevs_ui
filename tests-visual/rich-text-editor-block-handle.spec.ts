import { expect, test } from "@playwright/test";

/**
 * Editor Block handle in a browser (OLDSUI-72): what jsdom cannot do.
 *
 * A react-aria menu inside a Radix dialog does not open in jsdom: the dialog's focus
 * trap sends focus back. So the overlay layer stack of ADR-0041 is checked here, with
 * a real `Dialog`: `ControlOrMeta+/` from the Document, the "Format" submenu, and
 * Escape closing one level at a time. This is also where the real layout is checked:
 * the handle sits to the left of the text and follows the caret.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("inside a Dialog: the shortcut opens the menu, Escape closes the submenu, then the menu, and the window stays", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.getByText("Press Escape").click();

  const handle = page.getByRole("button", { name: "Block actions" });
  await expect(handle).toBeVisible();

  await page.keyboard.press("ControlOrMeta+/");
  const menu = page.getByRole("menu", { name: "Block actions" });
  await expect(menu).toBeVisible();

  // Arrow keys to "Format", then → opens the submenu with focus inside it.
  await page.getByRole("menuitem", { name: "Format" }).focus();
  await page.keyboard.press("ArrowRight");
  const format = page.getByRole("menu", { name: "Format" });
  await expect(format).toBeVisible();
  await expect(format.getByRole("menuitemradio", { name: /^Text/ })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(format).toBeHidden();
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toBeFocused();
});

test("inside a Dialog: a menu item acts on the block and returns focus to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText("Press Escape").click();

  await page.getByRole("button", { name: "Block actions" }).click();
  await page.getByRole("menuitem", { name: /^Duplicate/ }).click();

  await expect(field.getByText("Press Escape")).toHaveCount(2);
  await expect(dialog).toBeVisible();
  await expect(field).toBeFocused();
});

test("the handle sits left of the text and follows the caret to the first line of its block", async ({
  page,
}) => {
  await page.goto(STORY("block-handle"));
  const field = page.getByRole("textbox", { name: "Document" });
  const handle = page.getByRole("button", { name: "Block actions" });
  await expect(handle).toBeVisible();

  // The caret is in the second item: the handle sits at the first line of the list,
  // to the left of the markers.
  const list = field.locator("ul");
  const box = (await handle.boundingBox())!;
  const listBox = (await list.boundingBox())!;
  const first = (await field.getByText("A list is one block").boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(listBox.x);
  expect(Math.abs(box.y + box.height / 2 - (first.y + first.height / 2))).toBeLessThan(3);

  // Clicking the heading moves the handle to it.
  const title = field.getByText("Weekly summary");
  await title.click();
  const titleBox = (await title.boundingBox())!;
  await expect
    .poll(async () => {
      const moved = (await handle.boundingBox())!;
      return Math.abs(moved.y + moved.height / 2 - (titleBox.y + titleBox.height / 2));
    })
    .toBeLessThan(3);
});

test("hovering a block does not show the handle: only the caret does", async ({ page }) => {
  await page.goto(STORY("playground"));
  const field = page.getByRole("textbox", { name: /./ }).first();
  await field.locator("p").first().hover();
  await expect(page.getByRole("button", { name: "Block actions" })).toHaveCount(0);
});
