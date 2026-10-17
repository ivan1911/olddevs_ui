// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SelectionBar } from "../src/components/navigation/SelectionBar.js";

afterEach(() => {
  cleanup();
});

test("with zero selected there is no bar at all", () => {
  const { container } = render(<SelectionBar count={0}>actions</SelectionBar>);
  // The rule belongs to the bar, not to the caller: otherwise every call site would write its own
  // `count > 0 &&`, and one of them would eventually forget it.
  expect(container.firstChild).toBeNull();
});

test("the bar is a named group and the count is read inside it", () => {
  render(<SelectionBar count={12}>actions</SelectionBar>);
  const group = screen.getByRole("group", { name: "Actions on selection" });
  expect(group.textContent).toContain("12 selected");
});

test("a custom count label replaces the default", () => {
  render(
    <SelectionBar count={3} countLabel={(n) => `${n} photos selected`}>
      actions
    </SelectionBar>
  );
  expect(screen.getByRole("group").textContent).toContain("3 photos selected");
});

test("the cross clears the selection and has a name", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  render(
    <SelectionBar count={5} onClear={onClear}>
      actions
    </SelectionBar>
  );

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test("without onClear there is no cross", () => {
  render(<SelectionBar count={5}>actions</SelectionBar>);
  expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
});

test("both slots render", () => {
  render(
    <SelectionBar count={2} secondary={<button type="button">Select all</button>}>
      <button type="button">Delete</button>
    </SelectionBar>
  );
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  // The end slot is duplicated in the markup for narrow and wide screens. Both copies are valid;
  // what matters is that it exists at all.
  expect(screen.getAllByRole("button", { name: "Select all" }).length).toBeGreaterThan(0);
});

test("a custom variable name affects both halves of stickiness", () => {
  const { container } = render(
    <SelectionBar count={3} offsetVar="--panel-h">
      actions
    </SelectionBar>
  );
  const bar = screen.getByRole("group");

  // A defect found in review: the observer read the prop, but the sticky point was hard-coded to
  // `--topbar-h`. The bar stuck to one panel and was clipped by the other, so the prop that the
  // contract declares worked only halfway.
  expect(bar.style.top).toBe("var(--panel-h, 0px)");
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});

test("without a custom name the contract default is used", () => {
  render(<SelectionBar count={3}>actions</SelectionBar>);
  expect(screen.getByRole("group").style.top).toBe("var(--topbar-h, 0px)");
});

test("a non-sticky bar announces no sticky point", () => {
  render(
    <SelectionBar count={3} sticky={false}>
      actions
    </SelectionBar>
  );
  expect(screen.getByRole("group").style.top).toBe("");
});
