import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Named import, not the default one: the package exports both, but under this project's
// `moduleResolution` the default resolves to the module namespace object and cannot be constructed.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stubVideoServices } from "./video-services.js";
import type { Result } from "axe-core";

/**
 * Accessibility audit of every story in every theme, with the same axe-core that
 * powers the a11y addon in Storybook.
 *
 * Why duplicate the addon: the addon shows its result to the person who opened the
 * story. Here every story runs in all three themes and once more in the brand teal
 * (`RUNS` below), and "checked by eye" at that scale means "checked by sampling". The check covers all of them and fails
 * in CI, not in someone's memory.
 *
 * The threshold is `serious` and `critical`. `moderate` and `minor` deliberately do
 * not fail the run: some of them point at the markup of the stories themselves (matrix
 * tables), not at the primitives, and making the pipeline red on them would teach it
 * to be ignored.
 *
 * How this relates to `npm run contrast`: axe measures the rendered DOM of one
 * particular story, while the script measures every combination of tokens, including
 * those no story shows. The script is the superset, but only axe sees real overlaps.
 */

type Entry = { id: string; name: string; title: string; type: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../storybook-static/index.json"), "utf8")
) as { entries: Record<string, Entry> };

const stories = Object.values(index.entries).filter((e) => e.type === "story");
const THEMES = ["dark", "light", "dim"] as const;
const BLOCKING = new Set(["serious", "critical"]);

/**
 * The a11y addon in the showcase starts axe by itself as soon as a story renders,
 * and axe-core does not support two runs at once: it fails with "Axe is
 * already running". Whose run finishes first is a race, and the more stories there
 * are, the more often it is lost: with 21 stories, one to five tests failed per run.
 *
 * We wait for the other run to finish and try again. Retry only on this error:
 * any other failure must stay a failure.
 */
/**
 * Lets the entrance animations finish before colors are measured.
 *
 * `animate-fadein` and `animate-sheetin` start at `opacity: 0`. If axe runs right after
 * the DOM appears, it measures the color of semi-transparent text over its background:
 * a white caption on a card came out as `#2c2d33` with a contrast of 1.11. Any
 * animated primitive would have this defect, and it would look like a contrast failure,
 * so it would send someone to fix the wrong thing.
 *
 * Snapshots solve the same problem with `animations: "disabled"` in the config, but
 * that setting does not reach axe: it applies to the moment of capture.
 */
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });
}

async function analyzeWhenFree(page: Page, scope: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      // The text the Editor's focus mode dims is below 4.5:1 on purpose (OLDSUI-315, ADR-0082):
      // it is the background around the Block being written, not the text being read. It holds only
      // inline content, which the stories without the mode check in full.
      return await new AxeBuilder({ page }).include(scope).exclude(".rte-focus-dim").analyze();
    } catch (e) {
      const busy = e instanceof Error && e.message.includes("Axe is already running");
      if (!busy || attempt >= 10) throw e;
      await page.waitForTimeout(150);
    }
  }
}

/**
 * Runs along two axes: the three themes of the base kit plus one brand overlay.
 *
 * The full product (3 themes × 2 accents × 2 brands) would give 12 sets per
 * story: four times the cost for the same kind of findings. Accent and brand change
 * the COLOR, not the markup, and axe's serious/critical violations are almost
 * entirely contrast. Contrast is measured in full, and more cheaply, by
 * `npm run contrast`: it goes through every combination of tokens, including
 * those no story shows.
 *
 * So the brand is checked here in the dark theme only: one set, which proves that the
 * overlay does not break the markup or hide the names. Completeness of the color
 * combinations stays with the contrast gate.
 */
const RUNS = [
  ...THEMES.map((theme) => ({ label: `theme ${theme}`, globals: `theme:${theme};accent:blue` })),
  { label: "brand teal, dark", globals: "theme:dark;accent:blue;brand:teal" },
];

for (const story of stories) {
  for (const run of RUNS) {
    test(`a11y: ${story.id} — ${run.label}`, async ({ page }) => {
      // The video player mounts right away, so no external service ends up in the audit.
      if (story.id.includes("video")) await stubVideoServices(page);
      await page.goto(`/iframe.html?id=${story.id}&globals=${run.globals}`);
      const canvas = page.locator("#storybook-root");
      // Readiness is the showcase's own signal: `sb-show-main` is set on body once the
      // story has rendered. Canvas visibility alone is not enough: the empty-state story
      // (`RichTextView` with empty HTML) legitimately renders a container of zero height,
      // and Playwright does not count such a canvas as visible. An empty canvas while a
      // dialog is open is not an empty story: it is a dialog that has not yet hidden the
      // canvas, so we wait for it, as before.
      await page.locator("body.sb-show-main").waitFor({ state: "attached" });
      // The `network-idle` tag: the story loads a lazy chunk after it is shown
      // (as in `stories.spec.ts`), and without waiting, axe would audit a screen missing it.
      if (story.tags?.includes("network-idle")) await page.waitForLoadState("networkidle");
      await expect
        .poll(async () => {
          return (
            (await canvas.isVisible()) ||
            (await canvas.getAttribute("data-aria-hidden")) === "true" ||
            (await canvas.evaluate(
              (node) =>
                node.getBoundingClientRect().height === 0 &&
                !document.querySelector('[role="dialog"], [role="alertdialog"]')
            ))
          );
        })
        .toBe(true);
      await freezeAnimations(page);

      // A modal Dialog renders through a portal and correctly hides the canvas from
      // assistive technology. In that case the canvas must neither be waited on as visible
      // nor be scanned: the audit scope is the active dialog in the portal.
      const scope =
        (await canvas.getAttribute("data-aria-hidden")) === "true"
          ? '[role="dialog"], [role="alertdialog"]'
          : "#storybook-root";
      const { violations } = await analyzeWhenFree(page, scope);
      const blocking = violations.filter((v: Result) => BLOCKING.has(v.impact ?? ""));

      // The message names not only the rule but also the node: without a selector,
      // "label — 1 nodes" sends you hunting through the whole story by hand.
      expect(
        blocking.map(
          (v: Result) =>
            `${v.impact}: ${v.id} — ${v.help}\n` +
            v.nodes
              .map((n) => `      ${n.target.join(" ")}\n      ${n.html.slice(0, 160)}`)
              .join("\n")
        ),
        "Violations at the serious/critical level"
      ).toEqual([]);
    });
  }
}
