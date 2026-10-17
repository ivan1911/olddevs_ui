import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Field height in a browser (OLDSUI-123, ADR-0059): what jsdom cannot do, namely
 * real scrolling of the Document area, the Block handle that moves with the text,
 * and dragging the resize handle with the mouse.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

/** The Document area: the nearest ancestor with scrolling. */
function areaOf(field: Locator) {
  return field.locator("xpath=ancestor::div[contains(@class, 'overflow-y-auto')][1]");
}

test("a long Document scrolls inside the frame; the toolbar and the status line stay put", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--scrolling-document"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field).toBeVisible();
  const area = areaOf(field);

  const box = await area.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    scrolls: element.scrollHeight > element.clientHeight,
  }));
  expect(box).toEqual({ height: 320, scrolls: true });

  const toolbar = page.getByRole("toolbar").first();
  const status = page.getByText(/\d+ words/);
  const before = { toolbar: await toolbar.boundingBox(), status: await status.boundingBox() };
  await area.evaluate((element) => element.scrollBy(0, 300));
  await settle(page);
  expect(await toolbar.boundingBox()).toEqual(before.toolbar);
  expect(await status.boundingBox()).toEqual(before.status);
});

test("the block handle moves with its Block when the area scrolls", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--scrolling-document"));
  const field = page.getByRole("textbox", { name: "Document" });
  await field.getByText("A smaller heading").click();
  await settle(page);
  const handle = page.getByRole("button", { name: "Block actions" });
  await expect(handle).toBeVisible();

  const heading = field.getByText("A smaller heading");
  const offset = async () =>
    ((await handle.boundingBox())!.y ?? 0) - ((await heading.boundingBox())!.y ?? 0);
  const before = await offset();
  await areaOf(field).evaluate((element) => element.scrollBy(0, -80));
  await settle(page);
  expect(Math.abs((await offset()) - before)).toBeLessThan(1);
});

test("dragging the height handle resizes the area and keeps the focus on its slider", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--resizable-document"));
  const field = page.getByRole("textbox", { name: "Document" });
  await expect(field).toBeVisible();
  const area = areaOf(field);
  const slider = page.getByRole("slider", { name: "Resize the editor" });
  const strip = slider.locator("xpath=..");
  const grip = (await strip.boundingBox())!;

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 100, { steps: 5 });
  await page.mouse.up();

  const height = await area.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(410);
  expect(height).toBeLessThan(430);
  await expect(slider).toBeFocused();

  await page.keyboard.press("ArrowUp");
  expect(await area.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(
    height - 16,
    0
  );
});
