import { expect, test, type Page } from "@playwright/test";

/**
 * Editor Skeleton in a browser (OLDSUI-110, ADR-0058, item 11.4): what jsdom cannot
 * do, namely the layout. The Skeleton and the engine draw the Document with one
 * rhythm and one frame, so the engine replacing the Skeleton moves neither the field
 * height nor the text. Roles, the Handle, `onReady` and "Retry" are checked in
 * `tests/rich-text-editor-loaders.test.tsx`.
 */

const STORY = "/iframe.html?id=inputs-richtexteditor--tool-loader&globals=theme:dark;accent:blue";

/**
 * The field height and the positions of Document lines that exist in both the Skeleton
 * and the engine.
 */
async function layout(page: Page) {
  const field = page.locator("[data-story-field]");
  const box = await field.boundingBox();
  const line = async (text: string) => (await field.getByText(text).boundingBox())?.y;
  return {
    height: box?.height,
    heading: await line("Loading a tool"),
    aside: await line("An aside: its block comes from a lazily loaded tool."),
    last: await line("The height of the field does not jump."),
  };
}

test("the engine replaces the Skeleton without a height jump", async ({ page }) => {
  await page.goto(STORY);
  const field = page.locator("[data-story-field]");
  await expect(
    field.getByText("An aside: its block comes from a lazily loaded tool.")
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Document" })).toHaveCount(0);
  const skeleton = await layout(page);

  await page.getByRole("button", { name: "Finish loading" }).click();
  await expect(page.getByRole("textbox", { name: "Document" })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();

  expect(await layout(page)).toEqual(skeleton);
});

test("a failed loader keeps the Document; Retry brings the engine", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("button", { name: "Fail loading" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "The editor couldn't start. The document is unchanged."
  );
  await expect(page.getByText("The height of the field does not jump.")).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByRole("button", { name: "Finish loading" }).click();
  await expect(page.getByRole("textbox", { name: "Document" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
