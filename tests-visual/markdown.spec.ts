import { expect, test, type Page } from "@playwright/test";

async function openStory(page: Page, name: string) {
  await page.goto(`/iframe.html?id=content-markdownview--${name}&globals=theme:dark;accent:blue`);
  await page.locator("body.sb-show-main").waitFor({ state: "attached" });
}

test("Markdown copy uses semantic code rather than highlight decoration", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openStory(page, "custom-highlight");
  const copy = page.getByRole("button", { name: "Copy", exact: true });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("  <b>& hello</b>\n\n");
});

test("partial updates retain control focus and settle into an inert copyable code block", async ({
  page,
}) => {
  await openStory(page, "streaming-fragments");
  const next = page.getByRole("button", { name: "Next fragment" });
  await next.click();
  await expect(page.getByText("Read [the docs", { exact: true })).toBeVisible();
  await expect(next).toBeFocused();
  await next.click();
  await expect(page.getByRole("link")).toHaveAttribute("href", "https://exam");
  await next.click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await next.click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Markdown table" })).toHaveAttribute(
    "tabindex",
    "0"
  );
  await next.click();
  await expect(page.locator("#storybook-root pre")).toHaveText("const value = 1");
  await next.click();
  await expect(page.locator("#storybook-root pre")).toHaveText("const value = 12;\n");
  await expect(next).toBeFocused();
});

test("unsupported HTML, image and diagram inputs cannot cause remote image requests", async ({
  page,
}) => {
  const imageRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("image.example")) imageRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openStory(page, "unsupported-content");
  await expect(
    page.locator(
      "#storybook-root img, #storybook-root script, #storybook-root iframe, #storybook-root math"
    )
  ).toHaveCount(0);
  await expect(page.locator("#storybook-root a[href]")).toHaveCount(0);
  await expect(page.getByText("[Image: A remote chart]", { exact: true })).toBeVisible();
  await expect(page.locator("#storybook-root pre")).toHaveText("graph TD; A-->B");
  expect(imageRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("wide tables and code remain readable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStory(page, "wide-content");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  const tableRegion = page.getByRole("region", { name: "Markdown table" });
  expect(await tableRegion.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  // Column names wrap at words, not into a tall stack of individual letters.
  expect((await page.getByRole("columnheader").first().boundingBox())!.height).toBeLessThan(80);
  await tableRegion.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => tableRegion.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
