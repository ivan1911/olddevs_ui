import { expect, test } from "@playwright/test";

test("PromptInput: keyboard, composition and editable next drafts", async ({ page }) => {
  await page.goto("/iframe.html?id=inputs-promptinput--playground&globals=theme:dark;accent:blue");
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("A question");
  await field.press("Shift+Enter");
  await expect(field).toHaveValue("A question\n");
  await field.press("Enter");
  await expect(page.locator("output")).toHaveText("A question\n");
  await field.fill("Composing text");
  await field.dispatchEvent("compositionstart");
  await field.press("Enter");
  await field.dispatchEvent("compositionend");
  await field.dispatchEvent("keydown", { key: "Enter", keyCode: 229 });
  await expect(page.locator("output")).toHaveText("A question\n");
  await page.goto("/iframe.html?id=inputs-promptinput--next-draft&globals=theme:dark;accent:blue");
  await field.fill("The next editable draft");
  await field.press("Enter");
  await expect(field).toHaveValue("The next editable draft");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expect(page.locator("output")).toBeEmpty();
});

test("ChatTranscript: growth, manual reading, disclosure, resize and explicit return preserve the reading contract", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=content-chattranscript--reading-history&globals=theme:dark;accent:blue"
  );
  const region = page.getByRole("region", { name: "Conversation" });
  const bottomGap = () =>
    region.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight);
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "Grow answer" }).click();
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "Resize viewport" }).click();
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await region.hover();
  await page.mouse.wheel(0, -8);
  const latest = page.getByRole("button", { name: "Return to latest" });
  await expect(latest).toBeVisible();
  const nearBottomPosition = await region.evaluate((node) => node.scrollTop);
  await page.getByRole("button", { name: "Grow answer" }).click();
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(nearBottomPosition);
  await latest.click();
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await region.hover();
  await page.mouse.wheel(0, -500);
  await expect(latest).toBeVisible();
  const readingPosition = await region.evaluate((node) => node.scrollTop);
  await page.getByRole("button", { name: "Grow answer" }).click();
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(readingPosition);
  const summary = page.getByText("Details for message 19", { exact: true });
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await summary.press("Enter");
  await expect(summary).toBeFocused();
  await expect(latest).toBeVisible();
  await latest.focus();
  await latest.press("Enter");
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await expect(region).toBeFocused();
});

test("basic chat recipe: one ordered response and reset without a backend", async ({ page }) => {
  await page.goto("/iframe.html?id=recipes-chat--basic-text-chat&globals=theme:light;accent:blue");
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("Help me plan");
  await field.press("Enter");
  await field.press("Enter");
  await expect(page.getByRole("article")).toHaveCount(1);
  await field.fill("Next draft");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Complete response" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(field).toHaveValue("Next draft");
  const articles = page.getByRole("article");
  await expect(articles.nth(0)).toContainText("16:54");
  await expect(articles.nth(1)).toContainText("16:50");
  await page.getByRole("button", { name: "Reset chat" }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(field).toHaveValue("");
});

test.describe("touch message submission", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("a visible Send button submits without needing a hardware Enter key", async ({ page }) => {
    await page.goto("/iframe.html?id=recipes-chat--basic-text-chat&globals=theme:dim;accent:blue");
    await page.getByRole("textbox", { name: "Message" }).fill("A touch question");
    await page.getByRole("button", { name: "Send", exact: true }).tap();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("A touch question");
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
});
