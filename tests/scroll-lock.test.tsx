// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useScrollLock } from "../src/hooks/useScrollLock.js";

/**
 * The lock counter is module-level, and this test checks exactly what it is designed for.
 *
 * Modals nest: a confirmation opens on top of the editing dialog. When it closes, the nested
 * dialog must not unlock scrolling while the outer one is still open. This defect is not
 * visible to the eye: the page simply starts scrolling under the open dialog.
 */

function Lock({ locked }: { locked: boolean }) {
  useScrollLock(locked);
  return null;
}

const locked = () => document.body.classList.contains("scroll-locked");

afterEach(() => {
  cleanup();
  document.body.style.removeProperty("padding-right");
});

test("the lock is set and released", () => {
  const { rerender } = render(<Lock locked={false} />);
  expect(locked()).toBe(false);

  rerender(<Lock locked />);
  expect(locked()).toBe(true);

  rerender(<Lock locked={false} />);
  expect(locked()).toBe(false);
});

test("nested locks: the last to close releases, not the first", () => {
  const { rerender } = render(
    <>
      <Lock locked />
      <Lock locked />
    </>
  );
  expect(locked()).toBe(true);

  // The nested dialog closed; the outer one is still open.
  rerender(
    <>
      <Lock locked />
      <Lock locked={false} />
    </>
  );
  expect(locked()).toBe(true);

  rerender(
    <>
      <Lock locked={false} />
      <Lock locked={false} />
    </>
  );
  expect(locked()).toBe(false);
});

test("unmounting with the lock raised does not leave the page locked", () => {
  // A common case: a component with a modal disappears together with it, and without
  // releasing the lock on unmount the counter would stick forever.
  const { unmount } = render(<Lock locked />);
  expect(locked()).toBe(true);

  unmount();
  expect(locked()).toBe(false);
});

/**
 * The app's own inline padding survives the lock.
 *
 * The scrollbar-width compensation was written to `body.style.paddingRight` and cleared by
 * assigning an empty string: that is, the lock did not RESTORE the previous value, it erased
 * it. An app that keeps its own inline padding on `<body>` (for example, to make room for its
 * fixed panel) lost it for good after the first kit dialog was opened.
 */
test("an inline padding of the application survives the lock", () => {
  document.body.style.paddingRight = "17px";

  const { rerender } = render(<Lock locked={false} />);
  rerender(<Lock locked />);
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("17px");
});

test("without an inline padding nothing is left behind", () => {
  const { rerender } = render(<Lock locked={false} />);
  rerender(<Lock locked />);
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("");
});

test("nested locks restore the original padding once, at the outermost release", () => {
  document.body.style.paddingRight = "17px";

  const outer = render(<Lock locked />);
  const inner = render(<Lock locked />);

  inner.rerender(<Lock locked={false} />);
  // The outer lock is still held: it is too early to restore the app's padding.
  expect(document.body.classList.contains("scroll-locked")).toBe(true);

  outer.rerender(<Lock locked={false} />);
  expect(document.body.style.paddingRight).toBe("17px");
});

test("a padding changed by the application while locked is not clobbered", () => {
  document.body.style.paddingRight = "17px";

  const { rerender } = render(<Lock locked />);
  // The app changed its padding while the lock was held: its own panel appeared on top of the
  // open dialog. Restoring the "old value" is no longer allowed here.
  document.body.style.paddingRight = "33px";
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("33px");
});

test("with no scrollbar the lock neither adds nor erases a padding", () => {
  // In jsdom `clientWidth` is zero, so in every other test the scrollbar width comes out as 1024
  // and the "no scrollbar" branch never runs. That is the most common case on macOS with
  // overlay scrollbars.
  const clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth");
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    get: () => window.innerWidth,
  });
  document.body.style.paddingRight = "17px";

  try {
    const { rerender } = render(<Lock locked />);
    expect(document.body.style.paddingRight).toBe("17px");
    rerender(<Lock locked={false} />);
    expect(document.body.style.paddingRight).toBe("17px");
  } finally {
    delete (document.documentElement as unknown as Record<string, unknown>).clientWidth;
    if (clientWidth) Object.defineProperty(Element.prototype, "clientWidth", clientWidth);
  }
});
