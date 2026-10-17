import { expect, test } from "@playwright/test";

/**
 * A menu does not spill out of its panel (OLDSUI-147).
 *
 * react-aria sets the popover's height itself, as an inline `max-height` taken from
 * the visible area. On iOS 27 in Safari that height came out at a few pixels: the
 * frame with its shadow collapsed into a strip, and with `overflow: visible` the
 * items were painted over the Document, with no surface behind them. iOS cannot be
 * reproduced here, so the test sets the same tiny height by hand and checks that the
 * items stay inside the panel and scroll within it.
 */

const STORY = "/iframe.html?id=inputs-richtexteditor--table-menu&globals=theme:light;accent:blue";

test("a menu squeezed by a tiny max-height scrolls inside its panel instead of spilling over the page", async ({
  page,
}) => {
  await page.goto(STORY);
  await page.getByRole("textbox", { name: "Document" }).locator("td").first().click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Table" });
  await expect(menu).toBeVisible();

  // As on iOS 27: the menu panel got a height of a couple of lines. The rule uses
  // `!important` rather than an inline style, because react-aria recalculates the
  // position and would overwrite an inline `max-height` with its own.
  const panel = menu.locator("xpath=..");
  await panel.evaluate((node) => node.setAttribute("data-squeezed", ""));
  await page.addStyleTag({ content: "[data-squeezed] { max-height: 48px !important; }" });

  const last = page.getByRole("menuitem", { name: "Delete table" });
  const box = await last.boundingBox();
  if (!box) throw new Error("the last menu item has no box");
  // The item past the panel's edge is clipped: the element at its point on screen is not the item.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('[role="menuitem"]')?.textContent ?? null,
    [box.x + box.width / 2, box.y + box.height / 2] as const
  );
  expect(hit ?? "").not.toContain("Delete table");

  // It can still be scrolled into view within the panel.
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await panel.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});
