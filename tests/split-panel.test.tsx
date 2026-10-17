// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { SplitPanel } from "../src/components/app-shell/SplitPanel.js";
import { clamp } from "../src/lib/clamp.js";

/*
  Pointer capture shim. jsdom has none of these three methods, and the component calls them when
  a drag starts. Without the shim, the environment would crash, not the component.

  It is allowed on exactly the same grounds as the `CSS.escape` shim in `menu.test.tsx`: it moves
  the environment CLOSER to a browser, not further away. It is pure capture bookkeeping that every
  browser has. Coordinates and real focus must not be faked this way, and the checks that depend on
  them live in the browser (ADR-0012).
*/
for (const method of ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      value: method === "hasPointerCapture" ? () => false : () => {},
    });
  }
}

afterEach(cleanup);

/*
  Pointer dragging is NOT tested here, and this is not a gap. jsdom has neither `setPointerCapture`
  nor real coordinates, so such a test would either always pass or fail on a working component
  (ADR-0012). Dragging and the arrow keys are covered in `tests-visual/interactions.spec.ts`.
*/

function Panel(props: Partial<React.ComponentProps<typeof SplitPanel>> = {}) {
  return (
    <SplitPanel aria-label="Details" panel={<p>Order #4821</p>} {...props}>
      <p>List</p>
    </SplitPanel>
  );
}

/*
  The utility moved to `lib/clamp.ts`: the same expression had been written four times in the kit.
  The component no longer widens its public surface just for one unit test.
*/
test("clamp keeps the value inside the bounds", () => {
  expect(clamp(50, 120, 720)).toBe(120);
  expect(clamp(900, 120, 720)).toBe(720);
  expect(clamp(300, 120, 720)).toBe(300);
});

test("position switches the flex direction", () => {
  const { container, rerender } = render(<Panel position="side" />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.className).toContain("flex-row");

  rerender(<Panel position="bottom" />);
  expect(root.className).toContain("flex-col");
});

test("the panel takes width when at the side and height when at the bottom", () => {
  const { rerender } = render(<Panel position="side" defaultSize={300} />);
  const region = screen.getByRole("region", { name: "Details" });
  expect(region.style.width).toBe("300px");
  expect(region.style.height).toBe("");

  rerender(<Panel position="bottom" defaultSize={300} />);
  expect(region.style.height).toBe("300px");
  expect(region.style.width).toBe("");
});

test("a size outside the bounds is clamped rather than applied", () => {
  const { rerender } = render(<Panel size={20} minSize={120} maxSize={400} />);
  const region = screen.getByRole("region", { name: "Details" });
  expect(region.style.width).toBe("120px");

  rerender(<Panel size={5000} minSize={120} maxSize={400} />);
  expect(region.style.width).toBe("400px");
});

/*
  Collapsing does not unmount the content: form and scroll state inside the panel survives it. But
  the panel does leave the accessibility tree, otherwise Tab would reach invisible elements.
*/
test("collapsed takes the panel out of the accessibility tree with its handle", () => {
  render(<Panel collapsed />);

  expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  // There is nothing to drag: the handle disappears together with the panel.
  expect(screen.queryByRole("slider")).toBeNull();
});

/*
  A single render does not prove this: a component that unmounts the panel on collapse and mounts
  it again would pass such a check. The prop's promise is "state inside survives collapsing", and
  that is what the test must guard.
*/
test("collapsing and reopening keeps the state inside the panel", async () => {
  const user = userEvent.setup();

  function Toggle() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <>
        <button onClick={() => setCollapsed((v) => !v)}>Toggle</button>
        <Panel collapsed={collapsed} panel={<input aria-label="Comment" defaultValue="" />} />
      </>
    );
  }
  render(<Toggle />);

  const comment = screen.getByRole("textbox", { name: "Comment" });
  await user.type(comment, "check");
  expect((comment as HTMLInputElement).value).toBe("check");

  await user.click(screen.getByRole("button", { name: "Toggle" }));
  await user.click(screen.getByRole("button", { name: "Toggle" }));

  expect((screen.getByRole("textbox", { name: "Comment" }) as HTMLInputElement).value).toBe(
    "check"
  );
});

/*
  An inverted range does not crash anything, but it silently produces a control with no way out:
  `min > max` on a slider is a state with no message explaining why.
*/
test("an inverted range does not produce a dead control", () => {
  render(<Panel minSize={400} maxSize={200} />);
  const handle = screen.getByRole("slider");

  expect(Number(handle.getAttribute("min"))).toBeLessThanOrEqual(
    Number(handle.getAttribute("max"))
  );
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("400px");
});

/*
  The arrow step lives in the key handler, not in the `step` attribute. A slider's step base is
  `min`, so `step=16` would allow only the values `min + 16n`. Then `maxSize` could not be reached
  from the keyboard at all, and the browser would silently round the pixel-level result of a drag.
  The announced value would then differ from the width.
*/
test("the slider accepts every pixel, so the bounds are reachable exactly", () => {
  render(<Panel defaultSize={260} minSize={120} maxSize={725} />);
  const handle = screen.getByRole("slider") as HTMLInputElement;

  expect(handle.getAttribute("step")).toBe("1");
  // The slider value matches the panel size, rather than being rounded to a grid.
  expect(handle.value).toBe("260");

  fireEvent.change(handle, { target: { value: "725" } });
  expect(handle.value).toBe("725");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("725px");
});

test("arrow keys move by the coarse step and Shift by one pixel", async () => {
  const user = userEvent.setup();
  render(<Panel defaultSize={300} />);
  const handle = screen.getByRole("slider");
  handle.focus();

  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("316px");

  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("315px");
});

test("the handle is a slider carrying the bounds and the current size", () => {
  render(<Panel defaultSize={300} minSize={120} maxSize={400} />);
  const handle = screen.getByRole("slider", { name: "Resize: Details" });

  expect(handle.getAttribute("min")).toBe("120");
  expect(handle.getAttribute("max")).toBe("400");
  expect((handle as HTMLInputElement).value).toBe("300");
  expect(handle.getAttribute("aria-valuetext")).toBe("300 pixels");
});

test("the handle without a panel name still has a name of its own", () => {
  render(
    <SplitPanel panel={<p>Details</p>}>
      <p>List</p>
    </SplitPanel>
  );
  expect(screen.getByRole("slider", { name: "Resize the panel" })).toBeTruthy();
});

test("an uncontrolled panel remembers the size it was given", () => {
  const onSizeChange = vi.fn();
  render(<Panel defaultSize={300} onSizeChange={onSizeChange} />);

  fireEvent.change(screen.getByRole("slider"), { target: { value: "360" } });

  expect(onSizeChange).toHaveBeenCalledWith(360);
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("360px");
});

/*
  A controlled size is not written internally: two sources of truth would diverge on exactly the
  frame where the consumer rejects the value. Here the consumer stays silent, and the panel must keep
  its own size.
*/
test("a controlled panel does not move on its own", () => {
  const onSizeChange = vi.fn();
  render(<Panel size={300} onSizeChange={onSizeChange} />);

  fireEvent.change(screen.getByRole("slider"), { target: { value: "360" } });

  expect(onSizeChange).toHaveBeenCalledWith(360);
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("300px");
});

test("a controlled panel follows the consumer", () => {
  function Controlled() {
    const [size, setSize] = useState(300);
    return (
      <>
        <button onClick={() => setSize(420)}>Widen</button>
        <Panel size={size} onSizeChange={setSize} />
      </>
    );
  }
  render(<Controlled />);

  fireEvent.click(screen.getByRole("button", { name: "Widen" }));
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("420px");
});

/*
  `fireEvent.doubleClick` is used instead of `user.dblClick`: the latter also fires pointerdown, and
  jsdom has no `setPointerCapture`, so the environment would crash, not the component. Pointer
  capture itself is checked in the browser.
*/
test("double-clicking the handle returns the default size", () => {
  render(<Panel defaultSize={280} />);
  const region = screen.getByRole("region", { name: "Details" });

  fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
  expect(region.style.width).toBe("500px");

  fireEvent.doubleClick(screen.getByRole("slider").parentElement as HTMLElement);
  expect(region.style.width).toBe("280px");
});

/*
  A cleanup with an empty dependency list ran only when the WHOLE component unmounted, when the
  next handle no longer existed, so it did nothing. Collapsing in the middle of a drag left
  `select-none` on the root forever.
*/
test("collapsing during a drag clears the dragging state", () => {
  function Collapsible() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <>
        <button onClick={() => setCollapsed(true)}>Collapse</button>
        <Panel collapsed={collapsed} />
      </>
    );
  }
  const { container } = render(<Collapsible />);
  // The first `div` is the panel's own root; the following ones belong to its regions.
  const root = container.querySelectorAll("div")[0] as HTMLElement;

  fireEvent.pointerDown(screen.getByRole("slider").parentElement as HTMLElement, {
    button: 0,
    pointerId: 1,
    clientX: 100,
  });
  expect(root.className).toContain("select-none");

  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  expect(root.className).not.toContain("select-none");
});

/*
  The announced axis must match the one the arrow keys work on: when the panel is at the bottom,
  the slider is vertical. A mismatch is caught only by ear, and until now nothing guarded it.
*/
test("the slider announces the axis it actually works on", () => {
  const { rerender } = render(<Panel position="side" />);
  expect(screen.getByRole("slider").getAttribute("aria-orientation")).toBe("horizontal");

  rerender(<Panel position="bottom" />);
  expect(screen.getByRole("slider").getAttribute("aria-orientation")).toBe("vertical");
});

/*
  Pressing the handle moves focus to the slider. Without this, the flow "drag with the mouse, then
  finish with the arrow keys" does not work at all. The browser test sets focus explicitly, so it
  skips this transition.
*/
test("pressing the handle moves focus to the slider", () => {
  render(<Panel />);
  const slider = screen.getByRole("slider");
  expect(document.activeElement).not.toBe(slider);

  fireEvent.pointerDown(slider.parentElement as HTMLElement, {
    button: 0,
    pointerId: 1,
    clientX: 100,
  });
  expect(document.activeElement).toBe(slider);
});

/*
  A drag past the limit is clamped to the same number, and there is nothing to report. Previously,
  one movement past the limit produced dozens of identical events in a row, and their target is a
  write to the page URL or to the server.
*/
test("a value clamped to the same number is not reported again", async () => {
  const user = userEvent.setup();
  const onSizeChange = vi.fn();
  render(<Panel defaultSize={400} minSize={120} maxSize={400} onSizeChange={onSizeChange} />);

  // An arrow key at the limit: the value is clamped to the same number, so there is nothing to
  // report. `fireEvent.change` with the same number does not work here: React does not treat it as
  // a change, so the handler is never called.
  screen.getByRole("slider").focus();
  await user.keyboard("{ArrowRight}");
  expect(onSizeChange).not.toHaveBeenCalled();

  await user.keyboard("{ArrowLeft}");
  expect(onSizeChange).toHaveBeenCalledWith(384);
});

/*
  Internal state is not written while the size is controlled. Otherwise, when switching back to
  uncontrolled mode, the panel would jump to a value the consumer never accepted.
*/
test("an uncontrolled panel does not inherit a rejected controlled value", () => {
  const { rerender } = render(<Panel size={300} defaultSize={280} />);
  const region = () => screen.getByRole("region", { name: "Details" });

  fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
  expect(region().style.width).toBe("300px");

  // The consumer removed control: the panel must return to its default, not to the rejected 500.
  rerender(<Panel defaultSize={280} />);
  expect(region().style.width).toBe("280px");
});

/**
 * Collapsing does not drop focus onto `<body>`.
 *
 * With `collapsed`, the handle is unmounted entirely and the panel goes under `hidden`. The
 * component did not check whether focus was on either of them. A keyboard user was in a field
 * inside the panel and pressed the external "Collapse" button: the focused node disappeared, focus
 * fell to `<body>`, and the next Tab started from the top of the page.
 */
/**
 * NOT TESTED HERE: moving focus when collapsing.
 *
 * In jsdom, the `hidden` attribute does not remove focus, and the handle is already unmounted by
 * the time the effect runs. So a check "focus is not on `<body>`" would pass even on unfixed code,
 * relying on the difference between jsdom and a browser. Under ADR-0012 such a check must be a
 * browser test. It lives in `tests-visual/interactions.spec.ts` ("SplitPanel: collapsing moves
 * focus into the content instead of dropping it"). It was verified by reverting the fix: the test
 * fails there.
 */
test("the collapsible panel is hidden, not unmounted", () => {
  function Host({ collapsed }: { collapsed: boolean }) {
    return (
      <SplitPanel aria-label="Details" collapsed={collapsed} panel={<input aria-label="Note" />}>
        <p>Body</p>
      </SplitPanel>
    );
  }

  const { rerender } = render(<Host collapsed={false} />);
  rerender(<Host collapsed />);

  // The panel content stays in the markup. Otherwise, the state of the fields inside would be lost
  // on every collapse.
  expect(screen.getByLabelText("Note")).toBeTruthy();
});
