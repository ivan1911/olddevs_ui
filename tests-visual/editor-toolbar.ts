import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Keyboard path to a button on the Editor's Toolbar: `Alt+F10` from the document,
 * then `Home` and `→` until focus lands on the button named `name`.
 *
 * It is the same path a keyboard-only user takes, but the number of steps is not
 * hard-coded. Scenarios used to count "fourth from the end" and "seventh", and every
 * reordering of the Toolbar (the "…" menu, the OLDSUI-66 layout) broke them without
 * touching the behavior under test. Now the row can be reordered: the scenario
 * looks the button up by name.
 */
export async function focusToolbarButton(page: Page, name: string): Promise<Locator> {
  const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
  const button = toolbar.getByRole("button", { name, exact: true });
  await page.keyboard.press("Alt+F10");
  await expect(toolbar.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Home");
  const count = await toolbar.getByRole("button").count();
  for (let step = 0; step < count; step++) {
    if (await button.evaluate((node) => node === document.activeElement)) return button;
    await page.keyboard.press("ArrowRight");
  }
  throw new Error(`no toolbar button named "${name}" on the keyboard path`);
}
