import { expect, test, type Page } from "@playwright/test";

/**
 * A `Menu` submenu opens to the side of its item (OLDSUI-254).
 *
 * react-aria's `SubmenuTrigger` gives the nested popover the place "right, top"
 * (`end top`), but the kit's `Menu` used to always pass its own
 * `placement="bottom start"`, and the explicit prop overrode the context: the submenu
 * opened BELOW the item. Position is geometry, jsdom does not compute it, so the check
 * lives here, against the rectangles of a real browser.
 */

const STORY =
  "/iframe.html?id=overlays-menu--sections-and-submenus&globals=theme:light;accent:blue";

/** Tolerance for the panel's shadow, border and inner padding. */
const TOLERANCE = 4;

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: ReturnType<Page["locator"]>): Promise<Box> {
  const result = await locator.boundingBox();
  if (!result) throw new Error("the element has no bounding box");
  return result;
}

/**
 * Opens the root menu and the "Move to…" submenu, and returns the rectangles of the
 * item and the submenu.
 */
async function openSubmenu(page: Page): Promise<{ item: Box; submenu: Box }> {
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("menu").first()).toBeVisible();

  const item = page.getByRole("menuitem", { name: "Move to…" });
  await item.click();
  const submenu = page.locator('[data-trigger="SubmenuTrigger"]');
  await expect(submenu).toBeVisible();
  // react-aria sets the position after measuring: wait until the popover is placed.
  await expect(submenu).toHaveAttribute("data-placement", /.+/);

  return { item: await box(item), submenu: await box(submenu) };
}

test("on a desktop screen a submenu opens to the right of its item, aligned with its top", async ({
  page,
}) => {
  await page.goto(STORY);
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.x).toBeGreaterThanOrEqual(item.x + item.width - TOLERANCE);
  // The top of the submenu lines up with the top of the item, not below it: the
  // tolerance covers the panel's padding and border.
  expect(Math.abs(submenu.y - item.y)).toBeLessThanOrEqual(16);
  expect(submenu.y).toBeLessThan(item.y + item.height);
});

test("near the right edge of the screen a submenu flips to the left of its item", async ({
  page,
}) => {
  await page.goto(STORY);
  // The button is pinned to the right edge: there is no room for a submenu to the
  // right of the root menu.
  await page.getByRole("button", { name: "View" }).evaluate((node) => {
    node.style.position = "fixed";
    node.style.top = "80px";
    node.style.right = "8px";
  });
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.x + submenu.width).toBeLessThanOrEqual(item.x + TOLERANCE);
  expect(Math.abs(submenu.y - item.y)).toBeLessThanOrEqual(16);
});

test("on a phone width a submenu opens below its item, on top of the parent menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(STORY);
  const { item, submenu } = await openSubmenu(page);

  expect(submenu.y).toBeGreaterThanOrEqual(item.y + item.height - TOLERANCE);
  // Along the cross axis, react-aria keeps the submenu inside the screen.
  expect(submenu.x).toBeGreaterThanOrEqual(0);
  expect(submenu.x + submenu.width).toBeLessThanOrEqual(375);
});
