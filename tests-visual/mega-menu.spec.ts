import { expect, test, type Page } from "@playwright/test";

/**
 * Mega menu aim with a real mouse (OLDSUI-256).
 *
 * jsdom does not know geometry, so there menu aim is checked against stubbed
 * rectangles. Here the layout is real, and so is the pointer: the cursor moves
 * diagonally toward the flyout across the neighboring category, then straight
 * down the category column.
 *
 * Steps are taken one per frame with a pause in between: `mouse.move` with `steps`
 * sends its events back to back without pauses, and menu aim, throttled to one
 * event per frame, would see only one of them.
 */

const STORY = "/iframe.html?id=navigation-megamenu--catalog&globals=theme:light;accent:blue";

async function glide(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps
    );
    await page.waitForTimeout(20);
  }
}

async function center(page: Page, name: string) {
  const box = await page.getByRole("button", { name }).boundingBox();
  if (!box) throw new Error(`no box for ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("cutting diagonally across a neighbor to the showcase keeps the showcase", async ({
  page,
}) => {
  await page.goto(STORY);
  const start = await center(page, "Computers");
  await page.mouse.move(start.x, start.y);
  await expect(page.getByRole("button", { name: "Computers" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );

  const showcase = await page.getByRole("region", { name: "Computers" }).boundingBox();
  if (!showcase) throw new Error("the showcase has no box");
  const phones = await page.getByRole("button", { name: "Phones" }).boundingBox();
  if (!phones) throw new Error("no box for Phones");
  // Target: a point in the flyout, reached by a path that crosses the edge of the
  // category column at the height of the "Phones" row, so the cursor grazes it.
  const target = { x: showcase.x + 120, y: phones.y + phones.height / 2 + 60 };
  await glide(page, start, target);

  await expect(page.getByRole("button", { name: "Computers" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.getByRole("button", { name: "Phones" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(page.getByRole("link", { name: "Laptops" })).toBeVisible();
});

test("moving straight down the column switches categories without waiting", async ({ page }) => {
  await page.goto(STORY);
  const start = await center(page, "Computers");
  await page.mouse.move(start.x, start.y);
  const books = await center(page, "Books");
  await glide(page, start, books);

  // Immediately, with no wait for the pointer to stop: the path down does not lead
  // to the flyout, so menu aim never turned on.
  expect(await page.getByRole("button", { name: "Books" }).getAttribute("aria-expanded")).toBe(
    "true"
  );
});

/*
  Dropdown variant near the right edge of the window (OLDSUI-257): the flyout
  switches to the other side of the category column and stays in the window.
  The side is measured when a category opens, not on mount: at that moment Radix
  has not yet positioned the overlay.
*/
test("in the dropdown near the right edge the showcase flips and stays in the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    "/iframe.html?id=navigation-megamenu--dropdown-in-top-bar&globals=theme:light;accent:blue"
  );
  const button = page.getByRole("button", { name: "Catalog" });
  // The button sits at the right edge of the window, as in a top bar with the catalog on the right.
  await button.evaluate((node) => {
    Object.assign((node as HTMLElement).style, { position: "fixed", right: "8px", top: "8px" });
  });
  await button.click();
  await page.getByRole("button", { name: "Computers" }).hover();

  const showcase = await page.getByRole("region", { name: "Computers" }).boundingBox();
  const column = await page.getByRole("button", { name: "Computers" }).boundingBox();
  if (!showcase || !column) throw new Error("no boxes");
  expect(showcase.x).toBeGreaterThanOrEqual(0);
  expect(showcase.x + showcase.width).toBeLessThanOrEqual(1280);
  expect(showcase.x + showcase.width).toBeLessThanOrEqual(column.x + 4);
});

/*
  Dropdown variant at phone width (OLDSUI-262). The Radix wrapper sizes the overlay
  to its content, and without an explicit width the catalog shrank to the longest
  label, changed width when drilling down into a category, and a label without
  spaces pushed it past the edge of the window. Now the overlay spans the full
  width of the window, with no margins at the edges.
*/
test("on a phone the dropdown spans the viewport and keeps its width when drilling down", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    "/iframe.html?id=navigation-megamenu--dropdown-in-top-bar&globals=theme:light;accent:blue"
  );
  await page.getByRole("button", { name: "Catalog" }).click();
  const nav = page.getByRole("navigation", { name: "Catalog" });

  // A long label with no spaces: it used to push the overlay past the edge.
  await page
    .getByRole("button", { name: "Health" })
    .locator("[data-mega-label]")
    .evaluate((node) => {
      node.textContent = "Supercalifragilisticexpialidocious-health-and-personal-care";
    });

  const column = await nav.boundingBox();
  if (!column) throw new Error("no box for the column");
  expect(column.x).toBeGreaterThanOrEqual(8 - 1);
  expect(column.x + column.width).toBeLessThanOrEqual(375 - 8 + 1);
  expect(column.width).toBeGreaterThan(375 - 16 - 2);

  await page.getByRole("button", { name: "Computers" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  const drilled = await nav.boundingBox();
  if (!drilled) throw new Error("no box for the drilled view");
  expect(drilled.width).toBeCloseTo(column.width, 0);
  expect(drilled.x).toBeCloseTo(column.x, 0);
});
