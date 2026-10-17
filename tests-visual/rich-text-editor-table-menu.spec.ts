import { expect, test } from "@playwright/test";
import { focusToolbarButton } from "./editor-toolbar.js";

/**
 * Editor "Table" menu in a browser (OLDSUI-45): what jsdom cannot do.
 *
 * A react-aria menu inside a Radix dialog does not open in jsdom: the dialog's focus
 * trap sends focus back (`tests/rich-text-editor-toolbar.test.tsx`). So the overlay
 * layer stack of ADR-0041 is checked here, with a real `Dialog`: the submenu, the size
 * grid, and Escape one layer at a time.
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("inside a Dialog: the keyboard reaches the size grid, picks a size, and focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // The name is required: the react-aria submenu is also a `role="dialog"` ("Table").
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(dialog).toBeVisible();
  await field.click();
  // The pointer moves off the field: the grid follows hover, and the submenu may open
  // right under it (this happened when "…" shortened the Toolbar row, OLDSUI-65).
  await page.mouse.move(0, 0);

  // Alt+F10 moves focus into the Toolbar, then arrow keys to "Table ▾".
  await expect(await focusToolbarButton(page, "Table")).toBeFocused();

  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Table" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();

  // → opens the submenu with the grid; focus moves into the grid once the submenu is
  // placed, and the menu beneath it stays open.
  await page.keyboard.press("ArrowRight");
  const grid = page.getByRole("grid", { name: "Table size" });
  await expect(grid).toBeFocused();
  await expect(menu).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status").filter({ hasText: "columns" })).toHaveText(
    "4 columns, 4 rows"
  );
  await page.keyboard.press("Enter");

  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field.locator("tr")).toHaveCount(4);
  await expect(field.locator("tr").first().locator("th")).toHaveCount(4);
  await expect(field).toBeFocused();
});

/*
  Focus moves into the grid on a signal from the popover (the position is computed and
  the entrance animation has finished), not on a timer. The check runs with animation
  on and the CPU slowed six times: on such a device the old 50 ms was a race.
*/
test.describe("with motion and a slow CPU", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("inside a Dialog: → still lands in the size grid and keeps the menu open", async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.goto(STORY("inside-dialog"));
    const field = page.getByRole("textbox", { name: "Document" });
    await field.click();
    // The pointer moves off the field: the grid follows hover, and the submenu may open
    // right under it (this happened when "…" shortened the Toolbar row, OLDSUI-65).
    await page.mouse.move(0, 0);

    await page.getByRole("button", { name: "Table", exact: true }).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Table" });
    await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();
    await expect(menu).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(field.locator("tr")).toHaveCount(3);
    await expect(field).toBeFocused();
  });
});

test("inside a Dialog: Escape closes the grid, then the menu, then the window — one layer at a time", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // The name is required: the react-aria submenu is also a `role="dialog"` ("Table").
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  await page.getByRole("textbox", { name: "Document" }).click();

  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("grid")).toBeHidden();
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeFocused();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(dialog).toBeVisible();

  // Focus returned to "Table ▾", and the button, reached by keyboard, opened its tooltip,
  // which is a layer too (ADR-0041): Escape dismisses the tooltip first.
  await expect(page.getByRole("button", { name: "Table", exact: true })).toBeFocused();
  const tooltip = page.getByRole("tooltip", { name: "Table" });
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("inside a Dialog: → and ← walk the Row submenu, Escape closes only the submenu", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  // The name is required: the react-aria submenu is also a `role="dialog"` ("Table").
  const dialog = page.getByRole("dialog", { name: "Edit the note" });
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();
  // The mouse pointer moves off the field: the path is by keyboard, and after the Toolbar
  // was rearranged (OLDSUI-64) the "Table" menu opens right under the click point, so
  // hovering would open a neighboring submenu as soon as `←` closes "Row".
  await page.mouse.move(0, 0);

  // First the table, by keyboard, through the grid: the kit's menu items inside the
  // `Dialog` are not clicked with the mouse here (clicking them inside the window is a
  // separate task for the kit), so the 3×3 grid is used as is.
  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("grid", { name: "Table size" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field.locator("tr")).toHaveCount(3);
  await expect(field).toBeFocused();

  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Row" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const row = page.getByRole("menu", { name: "Row" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Insert row above" })).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(row).toBeHidden();
  await expect(page.getByRole("menuitem", { name: "Row" })).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(row).toBeHidden();
  await expect(page.getByRole("menu", { name: "Table" })).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(field.locator("tr")).toHaveCount(4);
  await expect(field).toBeFocused();
});

test("Insert table… opens a window over the Dialog; Enter inserts, focus returns to the document", async ({
  page,
}) => {
  await page.goto(STORY("inside-dialog"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.click();

  // "Insert table…" is the second item; by keyboard, not by mouse (see above).
  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Insert table…" })).toBeFocused();
  await page.keyboard.press("Enter");
  const insert = page.getByRole("dialog", { name: "Insert table" });
  await expect(insert).toBeVisible();
  const columns = insert.getByRole("textbox", { name: "Columns" });
  await expect(columns).toBeFocused();

  await columns.fill("12");
  await insert.getByRole("textbox", { name: "Rows" }).fill("30");
  await page.keyboard.press("Enter");

  await expect(insert).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Edit the note" })).toBeVisible();
  await expect(field.locator("tr")).toHaveCount(30);
  await expect(field.locator("tr").first().locator("th")).toHaveCount(12);
  await expect(field).toBeFocused();
});
