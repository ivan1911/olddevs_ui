// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

test("without the underlay the markup does not change by a single node", () => {
  // The slot was added to a STABLE component, and the price of such a change is the promise
  // that without the slot it stays as it was. A wrapper grid must not appear for a field
  // that did not ask for an underlay: half the kit is built on this component, and an extra
  // node would shift every snapshot at once.
  const { container } = render(<TextControl aria-label="Plain" />);

  const shell = container.firstElementChild!;
  expect(shell.children.length).toBe(1);
  expect(shell.firstElementChild!.tagName).toBe("INPUT");
});

test("the underlay lies under the field, not after it", () => {
  const { container } = render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  const grid = container.querySelector(".grid")!;
  // Markup order is paint order: an underlay that ended up on top would cover both the
  // value and the caret.
  expect(grid.children.length).toBe(2);
  expect(grid.firstElementChild!.textContent).toBe("+7 (___)");
  expect(grid.lastElementChild!.tagName).toBe("INPUT");
});

test("the underlay is not read aloud", () => {
  render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  // The layer under the value repeats what the label and the hint already say. Read aloud,
  // it would produce "underscore underscore" in the middle of the field.
  expect(screen.getByText("+7 (___)").getAttribute("aria-hidden")).toBe("true");
});

test("the underlay matches the field in padding and typography", () => {
  const { container } = render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  const underlay = screen.getByText("+7 (___)");
  const field = container.querySelector("input")!;

  // Alignment is held by a shared class rather than by pixel fitting: the start of the text
  // matches by construction and does not drift when the font scale changes.
  for (const cls of ["px-0", "py-[10px]", "text-[13px]", "leading-5"]) {
    expect(underlay.className).toContain(cls);
    expect(field.className).toContain(cls);
  }
  // Mask spaces do not collapse: otherwise the remainder would shift to the left.
  expect(underlay.className).toContain("whitespace-pre");
});

test("the underlay neither intercepts the pointer nor gets selected", () => {
  render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  // The underlay occupies the same cell as the field. If it caught the pointer, the field
  // would stop focusing on a click on its own text.
  //
  // The CLASSES are checked here, not the click itself: jsdom has no layout and no loaded
  // CSS, so `pointer-events` has no effect there, and a "click-through" cannot be proven at
  // all. The real check is in the browser: `tests-visual/interactions.spec.ts`.
  const underlay = screen.getByText("+7 (___)");
  expect(underlay.className).toContain("pointer-events-none");
  expect(underlay.className).toContain("select-none");
});

test("the underlay lives alongside the slots", () => {
  const { container } = render(
    <TextControl aria-label="With an underlay" underlay="+7 (___)" icon={<span>icon</span>} />
  );

  const shell = container.firstElementChild!;
  expect(shell.className).toContain("flex");
  // The grid becomes a flex child and shrinks: without `min-w-0` a long value would push
  // the neighboring slot out of the frame.
  const grid = container.querySelector(".grid")!;
  expect(grid.className).toContain("min-w-0");
  expect(grid.className).toContain("flex-1");
});

/**
 * The counter and `trailing` sit side by side rather than displacing each other.
 *
 * It used to be `counter ?? trailing`: with `showCount` the passed `trailing` did not
 * reach the markup at all, and without a warning — the clear button simply disappeared.
 * On `textarea` the same call worked (the counter moves down), and the mismatch between
 * the two forms of one component went unexplained.
 */
test("showCount does not swallow the trailing slot", () => {
  render(
    <TextControl
      aria-label="Name"
      showCount
      maxLength={100}
      value="abc"
      onChange={() => {}}
      trailing={<button type="button">Clear</button>}
    />
  );

  expect(screen.getByRole("button", { name: "Clear" })).toBeDefined();
  expect(screen.getByText("3/100")).toBeDefined();
});

/*
  HEIGHT STEP — OLDSUI-16.

  Only what jsdom can tell is checked here: the padding class is where it should be and
  is absent where it should not be. The height itself (36 vs. 42) is measured in a live
  browser, in `tests-visual/interactions.spec.ts`: there is no layout in jsdom.
*/
test("the sm step trades ten pixels of padding for seven, and md stays as it was", () => {
  const { rerender } = render(<TextControl aria-label="Search" size="sm" />);
  expect(screen.getByRole("textbox").className).toContain("py-[7px]");

  rerender(<TextControl aria-label="Search" />);
  expect(screen.getByRole("textbox").className).not.toContain("py-[7px]");
});

test("the step does not reach the multiline field: rows and autosize own the height there", () => {
  render(<TextControl aria-label="Note" as="textarea" size="sm" rows={3} />);

  expect(screen.getByRole("textbox").className).not.toContain("py-[7px]");
});

test("the underlay keeps the step, or the mask remainder would slide off the typed text", () => {
  const { container } = render(
    <TextControl aria-label="Phone" size="sm" underlay={<span>+7 (___) ___</span>} />
  );

  // The underlay and the field sit in the same grid cell and hold their alignment through
  // shared paddings — they must not diverge.
  const underlay = container.querySelector("[aria-hidden='true']")!;
  expect(underlay.className).toContain("py-[7px]");
});
