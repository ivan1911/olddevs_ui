// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { RICH_TEXT_PRESETS, RichTextEditor } from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testLazyTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

/**
 * Skeleton and safety (OLDSUI-110, fix): until Readiness, the Skeleton shows the Document
 * cleaned by the kit's Schema, and only in the browser, after mounting. The `value` string is
 * parsed in an inert document against the Schema of the kit's built-in Tools in the set, so
 * handlers, scripts and foreign URL schemes never reach the page or run. On the server and before
 * hydration the Skeleton is the field frame and the place of the Toolbar, without the Document.
 * Through the public `RichTextEditor`; a custom Tool's loader keeps the Skeleton on screen.
 */

declare global {
  interface Window {
    skeletonSpy?: (source: string) => void;
  }
}

const spy = vi.fn();

beforeEach(() => {
  spy.mockClear();
  window.skeletonSpy = spy;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
  delete window.skeletonSpy;
});

const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

/** The Skeleton's Document: a static block of the field with no input, where this text is shown. */
function skeletonOf(text: string): HTMLElement {
  const node = screen.getByText(text);
  const skeleton = node.closest<HTMLElement>("[class*='min-h-24']");
  if (!skeleton) throw new Error("no Skeleton around the text");
  expect(skeleton.closest("[contenteditable]")).toBeNull();
  return skeleton;
}

const HOSTILE =
  `<p onclick="window.skeletonSpy('p')">Click me</p>` +
  `<img src="x" onerror="window.skeletonSpy('img')">` +
  `<img src="https://example.com/cat.png" alt="Cat" onerror="window.skeletonSpy('img2')">` +
  `<script>window.skeletonSpy('script')</script>` +
  `<p><a href="javascript:window.skeletonSpy('a')">Bad link</a></p>` +
  `<p><a href="JaVaScRiPt:window.skeletonSpy('A')" onmouseover="window.skeletonSpy('over')">Odd link</a></p>`;

test("the Skeleton does not carry handlers, scripts and javascript: links from value", async () => {
  const lazy = testLazyTool();
  const { container } = render(
    <RichTextEditor
      aria-label="Body"
      value={HOSTILE}
      tools={[...RICH_TEXT_PRESETS.full, lazy.tool]}
    />
  );
  await settle();

  // The engine does not exist yet: the Skeleton is on screen.
  expect(screen.queryByRole("textbox")).toBeNull();
  const skeleton = skeletonOf("Click me");

  // No handlers, no scripts, and no `javascript:` anywhere in the field.
  expect(container.querySelector("script")).toBeNull();
  for (const element of container.querySelectorAll("*")) {
    for (const attribute of element.getAttributeNames()) {
      expect(attribute.startsWith("on"), `${element.tagName} ${attribute}`).toBe(false);
    }
  }
  expect(container.innerHTML).not.toMatch(/javascript:/i);
  expect(container.innerHTML).not.toContain("skeletonSpy");

  // Links stayed as text without an address, and the image with an allowed address has no handler.
  expect(within(skeleton).getByText("Bad link").closest("a")?.hasAttribute("href") ?? false).toBe(
    false
  );
  const cat = within(skeleton).getByRole("img", { name: "Cat" });
  expect(cat.getAttribute("src")).toBe("https://example.com/cat.png");

  await userEvent.click(screen.getByText("Click me"));
  await userEvent.click(screen.getByText("Bad link"));
  await userEvent.hover(screen.getByText("Odd link"));
  cat.dispatchEvent(new Event("error"));
  expect(spy).not.toHaveBeenCalled();
});

test("the Skeleton keeps the markup of the Schema: headings, lists, links with an allowed address", async () => {
  const lazy = testLazyTool();
  render(
    <RichTextEditor
      aria-label="Body"
      value={
        "<h2>Title</h2>" +
        "<ul><li><p>First item</p></li></ul>" +
        "<ol><li><p>Second item</p></li></ol>" +
        '<p><strong>Bold</strong> and <a href="https://example.com/">a site</a></p>' +
        '<div data-block="test_lazy">Lazy text</div>'
      }
      tools={[...RICH_TEXT_PRESETS.full, lazy.tool]}
    />
  );
  await settle();

  const skeleton = skeletonOf("Title");
  expect(within(skeleton).getByRole("heading", { level: 2, name: "Title" })).toBeTruthy();
  expect(within(skeleton).getAllByRole("listitem")).toHaveLength(2);
  expect(within(skeleton).getByText("Bold").tagName).toBe("STRONG");
  expect(within(skeleton).getByRole("link", { name: "a site" }).getAttribute("href")).toBe(
    "https://example.com/"
  );
  // A Block of a Tool that is not loaded yet is text: the Schema removed its wrapper.
  expect(within(skeleton).getByText("Lazy text").closest("[data-block]")).toBeNull();

  lazy.resolve();
  await settle();

  // The engine arrived with its own Extensions: the Block is a Block again, and there is no Skeleton.
  const document = screen.getByRole("textbox", { name: "Body" });
  expect(within(document).getByText("Lazy text").closest("[data-block=test_lazy]")).not.toBeNull();
  expect(screen.getAllByText("Lazy text")).toHaveLength(1);
});

test("the Skeleton follows the Schema of the set: a disabled tool's markup is dropped", async () => {
  const lazy = testLazyTool();
  render(
    <RichTextEditor
      aria-label="Body"
      value='<h2>Title</h2><p><a href="https://example.com/">a site</a></p>'
      tools={["bold", lazy.tool]}
    />
  );
  await settle();

  const skeleton = skeletonOf("Title");
  expect(within(skeleton).queryByRole("heading")).toBeNull();
  expect(within(skeleton).queryByRole("link")).toBeNull();
});

test("the server renders the frame without the Document; after hydration the Skeleton shows the cleaned Document, then the engine", async () => {
  const onRecoverableError = vi.fn();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const value = `<p>Before</p><p onclick="window.skeletonSpy('p')">Click me</p>`;
  const ui = <RichTextEditor aria-label="Body" value={value} tools={[lazy.tool]} />;

  const html = renderToString(ui);
  expect(html).not.toContain("Before");
  expect(html).not.toContain("Click me");
  expect(html).not.toContain("skeletonSpy");

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  await act(async () => void hydrateRoot(container, ui, { onRecoverableError }));
  await settle();

  // Hydration with no mismatches; the Document in the Skeleton is already cleaned.
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(within(container).getByText("Before")).toBeTruthy();
  expect(container.innerHTML).not.toContain("skeletonSpy");
  await userEvent.click(within(container).getByText("Click me"));
  expect(spy).not.toHaveBeenCalled();

  lazy.resolve();
  await settle();

  expect(container.querySelector("[contenteditable=true]")).not.toBeNull();
  expect(within(container).getAllByText("Before")).toHaveLength(1);
  container.remove();
});
