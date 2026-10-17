import { defineConfig, devices } from "@playwright/test";

// PW_PORT is for parallel worktrees: with a shared port, `reuseExistingServer`
// would pick up the showcase of a neighboring tree and test someone else's code.
const PORT = Number(process.env.PW_PORT ?? 6007);

export default defineConfig({
  testDir: "./tests-visual",
  // Snapshots are the only artifact that gets committed; keep them next to the test.
  // {platform} is required: font rendering differs between macOS and the Linux CI image,
  // and without the split the local baseline would fail the pipeline.
  snapshotPathTemplate: "{testDir}/__snapshots__/{platform}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Animations are the main source of flakiness: six named `--animate-*` tokens plus
    // `transition-colors` in almost every primitive. Turn them off at the browser level,
    // not only at the moment of the snapshot.
    contextOptions: { reducedMotion: "reduce" },
  },

  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Two thresholds, and both are calibrated against real changes, not picked by eye.
      // Before calibration, the baseline reported "51 passed" on two deliberate colour
      // changes in a row, so it failed exactly where it was meant to work: on token edits.
      //
      // `threshold` is the per-pixel colour tolerance, and it matters more. The default
      // 0.2 means a pixel counts as "the same" until its colour has moved noticeably.
      // With it, the edit of `--text-muted` from `#a6a8b3` to `#acaeb8` produced
      // EXACTLY ZERO differing pixels on all 51 snapshots. With zero, the same edit
      // shows up as 747 pixels per snapshot.
      //
      // `maxDiffPixels` is how many such pixels we forgive. An absolute number, not a
      // share: a relative `maxDiffPixelRatio: 0.002` on a 1280×900 snapshot is 2304 pixels
      // of tolerance, while the smallest change we must catch (the text colour on two
      // buttons of the matrix) affects 168. The margin of 32 is only for anti-aliasing
      // variation between runners: locally, two runs in a row give byte-identical
      // snapshots, and the baselines are already split by platform.
      threshold: 0,
      maxDiffPixels: 32,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    command: `npx http-server storybook-static -p ${PORT} -s --silent`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
