// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useStickyOffset } from "../src/hooks/useStickyOffset.js";

/** Every observer created, and whether it is still live. */
const created: { rootMargin?: string; live: boolean }[] = [];

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      /*
        Each instance has its OWN record, and the record has `live`.

        Creating an observer is not enough: it must stay connected. The check "was the expected
        `rootMargin` created" missed the case where a new observer was created and then immediately
        disconnected by the cleanup of the previous effect. The bar froze forever, and the test
        stayed green. This is the same kind of blindness the wave started with.
      */
      record: { rootMargin?: string; live: boolean };

      constructor(_cb: unknown, options?: { rootMargin?: string }) {
        // The number format is specified EXACTLY, not as `[\d.]+`: that class accepts `1.2.3` and
        // `..`. The stub would then accept exactly what the browser rejects, and it would confirm
        // itself, as already happened with `offsetHeight`.
        const margin = options?.rootMargin;
        const LENGTH = String.raw`-?(\d+(\.\d+)?|\.\d+)(px|%)`;
        if (margin != null && !new RegExp(`^${LENGTH}( ${LENGTH}){0,3}$`).test(margin.trim())) {
          throw new SyntaxError(
            `Failed to construct 'IntersectionObserver': rootMargin must be specified in pixels or percent (${margin}).`
          );
        }
        this.record = { rootMargin: margin, live: false };
        created.push(this.record);
      }
      observe() {
        this.record.live = true;
      }
      disconnect() {
        this.record.live = false;
      }
      unobserve() {}
    }
  );
});

/** Observers that are connected right now. */
const liveObservers = () => created.filter((c) => c.live);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--topbar-h");
  document.documentElement.style.removeProperty("--panel-h");
});

function Probe({ offsetVar }: { offsetVar?: string }) {
  const { sentinelRef } = useStickyOffset(offsetVar ? { offsetVar } : undefined);
  return <div ref={sentinelRef} />;
}

test("the offset comes from the application variable, not from a number", () => {
  document.documentElement.style.setProperty("--topbar-h", "55px");
  render(<Probe />);
  // A hard-coded number left a gap: on narrow screens the header is taller.
  expect(created.at(-1)?.rootMargin).toBe("-55px 0px 0px 0px");
});

test("the variable name is overridable: the package knows nothing about the header", () => {
  document.documentElement.style.setProperty("--panel-h", "40px");
  render(<Probe offsetVar="--panel-h" />);
  expect(created.at(-1)?.rootMargin).toBe("-40px 0px 0px 0px");
});

test("without the variable the offset is zero, not an error", () => {
  render(<Probe />);
  expect(created.at(-1)?.rootMargin).toBe("-0px 0px 0px 0px");
});

test("a variable published in rem is converted, not just tolerated", () => {
  // `IntersectionObserver` accepts only pixels and percentages. The value went into `rootMargin`
  // as is, and `4rem` threw a `SyntaxError` inside the callback ref. That happened during commit,
  // so it took down the whole subtree.
  //
  // The test asserts the EXACT number. jsdom has no layout, so the probe would measure zero. Then
  // `-0px` would pass any "px unit" check, and the unit conversion itself would be guarded by
  // nothing. So the probe's height is derived from its own inline style: 1rem = 16px.
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const height = (this as HTMLElement).style?.height ?? "";
    const rem = /^(-?[\d.]+)rem$/.exec(height);
    return { ...rect.call(this), height: rem ? Number(rem[1]) * 16 : 0 } as DOMRect;
  };

  try {
    document.documentElement.style.setProperty("--topbar-h", "4rem");
    render(<Probe />);
    expect(created.at(-1)?.rootMargin).toBe("-64px 0px 0px 0px");
  } finally {
    Element.prototype.getBoundingClientRect = rect;
  }
});

test("a negative published offset does not build a double minus", () => {
  // The sign was prepended as a string, so `-` + `-10px` produced `--10px`. That is a
  // `SyntaxError` in the observer constructor, which brings down the subtree in the same way.
  document.documentElement.style.setProperty("--topbar-h", "-10px");

  expect(() => render(<Probe />)).not.toThrow();
  expect(created.at(-1)?.rootMargin).toBe("10px 0px 0px 0px");
});

test("a malformed number is measured rather than passed through", () => {
  // `1.2.3px` is not a length. If it is passed through as is, it breaks the observer.
  document.documentElement.style.setProperty("--topbar-h", "1.2.3px");

  render(<Probe />);

  // The test asserts the RESULT of the measurement, not "did not crash". With `not.toThrow()`, the
  // test stayed green even when the measurement was removed entirely (the `fallback` return).
  expect(created.at(-1)?.rootMargin).toBe("-0px 0px 0px 0px");
});

test("a missing IntersectionObserver is a state, not a crash", () => {
  // The shared `tests/setup-jsdom.ts` does not provide this API, and both kit tests that reach this
  // point patched it locally. So the patch has already been duplicated, and a consumer would have
  // to write it a third time.
  vi.stubGlobal("IntersectionObserver", undefined);

  expect(() => render(<Probe />)).not.toThrow();
  // A state, not just "did not crash": there is no observer, and the bar is not pinned.
  expect(created).toHaveLength(0);
});

test("a resize storm is collapsed into one frame", async () => {
  render(<Probe />);
  const afterMount = created.length;

  /*
    Count STYLE READS, not created observers.

    The number of observers will not grow anyway, because a value-based bail-out protects them. But
    the costly path here is not a rebuild. It is a synchronous `getComputedStyle` on the root for
    every event, which forces a style recalculation on every frame of a window resize. Counting only
    `created`, the test stayed green even with `requestAnimationFrame` removed entirely.
  */
  const reads = vi.spyOn(window, "getComputedStyle");
  for (let i = 0; i < 20; i += 1) window.dispatchEvent(new Event("resize"));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // EXACTLY one, not "at most one": `toBeLessThanOrEqual(1)` also passes with zero. The test would
  // stay green with the `resize` listener removed entirely, because it did not assert that the
  // event triggers any reaction at all.
  expect(reads.mock.calls.length).toBe(1);
  expect(created.length).toBe(afterMount);
  reads.mockRestore();
});

test("a resize that actually changes the height rebuilds the observer", async () => {
  render(<Probe />);
  const afterMount = created.length;

  // A companion guard to the previous test: that one checks that no extra work is done, and this one
  // checks that the needed work is still done.
  document.documentElement.style.setProperty("--topbar-h", "72px");
  window.dispatchEvent(new Event("resize"));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(created.length).toBeGreaterThan(afterMount);
  expect(created.at(-1)?.rootMargin).toBe("-72px 0px 0px 0px");
});

test("the header growing a second row reaches the hook without a resize", async () => {
  document.documentElement.style.setProperty("--topbar-h", "56px");
  render(<Probe />);
  expect(created.at(-1)?.rootMargin).toBe("-56px 0px 0px 0px");

  // The header height changes not only at a breakpoint: `TopBar` publishes it through a
  // `ResizeObserver`, and its comment names slot content wrapping and a second row in search
  // explicitly. The window width does not change in this case.
  document.documentElement.style.setProperty("--topbar-h", "96px");
  // Two frames, not one: otherwise the order of microtasks between the test's resolver and the
  // `MutationObserver` callback depends on the runner.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(created.at(-1)?.rootMargin).toBe("-96px 0px 0px 0px");
});

/**
 * Changing `offsetVar` leaves exactly ONE live observer.
 *
 * The effect cleanup disconnected the observer but did not clear the refs. While `connect` had no
 * bail-outs, the next `resize` recreated it unconditionally, so a failure healed itself. The
 * value-based bail-outs removed that safety net: a dead but not cleared `observerRef` looks alive
 * to them, and the bar froze FOREVER.
 *
 * React's order makes this non-obvious: it detaches the old callback ref, attaches the new one
 * (which creates a LIVE observer), and only then runs the cleanup of the old effect, which
 * disconnects that fresh observer. So the test must check LIVENESS, not whether the observer was
 * created. The test with "was the expected `rootMargin` created" also passed on broken code.
 */
test("changing offsetVar leaves exactly one live observer", async () => {
  document.documentElement.style.setProperty("--topbar-h", "56px");
  document.documentElement.style.setProperty("--subnav-h", "40px");

  function Probe2({ offsetVar }: { offsetVar: string }) {
    const { sentinelRef } = useStickyOffset({ offsetVar });
    return <div ref={sentinelRef} />;
  }

  const { rerender } = render(<Probe2 offsetVar="--topbar-h" />);
  rerender(<Probe2 offsetVar="--subnav-h" />);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(liveObservers()).toHaveLength(1);
  expect(liveObservers()[0]?.rootMargin).toBe("-40px 0px 0px 0px");

  document.documentElement.style.removeProperty("--subnav-h");
});
