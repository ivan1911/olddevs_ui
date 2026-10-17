import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { stubVideoServices } from "./video-services.js";

/**
 * Visual baseline: a snapshot of every story in the showcase, in every theme.
 *
 * Why stories and not screenshots of consumer screens: screens need a backend
 * and live data, so their snapshots would change from run to run for reasons
 * unrelated to the code. Stories are deterministic.
 *
 * The theme is set with the `globals` URL parameter, before the first render. It must not
 * be changed after the page has loaded: Chromium propagates inherited CSS variables down
 * the subtree on the next style recalculation, so a snapshot taken right after the switch
 * would show the old theme.
 */

type Entry = { id: string; name: string; title: string; type: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../storybook-static/index.json"), "utf8")
) as { entries: Record<string, Entry> };

/**
 * Only CORE stories are snapshotted.
 *
 * The `periphery` tag is the two-level threshold mechanism from
 * ADR-0014:
 * components of waves 8–11 have almost no decisions of their own, their look is assembled
 * entirely from the vocabulary's atoms, so a snapshot would guard the atoms — and those are
 * already guarded by the core snapshots. The tag is set in `meta.tags` of the story file.
 *
 * The axe audit and class coverage do NOT look at the tag: they are required on both
 * levels, because they catch silent breakage.
 */
const stories = Object.values(index.entries).filter(
  (e) => e.type === "story" && !e.tags?.includes("periphery")
);

const THEMES = ["dark", "light", "dim"] as const;

/**
 * The story viewport is set by a tag, not by a parameter.
 *
 * The spec knows about a story only what is in `storybook-static/index.json`:
 * id, name and tags. Story parameters (`parameters`) do not get there, but tags do,
 * so a story that needs a narrow width says so with the `viewport-phone` tag
 * (the story's `tags`). Without the tag the snapshot is taken at the project's 1280×900.
 *
 * Why at all. The `bottomBar` slot of `AppShell` hides the bar from `md` up, so at 1280px
 * the `WithBottomBar` snapshot did not show the bar placed in the slot at all. On a phone
 * the screen cutout is also emulated (`env(safe-area-inset-bottom)` = 34px, as on an iPhone
 * with a gesture bar): without it, the slot's inset for the cutout and the bar's backdrop
 * beneath it would not be visible in the snapshot either. The emulation goes through CDP:
 * Playwright has none of its own, and the project is Chromium.
 *
 * The snapshot file name does not depend on the tag: the story is snapshotted at one size.
 */
const PHONE = { width: 375, height: 812 } as const;
const PHONE_SAFE_AREA_BOTTOM = 34;

async function applyViewport(page: Page, story: Entry) {
  if (!story.tags?.includes("viewport-phone")) return;
  await page.setViewportSize(PHONE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { bottom: PHONE_SAFE_AREA_BOTTOM },
  });
}

/**
 * SNAPSHOT COVERAGE RULE, written down explicitly, or it would drift.
 *
 * There are three axes now: theme (3) × accent (2) × brand (2) = 12 sets per story.
 * Snapshotting all twelve would mean keeping the baseline four times larger than today and
 * reviewing four times as many diffs on every token edit. It does not pay off: brand and
 * accent change color, not geometry, and color is fully covered by `npm run contrast`,
 * which checks the tokens, not whatever a story happened to show.
 *
 * So the following is snapshotted:
 *   — every core story in the three themes on the blue accent (the full set);
 *   — one story on the violet accent (proves that the axis works);
 *   — one story on the `teal` brand (proves that the brand block works).
 *
 * Coverage is worth extending where brand or accent change the LAYOUT.
 * There are no such places today; the first one to appear is a reason to revisit
 * the rule, not to add a snapshot silently.
 */

/**
 * Lazy chunks are marked with the `network-idle` tag, for the same reason as the viewport:
 * the spec sees only tags. Part of a story may load after it is shown: the Text card
 * (OLDSUI-113) requests its own chunk only after the engine's Readiness (OLDSUI-111).
 * While the chunk is in transit, the page stands still, and a snapshot comparison that waits
 * only for two identical frames in a row would accept a field without the Text card as a
 * finished story. Network silence is an honest sign that there is nothing left to load.
 * Only by tag: half a second of waiting on each of thousands of stories would cost minutes
 * of the run.
 */
async function waitForLazyChunks(page: Page, story: Entry) {
  if (story.tags?.includes("network-idle")) await page.waitForLoadState("networkidle");
}

test("the showcase contains stories", () => {
  expect(stories.length).toBeGreaterThan(0);
});

/**
 * A story is ready when the showcase itself signals it (`sb-show-main` on body), as in
 * `a11y.spec.ts`. Visibility of the canvas alone is not enough: an empty-state story
 * (`RichTextView` with empty HTML) legitimately renders a container of zero height, and
 * Playwright does not count such a canvas as visible — the test would wait until the timeout.
 */
async function waitForStory(page: Page, story: Entry) {
  await page.locator("body.sb-show-main").waitFor({ state: "attached" });
  await waitForLazyChunks(page, story);
  const canvas = page.locator("#storybook-root");
  await expect
    .poll(
      async () =>
        (await canvas.isVisible()) ||
        (await canvas.evaluate((node) => node.getBoundingClientRect().height === 0))
    )
    .toBe(true);
}

for (const story of stories) {
  for (const theme of THEMES) {
    // The accent is fixed: it affects only `--accent*`, and the tone matrices cover it
    // with a separate check below. Snapshotting all 6 combinations for every story would
    // mean four times as many files for almost no gain in coverage.
    test(`${story.id} — theme ${theme}`, async ({ page }) => {
      await applyViewport(page, story);
      // The video player mounts right away: a third-party service does not get into the snapshot.
      if (story.id.includes("video")) await stubVideoServices(page);
      await page.goto(`/iframe.html?id=${story.id}&globals=theme:${theme};accent:blue`);
      await waitForStory(page, story);
      await expect(page).toHaveScreenshot(`${story.id}--${theme}.png`, { fullPage: true });
    });
  }
}

// The accent and the brand are checked only on the matrices: the other stories do not
// show them. A matrix shows all tones at once — if the brand block shifted something,
// it is visible here and nowhere else.
for (const story of stories.filter((s) => s.name.toLowerCase().includes("matrix"))) {
  test(`${story.id} — accent violet`, async ({ page }) => {
    await applyViewport(page, story);
    await page.goto(`/iframe.html?id=${story.id}&globals=theme:dark;accent:violet`);
    await waitForStory(page, story);
    await expect(page).toHaveScreenshot(`${story.id}--violet.png`, { fullPage: true });
  });

  test(`${story.id} — brand teal`, async ({ page }) => {
    await applyViewport(page, story);
    await page.goto(`/iframe.html?id=${story.id}&globals=theme:dark;accent:blue;brand:teal`);
    await waitForStory(page, story);
    await expect(page).toHaveScreenshot(`${story.id}--teal.png`, { fullPage: true });
  });
}
