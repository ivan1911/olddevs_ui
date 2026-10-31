import { expect, test } from "@playwright/test";

test("the reading recipe keeps document scrolling outside the bounded history", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=recipes-chat--reading-during-stream&globals=theme:light;accent:blue"
  );
  await page.getByRole("textbox", { name: "Message" }).waitFor();
  await expect
    .poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight))
    .toBeLessThanOrEqual(0);
});

test("stream stop, copy and retry remain keyboard accessible without duplicating the user message", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/iframe.html?id=recipes-chat--streaming-response&globals=theme:dark;accent:blue"
  );
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("Help me plan");
  await field.press("Enter");
  await page.getByRole("button", { name: "Append response chunk" }).click();
  await field.fill("The next draft");
  await field.press("Enter");
  await expect(page.getByRole("article")).toHaveCount(2);
  const stop = page.getByRole("button", { name: "Stop response" });
  await stop.focus();
  await stop.press("Enter");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("The next draft");
  const partial = page.getByRole("article", { name: "Assistant", exact: true }).first();
  await expect(partial).toContainText("Response interrupted");
  const copy = partial.getByRole("button", { name: "Copy", exact: true });
  await copy.focus();
  await copy.press("Enter");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("A clear plan begins with one small step. ");
  const retry = page.getByRole("button", { name: "Retry response" });
  await retry.focus();
  await retry.press("Enter");
  await expect(field).toBeFocused();
  await page.getByRole("button", { name: "Append response chunk" }).click();
  await page.getByRole("button", { name: "Complete response" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("article", { name: "You", exact: true })).toHaveCount(1);
  await expect(partial).toContainText("Response interrupted");
  await expect(page.getByRole("button", { name: "Retry response" })).toHaveCount(0);
});

test("acceptance failure and delay preserve draft edits and prevent duplicate accepted turns", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=recipes-chat--streaming-response&globals=theme:light;accent:blue"
  );
  const field = page.getByRole("textbox", { name: "Message" });
  await page.getByText("Fail next send", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Fail next send" })).toBeChecked();
  await field.fill("Preserve this draft");
  await field.press("Enter");
  await expect(field).toHaveValue("Preserve this draft");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByText("Send failed. Your draft is preserved.", { exact: true }).first()
  ).toBeVisible();
  await page.getByText("Delay acceptance", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Delay acceptance" })).toBeChecked();
  await field.press("Enter");
  await field.press("Enter");
  await field.fill("A newer draft during acceptance");
  await page.getByRole("button", { name: "Accept send" }).click();
  await expect(field).toHaveValue("A newer draft during acceptance");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Preserve this draft");
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("timer-driven stream growth preserves focus, past reading and lifecycle announcements", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(
    "/iframe.html?id=recipes-chat--reading-during-stream&globals=theme:dim;accent:blue"
  );
  const field = page.getByRole("textbox", { name: "Message" });
  const region = page.getByRole("region", { name: "Conversation", exact: true });
  await field.fill("Stream an answer");
  await field.press("Enter");
  const live = page.locator('[role="status"][aria-atomic="true"]');
  await expect(live).toHaveText("Assistant response started.");
  await page.clock.runFor(450);
  // Absolutely positioned accessible helpers inside messages must stay in the reading viewport.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight)).toBe(
    true
  );
  await field.fill("A draft written during the answer");
  await page.clock.runFor(450);
  await expect(field).toBeFocused();
  await expect(live).toHaveText("Assistant response started.");
  await region.focus();
  await region.press("Home");
  await page.clock.runFor(50);
  // Wait for native keyboard scrolling to reach Home before capturing a reading anchor.
  await expect
    .poll(async () => {
      await page.clock.runFor(16);
      return region.evaluate((node) => node.scrollTop);
    })
    .toBe(0);
  await expect(page.getByRole("button", { name: "Return to latest" })).toBeVisible();
  const summary = page.getByText("Details for history-0", { exact: true });
  await summary.focus();
  await summary.press("Enter");
  const position = await region.evaluate((node) => node.scrollTop);
  await page.clock.runFor(450);
  await expect(summary).toBeFocused();
  await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(position);
  await expect(live).toHaveText("Assistant response started.");
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("A draft written during the answer");
});

test.describe("stream controls on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("Stop before the first token leaves no empty bubble and permits another message", async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=recipes-chat--streaming-response&globals=theme:dim;accent:blue"
    );
    const field = page.getByRole("textbox", { name: "Message" });
    await field.fill("First request");
    await page.getByRole("button", { name: "Send", exact: true }).tap();
    await page.getByRole("button", { name: "Stop response" }).tap();
    await expect(page.getByRole("article")).toHaveCount(1);
    await field.fill("Second request");
    await page.getByRole("button", { name: "Send", exact: true }).tap();
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
});
