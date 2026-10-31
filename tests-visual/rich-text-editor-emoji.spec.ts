import { expect, test } from "@playwright/test";

/**
 * Editor emoji grid in a browser (OLDSUI-68): what jsdom cannot do, namely the real
 * `pointer-events` of a Radix dialog and the Escape stack of layers (ADR-0041).
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("inside a Dialog: a mouse click picks an emoji and focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.click();
  await page.keyboard.press("End");

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeVisible();
  await expect(grid).toBeFocused();

  await grid.getByRole("gridcell", { name: "Fire" }).first().click();

  await expect(grid).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toContainText("🔥");
  await expect(field).toBeFocused();
});

test("inside a Dialog: Escape closes the grid first, then the window", async ({ page }) => {
  await page.goto(STORY("inside-dialog"));
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(grid).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toBeFocused();
});

test("the keyboard walks the grid and Enter inserts at the caret", async ({ page }) => {
  await page.goto(STORY("playground"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Choose an emoji" });
  await expect(grid).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(grid).toBeHidden();
  // The second cell in the row below is "Fire".
  await expect(field).toContainText("🔥");
  await expect(field).toBeFocused();
});

for (const initialCaret of ["clicked position", "document end"] as const) {
  test(`on the floating toolbar the grid opens and inserts after the selection (${initialCaret})`, async ({
    page,
  }) => {
    await page.goto(STORY("floating-toolbar"));
    const field = page.getByRole("textbox", { name: "Document" });
    await field.click();
    if (initialCaret === "document end") {
      const bounds = await field.boundingBox();
      await field.click({ position: { x: bounds!.width - 20, y: bounds!.height - 20 } });
      await expect
        .poll(() =>
          field.evaluate((node) => {
            const selection = window.getSelection();
            const lastParagraph = node.querySelector("p:last-child");
            return (
              selection?.isCollapsed &&
              lastParagraph?.contains(selection.focusNode) &&
              selection.focusOffset === selection.focusNode?.textContent?.length
            );
          })
        )
        .toBe(true);
    }
    const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
    // Control+Home leaves the macOS caret unchanged. Observe selection consumption before
    // collapsing it, so ProseMirror's delayed focus restore cannot race the following keys.
    await field.press("ControlOrMeta+a");
    await expect(toolbar).toBeVisible();
    await field.press("ArrowLeft");
    await expect(toolbar).toBeHidden();
    await field.press("Shift+ArrowRight");
    await field.press("Shift+ArrowRight");
    await field.press("Shift+ArrowRight");
    await expect.poll(() => field.evaluate(() => window.getSelection()?.toString())).toBe("Sel");
    await expect(toolbar).toBeVisible();

    await toolbar.getByRole("button", { name: "Emoji", exact: true }).click();
    const grid = page.getByRole("grid", { name: "Choose an emoji" });
    await expect(grid).toBeVisible();
    await expect(grid).toBeFocused();
    await grid.getByRole("gridcell", { name: "Fire" }).first().click();

    await expect(grid).toBeHidden();
    await expect(field).toContainText("🔥");
  });
}
