import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, theme = "light", story = "operations-and-sources") {
  await page.goto(
    `/iframe.html?id=recipes-tools-and-sources--${story}&globals=theme:${theme};accent:blue`
  );
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("Find planning guidance");
  await field.press("Enter");
  await page.getByRole("button", { name: "Start operations" }).click();
  await page.getByRole("button", { name: "Resolve operations" }).click();
}
async function grow(page: Page) {
  await page.getByRole("button", { name: "Append answer chunk" }).evaluate((button) => {
    for (let i = 0; i < 25; i++) (button as HTMLButtonElement).click();
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

test("RAC keyboard disclosure pauses following before resize and preserves focus during growth", async ({
  page,
}) => {
  await start(page);
  await grow(page);
  const region = page.getByRole("region", { name: "Conversation", exact: true });
  const disclosure = page.getByRole("button", { name: "Planning guide excerpt" });
  await region.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByRole("button", { name: "Return to latest" })).toHaveCount(0);
  await disclosure.evaluate((node) => node.focus({ preventScroll: true }));
  await expect(page.getByRole("button", { name: "Return to latest" })).toHaveCount(0);
  await disclosure.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Return to latest" })).toBeVisible();
  const position = await region.evaluate((node) => node.scrollTop);
  await grow(page);
  await expect(disclosure).toBeFocused();
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(position);
  await page.getByRole("button", { name: "Return to latest" }).click();
  await expect(region).toBeFocused();
  await expect(page.getByRole("button", { name: "Return to latest" })).toHaveCount(0);
  await region.press("Home");
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(0);
  const operation = page.getByRole("button", { name: "Search guidance · Complete" });
  await operation.focus();
  await operation.press("Space");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  const paused = await region.evaluate((node) => node.scrollTop);
  await grow(page);
  await expect(operation).toBeFocused();
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(paused);
});

for (const theme of ["light", "dark", "dim"]) {
  test(`tools and sources ${theme} accessible snapshot`, async ({ page }) => {
    await start(page, theme);
    await page.getByRole("button", { name: "Check availability · Error" }).click();
    await page.getByRole("button", { name: "Planning guide excerpt" }).click();
    await page.getByRole("button", { name: "Complete response" }).click();
    expect(
      (await new AxeBuilder({ page }).include("#storybook-root").analyze()).violations
    ).toEqual([]);
    await page.getByRole("region", { name: "Conversation", exact: true }).evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(`chat-tools-${theme}.png`);
  });
}

test.describe("tools and sources on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("source disclosure and link stay distinct on a narrow screen", async ({ page }) => {
    await start(page, "dim");
    const disclosure = page.getByRole("button", { name: "Planning guide excerpt" });
    await disclosure.tap();
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText("Review your goals and select one achievable next step.", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Planning guide" })).toHaveAttribute(
      "href",
      "https://example.com/planning"
    );
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
});

test("an empty source list adds no source heading or cards", async ({ page }) => {
  await start(page, "light", "without-sources");
  await expect(page.getByRole("region", { name: "Sources", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sources", exact: true })).toHaveCount(0);
});
