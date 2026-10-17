// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Breadcrumbs } from "../src/components/navigation/Breadcrumbs.js";
import { Pagination, pageRange } from "../src/components/navigation/Pagination.js";
import { Stepper } from "../src/components/navigation/Stepper.js";

afterEach(cleanup);

test("with a single page nothing is drawn", () => {
  const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);

  // A pagination made of a single button reports a navigation where there is
  // nowhere to go.
  expect(container.firstChild).toBeNull();
});

test("page range: the edges are always visible, the middle collapses", () => {
  // Five pages fit in the row whole, and since wave 26 the row is padded to a
  // constant width. Hiding the third and fourth behind an ellipsis when there is
  // room for them is exactly the jumping width that made the button slide out
  // from under the cursor. The file's rule "one skipped page is cheaper to show"
  // is simply taken to its end here.
  expect(pageRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  expect(pageRange(12, 24, 1)).toEqual([1, "gap", 11, 12, 13, "gap", 24]);
  // One skipped page is cheaper to show than to hide behind an ellipsis.
  // Here exactly one page (the second) is hidden on the left, so we show it.
  expect(pageRange(4, 9, 1)).toEqual([1, 2, 3, 4, 5, "gap", 9]);
  expect(pageRange(3, 5, 1)).toEqual([1, 2, 3, 4, 5]);
});

test("the row width does not grow with the number of pages", () => {
  const narrow = pageRange(50, 100, 1).length;
  const wide = pageRange(50, 10000, 1).length;

  // Buttons under the cursor must not jump when moving to an adjacent page.
  expect(narrow).toBe(wide);
});

test("the last crumb is not a link", () => {
  render(<Breadcrumbs items={[{ label: "Library", href: "/lib" }, { label: "Sunsets" }]} />);

  // A link to the current page promises a navigation that will not happen.
  expect(screen.queryByRole("link", { name: "Sunsets" })).toBeNull();
  expect(screen.getByText("Sunsets").getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Library" })).toBeTruthy();
});

test("a long trail collapses and the edges remain", () => {
  render(
    <Breadcrumbs
      items={[
        { label: "Root", href: "#" },
        { label: "Second", href: "#" },
        { label: "Third", href: "#" },
        { label: "Fourth", href: "#" },
        { label: "Current" },
      ]}
    />
  );

  expect(screen.getByRole("link", { name: "Root" })).toBeTruthy();
  expect(screen.getByText("Current")).toBeTruthy();
  // The middle of the trail does not say where the user is.
  expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
});

test("you can go back only to a completed step", async () => {
  const user = userEvent.setup();
  const onStep = vi.fn();

  render(
    <Stepper
      steps={[
        { id: "a", label: "Files" },
        { id: "b", label: "Description" },
        { id: "c", label: "Schedule" },
      ]}
      current={1}
      onStepClick={onStep}
    />
  );

  // A completed step is clickable.
  await user.click(screen.getByRole("button", { name: /Files/ }));
  expect(onStep).toHaveBeenCalledWith(0);

  // A future step is not: it requires data that does not exist yet.
  expect(screen.queryByRole("button", { name: /Schedule/ })).toBeNull();
});

test("the current step is announced as a step, not as a page", () => {
  render(
    <Stepper
      steps={[
        { id: "a", label: "Files" },
        { id: "b", label: "Description" },
      ]}
      current={1}
    />
  );

  const current = screen.getByText("Description").closest("li");
  expect(current?.getAttribute("aria-current")).toBe("step");
});

/**
 * The step state is spoken, not only drawn.
 *
 * The numbered circle or checkmark is `aria-hidden`, and beyond that the state
 * "completed / current / upcoming" is expressed nowhere: the `li` has only
 * `aria-current` on the active one. A screen reader read the wizard as five
 * identical items plus the current one, and did not report which steps were
 * already filled in and which were still ahead.
 */
test("each step announces whether it is done, current or upcoming", () => {
  render(
    <Stepper
      current={1}
      steps={[
        { id: "a", label: "Details" },
        { id: "b", label: "Files" },
        { id: "c", label: "Review" },
      ]}
    />
  );

  const items = screen.getAllByRole("listitem");
  const texts = items.map((li) => li.textContent ?? "");
  expect(texts[0]).toContain("completed");
  expect(texts[2]).toContain("not started");

  // The current step does NOT get the "current step" text in its own row:
  // `aria-current` announces it. Otherwise the second row would read as
  // "current step, current step, Payment".
  expect(items[1]?.getAttribute("aria-current")).toBe("step");
  expect(texts[1]).not.toContain("current step");
});
