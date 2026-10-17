import { expect, test, type Page } from "@playwright/test";

/**
 * Details Block in a browser (OLDSUI-277): what jsdom cannot do, namely the real
 * layout (the content is hidden with `hidden` and takes no space), the native
 * `details` disclosure in the View without JavaScript, the button styles and keyboard focus.
 */

const STORY = (id: string) => `/iframe.html?id=${id}&globals=theme:dark;accent:blue`;

/** Give ProseMirror time to read the caret after a click (as in the Wrapper spec). */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
}

const BUILD = "How to build the package";

// ── Editor ───────────────────────────────────────────────────────────────

test("in the editor a block is closed at first: the content takes no room until the button opens it", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const field = page.getByRole("textbox", { name: "Document" });
  const block = field.locator('div[data-type="details"]').first();
  const toggle = block.getByRole("button", { name: `Details: ${BUILD}` });
  const content = block.locator('div[data-type="detailsContent"]');

  await expect(block).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(content).toBeHidden();
  const closedHeight = (await block.boundingBox())!.height;

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(content).toBeVisible();
  await expect(content).toContainText("Run the gates, then the build.");
  expect((await block.boundingBox())!.height).toBeGreaterThan(closedHeight + 40);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(content).toBeHidden();
  expect((await block.boundingBox())!.height).toBeCloseTo(closedHeight, 0);
});

test("the editor block has a frame, a title without the native marker and a round button", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const block = page.getByRole("textbox", { name: "Document" }).locator('div[data-type="details"]');
  await expect(block.first()).toBeVisible();

  const look = await block.first().evaluate((element) => {
    const css = getComputedStyle(element);
    const summary = getComputedStyle(element.querySelector("summary")!);
    const button = element.querySelector("button")!.getBoundingClientRect();
    return {
      border: `${css.borderTopStyle} ${css.borderTopWidth}`,
      padding: `${css.paddingTop} ${css.paddingLeft}`,
      marker: summary.listStyleType,
      weight: summary.fontWeight,
      button: `${Math.round(button.width)}x${Math.round(button.height)}`,
    };
  });
  expect(look).toEqual({
    border: "solid 1px",
    padding: "8px 12px",
    marker: "none",
    weight: "500",
    button: "24x24",
  });
});

test("the title is edited as text; Enter in an open block goes into the content", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const field = page.getByRole("textbox", { name: "Document" });
  const block = field.locator('div[data-type="details"]').first();

  await block.getByRole("button", { name: `Details: ${BUILD}` }).click();
  await block.locator("summary").click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.type(" quickly");
  await expect(block.locator("summary")).toHaveText(`${BUILD} quickly`);
  // The button's name follows the title.
  await expect(block.getByRole("button", { name: `Details: ${BUILD} quickly` })).toBeVisible();

  await page.keyboard.press("Enter");
  await page.keyboard.type("First line");
  await expect(block.locator('div[data-type="detailsContent"] > p').first()).toHaveText(
    "First line"
  );
  await expect(block.locator("summary")).toHaveText(`${BUILD} quickly`);
});

test("Enter in the title of a closed block adds a paragraph below the block, not inside", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const field = page.getByRole("textbox", { name: "Document" });
  const block = field.locator('div[data-type="details"]').first();

  await block.locator("summary").click();
  await page.keyboard.press("End");
  await settle(page);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Below");
  await expect(block).not.toContainText("Below");
  await expect(field.locator(":scope > p", { hasText: "Below" })).toHaveCount(1);
});

test("from the keyboard: Tab reaches the button, Enter and Space open and close, focus stays", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const field = page.getByRole("textbox", { name: "Document" });
  const toggle = field.getByRole("button", { name: `Details: ${BUILD}` });
  const content = field.locator('div[data-type="detailsContent"]').first();

  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(content).toBeVisible();
  // Enter did not split the line or leave focus in the Document: the button is still at hand.
  await expect(toggle).toBeFocused();
  await expect(field.locator("summary").first()).toHaveText(BUILD);

  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(content).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("a caret above the block reaches its title with the arrow, never the hidden content", async ({
  page,
}) => {
  await page.goto(STORY("inputs-richtexteditor--details"));
  const field = page.getByRole("textbox", { name: "Document" });
  const block = field.locator('div[data-type="details"]').first();

  await field.getByText("A block keeps its details under a title.").click();
  await page.keyboard.press("End");
  // The browser reports the caret move a frame or two later, and the Editor then writes its own
  // selection back to the DOM: an arrow pressed before that is undone. Wait for both.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const timer = setTimeout(done, 300);
        document.addEventListener(
          "selectionchange",
          () => {
            clearTimeout(timer);
            setTimeout(done, 100);
          },
          { once: true }
        );
      })
  );
  await settle(page);
  // The button is not editable, so the caret does not stop on it: one arrow reaches the title.
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await page.keyboard.type("~");
  await expect(block.locator("summary")).toContainText("~");
  await expect(block.locator('div[data-type="detailsContent"]')).not.toContainText("~");
});

test("with persist the saved open block is open and the closed one is not", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--details-persist"));
  const field = page.getByRole("textbox", { name: "Document" });

  const open = field.getByRole("button", { name: "Details: Open when saved" });
  const closed = field.getByRole("button", { name: "Details: Closed when saved" });
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(field.getByText("This block is saved open.")).toBeVisible();
  await expect(closed).toHaveAttribute("aria-expanded", "false");
  await expect(field.getByText("This one is saved closed.")).toBeHidden();

  await closed.click();
  await expect(closed).toHaveAttribute("aria-expanded", "true");
  await expect(field.getByText("This one is saved closed.")).toBeVisible();
});

test("an inserted block is open with the caret in the empty title", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--details-inserted"));
  const field = page.getByRole("textbox", { name: "Document" });
  const block = field.locator('div[data-type="details"]');

  await expect(block).toBeVisible();
  await expect(block.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(block.locator('div[data-type="detailsContent"]')).toBeVisible();

  await page.keyboard.type("Title");
  await expect(block.locator("summary")).toHaveText("Title");
});

// ── View ─────────────────────────────────────────────────────────────────

test("RichTextView opens and closes a block natively, from the mouse and the keyboard", async ({
  page,
}) => {
  await page.goto(STORY("content-richtextview--details"));
  const first = page.locator("details").first();
  const summary = first.locator(":scope > summary");
  const content = first.locator(':scope > div[data-type="detailsContent"]');

  // No engine here: no button and no `role`, just the browser's native element.
  await expect(first.getByRole("button")).toHaveCount(0);
  await expect(first).not.toHaveAttribute("open", /.*/);
  await expect(content).toBeHidden();

  await summary.click();
  await expect(first).toHaveAttribute("open", "");
  await expect(content).toBeVisible();
  await summary.click();
  await expect(first).not.toHaveAttribute("open", /.*/);

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(content).toBeVisible();
  await page.keyboard.press("Space");
  await expect(content).toBeHidden();
});

test("RichTextView shows a block saved with open already open, and a nested one closed", async ({
  page,
}) => {
  await page.goto(STORY("content-richtextview--details"));
  const checklist = page.locator("details").nth(1);
  await expect(checklist).toHaveAttribute("open", "");
  await expect(checklist.getByText("Write the changelog")).toBeVisible();
  const nested = checklist.locator("details");
  await expect(nested).not.toHaveAttribute("open", /.*/);
  await expect(nested.getByText("Revert the tag")).toBeHidden();
});

/** The frame and title of a Block: what must match in the Editor and the View. */
const look = (element: Element) => {
  const css = getComputedStyle(element);
  const summary = getComputedStyle(element.querySelector("summary")!);
  return {
    border: `${css.borderTopStyle} ${css.borderTopWidth} ${css.borderTopColor}`,
    radius: css.borderTopLeftRadius,
    padding: `${css.paddingTop} ${css.paddingLeft}`,
    weight: summary.fontWeight,
  };
};

test("a block looks the same in the editor and in the view: frame and title", async ({ page }) => {
  await page.goto(STORY("inputs-richtexteditor--details-persist"));
  const inEditor = await page
    .getByRole("textbox", { name: "Document" })
    .locator('div[data-type="details"]')
    .first()
    .evaluate(look);

  await page.goto(STORY("content-richtextview--details"));
  const inView = await page.locator("details").first().evaluate(look);

  expect(inEditor).toEqual(inView);
  expect(inView.border).toMatch(/^solid 1px rgb/);
});

test("the blocks inside the content keep the spacing of the document", async ({ page }) => {
  await page.goto(STORY("content-richtextview--details"));
  const checklist = page.locator("details").nth(1);
  // The list above the nested Block is not the last child of the content: the gap is
  // the same as between Blocks.
  const gap = await checklist
    .locator(':scope > div[data-type="detailsContent"] > ul')
    .evaluate((element) => getComputedStyle(element).marginBottom);
  expect(gap).toBe("12px");
});
