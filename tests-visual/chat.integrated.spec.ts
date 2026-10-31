import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { RUSSIAN_TEXT } from "../.storybook/recipes/integratedFixtures.js";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function start(page: Page, story = "playground", theme = "light") {
  await page.goto(
    `/iframe.html?id=recipes-integratedchat--${story}&globals=theme:${theme};accent:blue`
  );
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
}
async function send(page: Page, text = "Plan a visit") {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
}
async function grow(page: Page, count = 12) {
  await button(page, "Append Markdown fragment").evaluate((node, count) => {
    for (let index = 0; index < count; index++) (node as HTMLButtonElement).click();
  }, count);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

test("growing Markdown, old source disclosure and voice-panel resize preserve manual reading and explicit return restores follow", async ({
  page,
}) => {
  await start(page, "reading-history");
  await button(page, "Simulation events").click();
  await send(page);
  await grow(page, 3);
  await button(page, "Start operations").click();
  await button(page, "Resolve operations").click();
  await button(page, "Complete response").click();
  await send(page, "Continue the same history");
  await grow(page);
  const viewport = page.getByRole("region", { name: "Conversation", exact: true });
  const source = button(page, "Planning guide excerpt");
  await source.focus();
  await source.press("Enter");
  await expect(source).toHaveAttribute("aria-expanded", "true");
  await expect(button(page, "Return to latest")).toBeVisible();
  const top = await viewport.evaluate((node) => node.scrollTop);
  await grow(page);
  await expect(source).toBeFocused();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(top);
  await button(page, "Expand voice panel").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(source).toBeFocused();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(top);
  const back = button(page, "Return to latest");
  await back.focus();
  await back.press("Enter");
  await expect(viewport).toBeFocused();
  await expect(back).toHaveCount(0);
  await grow(page, 3);
  await expect
    .poll(() =>
      viewport.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))
    )
    .toBeLessThanOrEqual(1);
  await button(page, "Collapse voice panel").evaluate((node) =>
    (node as HTMLButtonElement).click()
  );
  await expect
    .poll(() =>
      viewport.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))
    )
    .toBeLessThanOrEqual(1);
  // A real upward scroll must win even when the next stream update arrives immediately.
  const manualTop = await viewport.evaluate((node) => {
    node.scrollTop -= 3;
    return node.scrollTop;
  });
  await grow(page, 3);
  await expect(button(page, "Return to latest")).toBeVisible();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(manualTop);
});

test("accepting in ready voice gates duplicates and preserves edits; reset restores logical focus and rejects stale events", async ({
  page,
}) => {
  await start(page);
  await button(page, "Simulation events").click();
  await button(page, "Start voice").click();
  await button(page, "Connection ready").click();
  await page.getByText("Hold acceptance", { exact: true }).click();
  await send(page, "First request");
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("A newer draft");
  await field.press("Enter");
  await expect(page.getByRole("article")).toHaveCount(0);
  await button(page, "Accept send").click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(field).toHaveValue("A newer draft");
  await button(page, "Stop response").click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await send(page, "Another request");
  await button(page, "Reset chat").click();
  await expect(field).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(field).toHaveValue("");
});

test("reply retry preserves completed operations and code copy uses original whitespace", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await button(page, "Simulation events").click();
  await send(page);
  await grow(page, 3);
  await button(page, "Start operations").click();
  await button(page, "Resolve operations").click();
  const code = page.getByRole("article", { name: "Assistant" }).locator("pre").locator("../..");
  await code.getByRole("button", { name: "Copy", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("  const plan = 'one step';\n\n  // Keep the original whitespace.");
  await button(page, "Fail response").click();
  await button(page, "Retry response").click();
  await expect(page.getByText("Operation runs: 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Search guidance · Complete/ })).toHaveCount(1);
});

test("bubble boundary history retains explicit order and groups only adjacent known authors within five minutes", async ({
  page,
}) => {
  await start(page, "bubble-boundaries");
  const messages = page.getByRole("article");
  await expect(messages).toHaveCount(7);
  expect(
    await messages.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-group-position"))
    )
  ).toEqual(["first", "middle", "last", "single", "single", "single", "single"]);
  const widths = await messages.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().width)
  );
  expect(widths.every((width) => width < 500)).toBe(true);
});

for (const theme of ["light", "dark", "dim"])
  test(`long Russian messages keep a reading viewport and available controls at 320px in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await start(page, "narrow", theme);
    await button(page, "Expand voice panel").click();
    const field = page.getByRole("textbox", { name: "Message" });
    await field.fill(RUSSIAN_TEXT.repeat(3));
    await expect(field).toBeVisible();
    await expect(button(page, "Send")).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("region", { name: "Conversation", exact: true })
          .evaluate((node) => node.clientHeight)
      )
      .toBeGreaterThan(60);
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
    await expect(button(page, "Collapse voice panel")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`narrow-${theme}.png`), fullPage: true });
  });

test.describe("integrated voice on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("interim speech, text interruption, mute and End keep one usable conversation", async ({
    page,
  }) => {
    await start(page);
    await button(page, "Simulation events").tap();
    await button(page, "Start voice").tap();
    await button(page, "Connection ready").tap();
    await button(page, "Show interim transcript").tap();
    await button(page, "Finalize transcript").tap();
    await grow(page, 2);
    await page.getByRole("textbox").fill("Continue by text");
    await button(page, "Send").tap();
    await expect(page.getByText("Response interrupted", { exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(3);
    await button(page, "Mute microphone").tap();
    await expect(page.getByText("Connection: Ready", { exact: true })).toBeVisible();
    await button(page, "End voice").tap();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByRole("textbox")).toBeFocused();
    await button(page, "Simulation events").tap();
    await button(page, "Expand voice panel").tap();
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
});

test("completing a long partial link can shrink content immediately after Return without falsely pausing follow", async ({
  page,
}) => {
  await start(page, "reading-history");
  await button(page, "Simulation events").click();
  await send(page);
  await button(page, "Append unfinished link").click();
  const viewport = page.getByRole("region", { name: "Conversation", exact: true });
  await expect
    .poll(() =>
      viewport.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))
    )
    .toBeLessThanOrEqual(1);
  await viewport.evaluate((node) => {
    node.scrollTop -= 30;
  });
  const back = button(page, "Return to latest");
  await expect(back).toBeVisible();
  await back.focus();
  await back.press("Enter");
  await button(page, "Close link").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(page.getByRole("link", { name: "Short link", exact: true })).toHaveCount(1);
  await expect
    .poll(() =>
      viewport.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))
    )
    .toBeLessThanOrEqual(1);
  await expect(back).toHaveCount(0);
  await expect(viewport).toBeFocused();
});

for (const theme of ["light", "dark", "dim"])
  test(`populated integrated errors, operations and voice remain accessible in ${theme}`, async ({
    page,
  }, testInfo) => {
    await start(page, "playground", theme);
    await button(page, "Simulation events").click();
    await button(page, "Start voice").click();
    await button(page, "Connection ready").click();
    await button(page, "Show interim transcript").click();
    await button(page, "Finalize transcript").click();
    await grow(page, 3);
    await button(page, "Start operations").click();
    await button(page, "Resolve operations").click();
    await page.getByRole("button", { name: "Check availability · Error", exact: true }).click();
    await button(page, "Planning guide excerpt").click();
    await button(page, "Expand voice panel").click();
    await button(page, "Connection failed").click();
    await button(page, "Simulation events").click();
    await page.mouse.move(0, 0);
    expect(
      (await new AxeBuilder({ page }).include("#storybook-root").analyze()).violations
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`populated-${theme}.png`), fullPage: true });
  });
