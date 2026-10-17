// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { TopBar } from "../src/components/app-shell/TopBar.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
});

/**
 * jsdom does not compute layout: `offsetHeight` is always 0 there, and `ResizeObserver` is
 * missing altogether. Both are replaced, otherwise the test would check the stub rather than the
 * contract. The real height is guarded by `tests-visual/interactions.spec.ts`, where the sticky
 * bar sits under the TopBar in a live browser.
 */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    /*
      A detached node must return ZERO, as in a browser.

      The constant here was a stub that guarded itself: the effect's cleanup compared the published
      value with `el.offsetHeight`, but `useEffect` is a passive effect whose cleanup runs AFTER the
      mutation phase, when the node is already removed from the document. In a browser that reads
      zero, the comparison `"56px" === "0px"` is always false, and the variable was never removed.
      The stub also answered 56 for the detached node, so the test "the variable is removed together
      with the TopBar" passed against broken code.
    */
    get(this: HTMLElement) {
      return this.isConnected ? 56 : 0;
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const heightOf = (name: string) => document.documentElement.style.getPropertyValue(name);

describe("TopBar", () => {
  test("it is a landmark named from the message catalog", () => {
    render(<TopBar />);
    expect(screen.getByRole("banner", { name: "Application header" })).toBeTruthy();
  });

  /**
   * Regression: the consumer's `style` overwrote the attribute WHOLE, and the TopBar lost its
   * backdrop, which with sticky blur means content shows through. Only this check catches it: the
   * markup is valid, the types match, and the slot tests are green.
   */
  test("a consumer style adds to the underlay instead of wiping it", () => {
    const { container } = render(<TopBar style={{ zIndex: 99 }} />);
    const header = container.querySelector("header");
    expect(header?.style.background).toContain("--topbar-bg");
    expect(header?.style.zIndex).toBe("99");
  });

  test("a consumer underlay still wins — the prop outranks the default", () => {
    const { container } = render(<TopBar style={{ background: "red" }} />);
    expect(container.querySelector("header")?.style.background).toBe("red");
  });

  test("slots render, absent ones do not reach the markup", () => {
    render(<TopBar brand={<span>Olddevs</span>} actions={<button>Settings</button>} />);
    expect(screen.getByText("Olddevs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });
});

/**
 * ADR-0019 was written for this block: before 2.1.0 the application published the height, and
 * now the kit's own TopBar does.
 */
describe("TopBar: publishing the height", () => {
  test("the height goes into --topbar-h on mount", () => {
    render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");
  });

  test("the variable name is a prop: a second header has its own", () => {
    render(<TopBar heightVar="--widget-topbar-h" />);
    expect(heightOf("--widget-topbar-h")).toBe("56px");
    expect(heightOf("--topbar-h")).toBe("");
  });

  test("heightVar=null switches publishing off", () => {
    render(<TopBar heightVar={null} />);
    expect(heightOf("--topbar-h")).toBe("");
  });

  /**
   * The kit is not the only publisher of the variable: its name is a prop precisely because the
   * TopBar may be someone else's (ADR-0016). A value overwritten from outside the kit is not removed
   * by a departing TopBar.
   */
  test("a departing header does not clear a value written by someone else", () => {
    const { unmount } = render(<TopBar />);
    // The second TopBar published its value before the first one unmounted.
    document.documentElement.style.setProperty("--topbar-h", "72px");
    unmount();
    expect(heightOf("--topbar-h")).toBe("72px");
  });

  test("the variable is removed together with the header", () => {
    const { unmount } = render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");
    unmount();
    // A leftover variable would make the sticky bars offset from an element that no longer
    // exists.
    expect(heightOf("--topbar-h")).toBe("");
  });
});

/**
 * Two real TopBars, not a simulation by writing to the style.
 *
 * When switching screens, the new TopBar mounts BEFORE the old one unmounts. The same happens with
 * the application's TopBar plus an embedded widget's TopBar that uses the same variable name.
 * Ownership was decided by COMPARING VALUES, but two TopBars of one component produce the same
 * height and cannot be told apart by value: the departing one removed the variable that the
 * remaining one had just published.
 *
 * Before wave 26 the defect did not show, for another reason: the cleanup re-measured an already
 * detached node, got zero, and the removal branch never ran. Fixing the cleanup enabled that
 * branch, and thereby exposed the defect.
 */
describe("TopBar: two headers at once", () => {
  test("a departing header leaves the variable to the one still mounted", () => {
    const first = render(<TopBar />);
    render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");

    first.unmount();

    // Both have the same height, so they can be told apart only by their owner.
    expect(heightOf("--topbar-h")).toBe("56px");
  });

  test("the last header to leave removes the variable", () => {
    const first = render(<TopBar />);
    const second = render(<TopBar />);

    first.unmount();
    second.unmount();

    expect(heightOf("--topbar-h")).toBe("");
  });
});

test("a value written by the application survives a departing middle header", () => {
  const first = render(<TopBar />);
  render(<TopBar />);

  // The application publishes its own value, which the module docstring allows.
  document.documentElement.style.setProperty("--topbar-h", "100px");
  first.unmount();

  // The check "the root holds someone else's value" was guarded by "I am the last one", so with
  // three participants a departing TopBar that was not the last one overwrote someone else's value.
  expect(heightOf("--topbar-h")).toBe("100px");
});
