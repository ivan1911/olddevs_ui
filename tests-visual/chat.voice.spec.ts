import { expect, test } from "@playwright/test";

test("voice interim/final speech and playback share one history, while typed text interrupts voice", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=recipes-voicechat--connected&globals=theme:dark;accent:blue");
  await page.getByRole("button", { name: "Show interim transcript", exact: true }).click();
  await page.getByRole("button", { name: "Show interim transcript", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Interim transcript", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finalize transcript", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Interim transcript", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Append voice answer", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("Continue with a typed message");
  await field.press("Enter");
  await expect(field).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByText("Response interrupted", { exact: true })).toBeVisible();
  await expect(page.getByText("Connection: Ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Append voice answer", exact: true }).click();
  await page.getByRole("button", { name: "Finish voice answer", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: "Simulate audio playback", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByText("Agent: Speaking", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Playback finished", exact: true }).click();
  await expect(page.getByText("Agent: Listening", { exact: true })).toBeVisible();
});

test("keyboard mute is independent from end and the conversation continues by text afterwards", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=recipes-voicechat--connected&globals=theme:light;accent:blue");
  const field = page.getByRole("textbox", { name: "Message" });
  await field.fill("A typed request while voice is ready");
  await field.press("Enter");
  await page.getByRole("button", { name: "Append voice answer", exact: true }).click();
  const mute = page.getByRole("button", { name: "Mute microphone", exact: true });
  await mute.focus();
  await mute.press("Enter");
  await expect(page.getByText("Microphone: Muted", { exact: true })).toBeVisible();
  await expect(page.getByText("Agent: Speaking", { exact: true })).toBeVisible();
  await expect(page.getByText("Connection: Ready", { exact: true })).toBeVisible();
  const end = page.getByRole("button", { name: "End voice", exact: true });
  await end.focus();
  await end.press("Enter");
  await expect(field).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("Connection: Off", { exact: true })).toBeVisible();
  await field.fill("Continue the same conversation by text");
  await field.press("Enter");
  await page.getByRole("button", { name: "Complete text response", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: "Start voice", exact: true }).click();
  await page.getByRole("button", { name: "Connection ready", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("preparation and connection errors remain distinct and retry does not reset the conversation", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=recipes-voicechat--playground&globals=theme:dim;accent:blue");
  await page.getByRole("button", { name: "Start voice", exact: true }).click();
  await expect(page.getByText("Connection: Preparing", { exact: true })).toBeVisible();
  await expect(page.getByText("Agent: Idle", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connection failed", exact: true }).click();
  await expect(page.getByText("Connection: Error", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Voice connection failed. The conversation is preserved.", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry voice connection", exact: true }).click();
  await expect(page.getByText("Connection: Preparing", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connection ready", exact: true }).click();
  await expect(page.getByText("Connection: Ready", { exact: true })).toBeVisible();
});

test.describe("voice panel on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("compact and expanded modes retain status, input and mute/end actions", async ({ page }) => {
    await page.goto("/iframe.html?id=recipes-voicechat--connected&globals=theme:dim;accent:blue");
    const toggle = page.getByRole("button", { name: "Collapse voice panel", exact: true });
    await toggle.tap();
    await expect(
      page.getByRole("button", { name: "Expand voice panel", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Connection: Ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "End voice", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mute microphone", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Unmute microphone", exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Expand voice panel", exact: true }).tap();
    await expect(page.getByRole("img", { name: "Static consumer visualizer" })).toBeVisible();
    const field = page.getByRole("textbox", { name: "Message" });
    await expect(field).toBeVisible();
    await field.fill(
      "A long draft stays editable while the compact voice status remains usable on a narrow screen."
    );
    await expect(field).toBeEditable();
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
});
