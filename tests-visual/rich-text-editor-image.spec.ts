import { expect, test, type Page } from "@playwright/test";

/**
 * Editor images in a browser (OLDSUI-44): what jsdom cannot do, namely dragging
 * in a file, the width handles with the mouse, and the `figure` layout.
 *
 * The story uploader is a stub: it "uploads" for a second and a half, then returns
 * the address of a showcase image (`ImageUploadSuccess`) or a failure
 * (`ImageUploadFailure`).
 */

const STORY = (id: string) => `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark`;

/** Drag a PNG "file" onto the field: the `DataTransfer` is built in the page. */
async function dropImageFile(page: Page, name: string) {
  const field = page.getByRole("textbox", { name: "Document" });
  const box = (await field.boundingBox())!;
  const dataTransfer = await page.evaluateHandle((fileName) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], fileName, { type: "image/png" })
    );
    return transfer;
  }, name);
  const point = { clientX: box.x + 40, clientY: box.y + box.height - 12 };
  await field.dispatchEvent("dragenter", { dataTransfer, ...point });
  await field.dispatchEvent("dragover", { dataTransfer, ...point });
  await field.dispatchEvent("drop", { dataTransfer, ...point });
}

test("RichTextEditor image: a dropped file shows a placeholder, then the image", async ({
  page,
}) => {
  await page.goto(STORY("image-upload-success"));
  const field = page.getByRole("textbox", { name: "Document" });

  await dropImageFile(page, "photo.png");

  await expect(field.locator("[data-image-upload]")).toContainText("Uploading photo.png");
  await expect(page.getByRole("status")).toHaveText("Uploading photo.png…");
  // While the upload is in progress, there is no image in the Document yet.
  await expect(field.locator("figure img")).toHaveCount(0);

  await expect(field.locator("figure img")).toHaveCount(1, { timeout: 5000 });
  await expect(field.locator("[data-image-upload]")).toHaveCount(0);
  await expect(field.locator("figure img")).toHaveAttribute("src", /^https?:\/\//);
});

test("RichTextEditor image: a failed upload leaves the document and shows an alert", async ({
  page,
}) => {
  await page.goto(STORY("image-upload-failure"));
  const field = page.getByRole("textbox", { name: "Document" });

  await dropImageFile(page, "photo.png");

  await expect(page.getByRole("alert")).toHaveText(
    "Couldn't upload photo.png. The document is unchanged.",
    { timeout: 5000 }
  );
  await expect(field.locator("[data-image-upload]")).toHaveCount(0);
  await expect(field.locator("figure")).toHaveCount(0);
});

test("RichTextEditor image: the resize handle snaps the width to a preset", async ({ page }) => {
  await page.goto(STORY("images"));
  const field = page.getByRole("textbox", { name: "Document" });
  const figure = field.locator("figure").first();
  const img = figure.locator("img");
  await expect(img).toHaveAttribute("data-width", "75");

  // A click selects the image: its toolbar and handles appear.
  await img.click();
  await expect(page.getByRole("toolbar", { name: "Image" })).toBeVisible();
  const handle = figure.locator('[data-resize-handle="right"]');
  await expect(handle).toBeVisible();

  // Drag the right handle to the left: the image is centered, its width changes by
  // twice the shift and snaps to the nearest preset.
  const start = (await handle.boundingBox())!;
  const fieldBox = (await field.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x - fieldBox.width * 0.13, start.y + start.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(img).toHaveAttribute("data-width", "50");
  // The Document keeps only the preset, with no `style` left over from the drag.
  await expect(figure).not.toHaveAttribute("style", /width/);
});

test("RichTextEditor image: Escape in the image popover closes the popover only", async ({
  page,
}) => {
  await page.goto(STORY("image-by-address"));
  const popover = page.getByRole("dialog", { name: "Image" });
  await expect(popover).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Image address" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(popover).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Document" })).toBeFocused();
});
