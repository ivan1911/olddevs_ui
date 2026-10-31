import { AxeBuilder } from "@axe-core/playwright";
import type { Result } from "axe-core";
import { expect, test, type Page } from "@playwright/test";

async function openStory(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=content-chatmessage-bubbles--${story}&globals=theme:dark;accent:blue`
  );
  await page.locator("body.sb-show-main").waitFor({ state: "attached" });
}

test("both short roles fit their metadata/actions, align opposite sides and keep tails in the viewport", async ({
  page,
}) => {
  await openStory(page, "single-bubbles");
  const region = page.getByRole("region", { name: "Bubble examples" });
  const user = page.getByRole("article", { name: "You" });
  const assistant = page.getByRole("article", { name: "Assistant" });
  const viewport = (await region.boundingBox())!;
  const userBox = (await user.boundingBox())!;
  const assistantBox = (await assistant.boundingBox())!;
  expect(userBox.width).toBeLessThan(viewport.width * 0.6);
  expect(assistantBox.width).toBeLessThan(viewport.width * 0.6);
  expect(userBox.x).toBeGreaterThan(assistantBox.x);
  expect(userBox.x + userBox.width).toBeCloseTo(viewport.x + viewport.width - 16, 0);
  for (const article of [user, assistant]) {
    const tail = article.locator('> svg[aria-hidden="true"]');
    await expect(tail).toHaveCount(1);
    const box = (await tail.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(viewport.x);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.x + viewport.width);
  }
  await expect(page.getByRole("button", { name: "Copy this answer" })).toBeVisible();
});

test("adjacent groups shrink their inner corners and only their last bubbles carry tails", async ({
  page,
}) => {
  await openStory(page, "grouped-bubbles");
  const articles = page.getByRole("article");
  expect(
    await articles.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-group-position"))
    )
  ).toEqual(["first", "middle", "last", "first", "middle", "last"]);
  await expect(page.locator('#storybook-root article > svg[aria-hidden="true"]')).toHaveCount(2);
  for (const [offset, side] of [
    [0, "Right"],
    [3, "Left"],
  ] as const) {
    const radii = await articles.nth(offset + 1).evaluate((node, side) => {
      const style = getComputedStyle(node);
      return {
        top: parseFloat(style.getPropertyValue(`border-top-${side.toLowerCase()}-radius`)),
        bottom: parseFloat(style.getPropertyValue(`border-bottom-${side.toLowerCase()}-radius`)),
        outer: parseFloat(
          style.getPropertyValue(`border-top-${side === "Right" ? "left" : "right"}-radius`)
        ),
      };
    }, side);
    expect(radii.top).toBeLessThan(radii.outer);
    expect(radii.bottom).toBeLessThan(radii.outer);
  }
});

test("time boundaries use actual ordered timestamps rather than identical visible captions", async ({
  page,
}) => {
  await openStory(page, "time-boundaries");
  const positions = await page
    .getByRole("article")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-group-position")));
  expect(positions).toEqual([
    "first",
    "last",
    "single",
    "single",
    "single",
    "single",
    "single",
    "single",
    "single",
    "single",
    "single",
    "single",
  ]);
});

test("long text, table and code stay bounded on a narrow screen without clipping tails", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openStory(page, "narrow-content");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const region = (await page.getByRole("region", { name: "Bubble examples" }).boundingBox())!;
  for (const article of await page.getByRole("article").all()) {
    const box = (await article.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(region.x + 15);
    expect(box.x + box.width).toBeLessThanOrEqual(region.x + region.width - 15);
    const tail = (await article.locator('> svg[aria-hidden="true"]').boundingBox())!;
    expect(tail.x).toBeGreaterThanOrEqual(region.x);
    expect(tail.x + tail.width).toBeLessThanOrEqual(region.x + region.width);
  }
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
});

for (const theme of ["dark", "dim"]) {
  test(`consumer send error stays readable in ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=recipes-chat--streaming-response&globals=theme:${theme};accent:blue`
    );
    await page.locator("body.sb-show-main").waitFor({ state: "attached" });
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}",
    });
    await page.getByRole("checkbox", { name: "Fail next send" }).press("Space");
    await expect(page.getByRole("checkbox", { name: "Fail next send" })).toBeChecked();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("A test question");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByText("Send failed. Your draft is preserved.", { exact: true }).first()
    ).toBeVisible();
    // Audit the error while reading it, without leaving the pointer on the send control.
    await page.mouse.move(0, 0);
    let violations: Result[] = [];
    for (let attempt = 0; ; attempt++) {
      try {
        violations = (await new AxeBuilder({ page }).include("#storybook-root").analyze())
          .violations;
        break;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("Axe is already running") ||
          attempt >= 10
        )
          throw error;
        await page.waitForTimeout(150);
      }
    }
    expect(
      violations
        .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
        .map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.html) }))
    ).toEqual([]);
  });
}

test("role alignment remains physical right/left in an RTL reading context", async ({ page }) => {
  await openStory(page, "single-bubbles");
  await page.locator("#storybook-root").evaluate((node) => node.setAttribute("dir", "rtl"));
  const user = (await page.getByRole("article", { name: "You" }).boundingBox())!;
  const assistant = (await page.getByRole("article", { name: "Assistant" }).boundingBox())!;
  expect(user.x).toBeGreaterThan(assistant.x);
});
