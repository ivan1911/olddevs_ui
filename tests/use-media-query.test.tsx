// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { SplitPanel } from "../src/components/app-shell/SplitPanel.js";
import { useMediaQuery } from "../src/hooks/useMediaQuery.js";

/*
  In jsdom `matchMedia` does not exist at all. The shim is controllable: the test decides which
  queries are currently "matched" and reports the change itself, as a browser does when the window
  width changes. This is a boundary of the environment, not a replacement of the component.
*/
type Listener = () => void;
let matching = new Set<string>();
const listeners = new Map<string, Set<Listener>>();

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return matching.has(query);
      },
      media: query,
      addEventListener: (_: string, fn: Listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(fn);
      },
      removeEventListener: (_: string, fn: Listener) => listeners.get(query)?.delete(fn),
    }),
  });
}

/** The window became this wide: this changes which queries match and wakes the subscribers. */
function resizeTo(next: string[]) {
  const touched = new Set([...matching, ...next]);
  matching = new Set(next);
  act(() => {
    for (const query of touched) for (const fn of listeners.get(query) ?? []) fn();
  });
}

afterEach(() => {
  cleanup();
  matching = new Set();
  listeners.clear();
  // @ts-expect-error — restore the environment to its original state: `matchMedia` is absent in jsdom.
  delete window.matchMedia;
});

const WIDE = "(min-width: 1024px)";

function Probe({ query = WIDE, serverValue }: { query?: string; serverValue?: boolean }) {
  const matches = useMediaQuery(query, serverValue);
  return <p>{matches ? "wide" : "narrow"}</p>;
}

test("reports whether the query matches right now", () => {
  installMatchMedia();
  matching = new Set([WIDE]);
  render(<Probe />);

  expect(screen.getByText("wide")).toBeTruthy();
});

test("follows the window when the query starts and stops matching", () => {
  installMatchMedia();
  render(<Probe />);
  expect(screen.getByText("narrow")).toBeTruthy();

  resizeTo([WIDE]);
  expect(screen.getByText("wide")).toBeTruthy();

  resizeTo([]);
  expect(screen.getByText("narrow")).toBeTruthy();
});

test("a changed query is read afresh and the old subscription is dropped", () => {
  installMatchMedia();
  matching = new Set(["(min-width: 768px)"]);
  const { rerender } = render(<Probe query="(min-width: 768px)" />);
  expect(screen.getByText("wide")).toBeTruthy();

  rerender(<Probe query={WIDE} />);
  expect(screen.getByText("narrow")).toBeTruthy();
  expect(listeners.get("(min-width: 768px)")?.size ?? 0).toBe(0);
});

test("unsubscribes on unmount", () => {
  installMatchMedia();
  const { unmount } = render(<Probe />);
  expect(listeners.get(WIDE)?.size).toBe(1);

  unmount();
  expect(listeners.get(WIDE)?.size ?? 0).toBe(0);
});

test("without matchMedia (jsdom, old browsers) it answers with the server value and does not throw", () => {
  render(<Probe />);
  expect(screen.getByText("narrow")).toBeTruthy();

  cleanup();
  render(<Probe serverValue />);
  expect(screen.getByText("wide")).toBeTruthy();
});

test("the server renders the server value: false by default, the given one on request", () => {
  // The server does not know the width: the first frame is "narrow" (mobile-first, as in Tailwind),
  // unless the consumer says otherwise.
  installMatchMedia();
  matching = new Set([WIDE]);
  expect(renderToString(<Probe />)).toContain("narrow");
  expect(renderToString(<Probe serverValue />)).toContain("wide");
});

test("hydration keeps the server markup first, then switches to the real width without a mismatch", async () => {
  installMatchMedia();
  matching = new Set([WIDE]);
  const html = renderToString(<Probe />);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});

  await act(async () => {
    hydrateRoot(container, <Probe />);
  });

  // A React hydration mismatch would be reported via `console.error`; there is none, and after
  // hydration the page already shows the real width.
  expect(errors).not.toHaveBeenCalled();
  expect(container.textContent).toBe("wide");
  errors.mockRestore();
  container.remove();
});

test("SplitPanel: collapsed driven by the hook leaves one area on a narrow window", () => {
  installMatchMedia();
  function Screen() {
    const wide = useMediaQuery(WIDE);
    return (
      <SplitPanel aria-label="Details" collapsed={!wide} panel={<p>Order #4821</p>}>
        <p>List</p>
      </SplitPanel>
    );
  }
  render(<Screen />);

  // The panel is mounted, but it has left the accessibility tree.
  expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  expect(screen.queryByRole("slider")).toBeNull();

  resizeTo([WIDE]);
  expect(screen.getByRole("region", { name: "Details" })).toBeTruthy();
  expect(screen.getByRole("slider")).toBeTruthy();
});
