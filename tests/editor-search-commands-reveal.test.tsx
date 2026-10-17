// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * The Find commands reveal the current match on their own, without waiting for the panel:
 * the screen builds its own panel on `next()`, and its focus is on the button, not in
 * the Document. jsdom has no layout, so the match position comes from a stubbed
 * `getBoundingClientRect`, and window scrolling is seen in the `scrollTop` of the root.
 */

beforeAll(loadLazyBuiltins);
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function placeCurrentMatch(top: number) {
  const rect = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (!this.classList.contains("rte-search-current")) return rect.call(this);
    return DOMRect.fromRect({ x: 40, y: top, width: 30, height: 20 });
  });
  const scrolled: number[] = [];
  vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(function (
    this: Element,
    value: number
  ) {
    if (this === document.documentElement) scrolled.push(value);
  });
  return scrolled;
}

const below = () => window.innerHeight + 500;
const centered = () => below() + 10 - window.innerHeight / 2;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function renderWithButton() {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <>
      <button type="button">Outside</button>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>cat dog cat</p>" />
    </>
  );
  const button = screen.getByRole("button", { name: "Outside" });
  button.focus();
  return { search: () => ref.current!.tool("search")!, button };
}

test("next() with focus on an outside button scrolls to the match and keeps the focus", async () => {
  const { search, button } = renderWithButton();
  act(() => void search().setQuery("cat"));
  const scrolled = placeCurrentMatch(below());
  button.focus();
  act(() => void search().next());
  await waitFor(() => expect(scrolled).toEqual([centered()]));
  expect(document.activeElement).toBe(button);
});

test("previous() scrolls to the match as well", async () => {
  const { search, button } = renderWithButton();
  act(() => void search().setQuery("cat"));
  const scrolled = placeCurrentMatch(below());
  act(() => void search().previous());
  await waitFor(() => expect(scrolled).toEqual([centered()]));
  expect(document.activeElement).toBe(button);
});

test("setQuery() scrolls to the first match", async () => {
  const { search, button } = renderWithButton();
  const scrolled = placeCurrentMatch(below());
  act(() => void search().setQuery("dog"));
  await waitFor(() => expect(scrolled).toEqual([centered()]));
  expect(document.activeElement).toBe(button);
});

test("a match already in view is not scrolled by next()", async () => {
  const { search } = renderWithButton();
  act(() => void search().setQuery("cat"));
  const scrolled = placeCurrentMatch(100);
  act(() => void search().next());
  await frame();
  await frame();
  expect(scrolled).toEqual([]);
});

test("next() with no matches does not scroll", async () => {
  const { search } = renderWithButton();
  const scrolled = placeCurrentMatch(below());
  act(() => void search().setQuery("zebra"));
  expect(search().next()).toBe(false);
  await frame();
  await frame();
  expect(scrolled).toEqual([]);
});

test("with the panel open next() scrolls once, not once per path", async () => {
  const { search } = renderWithButton();
  act(() => void search().open({ query: "cat" }));
  await screen.findByRole("search", { name: "Find and replace" });
  await frame();
  await frame();
  const scrolled = placeCurrentMatch(below());
  act(() => void search().next());
  await waitFor(() => expect(scrolled.length).toBeGreaterThan(0));
  await frame();
  await frame();
  expect(scrolled).toEqual([centered()]);
});

test("with the panel open setQuery() scrolls once: the panel and the command share a frame", async () => {
  const { search } = renderWithButton();
  act(() => void search().open());
  await screen.findByRole("search", { name: "Find and replace" });
  await frame();
  const scrolled = placeCurrentMatch(below());
  act(() => void search().setQuery("dog"));
  await waitFor(() => expect(scrolled.length).toBeGreaterThan(0));
  await frame();
  await frame();
  expect(scrolled).toEqual([centered()]);
});
