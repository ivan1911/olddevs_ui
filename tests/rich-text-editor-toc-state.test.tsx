// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
  type TocToolState,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { installPageGeometry, page } from "./editor-toc-geometry.js";

/**
 * The current section in the `toc` state and the highlighted tick on the bar (OLDSUI-268) are one
 * and the same value, with no scrolling at all: right after the lazy TOC core loads,
 * and after leaving HTML mode, where the core is unmounted.
 *
 * This file does NOT warm up the core chunk (`RichTextToc.js`): the first check runs in exactly
 * the order the screen sees it, with the Editor drawn while the core is still loading.
 * Warming it up here would make the test depend on the order of the checks.
 */

beforeAll(loadLazyBuiltins);

let removeGeometry: () => void;

beforeEach(() => {
  removeGeometry = installPageGeometry();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  removeGeometry();
});

const ARTICLE = "<h1>One</h1><p>x</p><h2>Two</h2><p>x</p><h2>Three</h2><p>x</p><h2>Four</h2>";

let snapshot: TocToolState | null = null;

function Screen() {
  const ref = useRef<RichTextEditorHandle>(null);
  snapshot = useRichTextToolState(ref, "toc");
  return (
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue={ARTICLE}
      tools={[...RICH_TEXT_PRESETS.full, "toc"]}
    />
  );
}

const strip = () => screen.queryByRole("button", { name: "Table of contents" });
/** Index of the tick highlighted as current. */
const marked = () =>
  [...(strip()?.querySelectorAll("[data-toc-stroke]") ?? [])].findIndex((stroke) =>
    stroke.hasAttribute("data-current")
  );

test("the current section in the State is the highlighted stroke as soon as the lazy core has loaded", async () => {
  // The page is already scrolled: the third heading is at the top edge.
  page.scrolledTo = 2;
  render(<Screen />);

  // The core hasn't arrived yet: there is no bar, but the snapshot still returns the headings.
  expect(snapshot?.headings).toHaveLength(4);
  await waitFor(() => expect(marked()).toBe(2));
  expect(snapshot?.current).toBe(2);
});

test("the current section in the State is the highlighted stroke after leaving the HTML mode", async () => {
  const user = userEvent.setup();
  page.scrolledTo = 1;
  render(<Screen />);
  await waitFor(() => expect(marked()).toBe(1));
  expect(snapshot?.current).toBe(1);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(strip()).toBeNull();

  // The reader is back in visual mode: the core is mounted again, and the scroll position differs.
  page.scrolledTo = 3;
  await user.click(screen.getByRole("button", { name: "HTML" }));
  await waitFor(() => expect(marked()).toBe(3));
  expect(snapshot?.current).toBe(3);
});
