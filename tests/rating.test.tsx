// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Rating } from "../src/components/inputs/Rating.js";

afterEach(cleanup);

function Stars({
  initial = 0,
  readOnly = false,
  disabled = false,
  onValue = () => {},
}: {
  initial?: number;
  readOnly?: boolean;
  disabled?: boolean;
  onValue?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Rating
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      readOnly={readOnly}
      disabled={disabled}
      aria-label="Quality"
    />
  );
}

test("clicking a star sets that value", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars onValue={onValue} />);

  await user.click(screen.getByRole("radio", { name: "4 of 5" }));
  expect(onValue).toHaveBeenCalledWith(4);
});

/*
  The keyboard model is a radio group: five tab stops for one question is five
  stops where there is one answer.
*/
/*
  Roving tabindex: exactly one star is in the tab order — the chosen one. Without it
  the group is declared a radio group but built as a row of non-interactive elements,
  and the arrow changes the value silently.
*/
test("the whole rating is one tab stop, and it is the chosen star", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>before</button>
      <Stars initial={3} />
      <button>after</button>
    </>
  );

  screen.getByRole("button", { name: "before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "3 of 5" }));

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
});

test("with no rating yet the first star holds the tab stop", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>before</button>
      <Stars initial={0} />
    </>
  );

  screen.getByRole("button", { name: "before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 of 5" }));
});

/*
  The state must sit on the element, not only in the caption: without it a screen
  reader reads five identical radio buttons.
*/
test("only the chosen star is checked", () => {
  render(<Stars initial={2} />);
  const checked = screen
    .getAllByRole("radio")
    .filter((star) => star.getAttribute("aria-checked") === "true");
  expect(checked).toHaveLength(1);
  expect(checked[0]?.getAttribute("aria-label")).toBe("2 of 5");
});

/*
  Focus follows the value: otherwise the next arrow would count from the previous star,
  while the new value is the one announced.
*/
test("focus follows the value so the next arrow counts from it", async () => {
  const user = userEvent.setup();
  render(<Stars initial={2} />);

  screen.getByRole("radio", { name: "2 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "3 of 5" }));
});

test("arrows move the value and Home and End reach the ends", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={3} onValue={onValue} />);

  screen.getByRole("radio", { name: "3 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).toHaveBeenLastCalledWith(4);

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(3);

  await user.keyboard("{End}");
  expect(onValue).toHaveBeenLastCalledWith(5);

  // `Home` goes to zero, not to one: zero is declared a legal value, and it is
  // the bottom edge of the group.
  await user.keyboard("{Home}");
  expect(onValue).toHaveBeenLastCalledWith(0);
});

/*
  Zero is reachable only by an arrow back from one: clearing a rating is a legal
  action, but nobody lands on it by accident.
*/
test("the value can be taken back to zero but never below", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={1} onValue={onValue} />);

  screen.getByRole("radio", { name: "1 of 5" }).focus();
  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(0);

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(0);
});

/*
  `readOnly` and `disabled` are different states. The first shows data and does not
  dim it; the second dims it, because the action is unavailable right now.
*/
test("read-only shows the value, leaves the tab order and is not dimmed", () => {
  const { container } = render(<Stars initial={4} readOnly />);

  expect(screen.queryByRole("radiogroup")).toBeNull();
  // The name is COMPOSED from the consumer's label and the value, not replaced by it:
  // "Rated 4 out of 5" without a subject is a value without an answer to "of what".
  expect(screen.getByRole("img", { name: "Quality Rated 4 out of 5" })).toBeTruthy();
  expect(container.querySelector(".opacity-50")).toBeNull();
});

/*
  A disabled rating stays a radio group and is marked with `aria-disabled`:
  `role="img"` would be read as a picture, not as an unavailable action. The keyboard
  is checked with an event on the group itself — otherwise the event goes to `body`
  and the test passes with any code.
*/
test("disabled keeps the role, marks itself and refuses input", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  const { container } = render(<Stars initial={2} disabled onValue={onValue} />);

  const group = screen.getByRole("radiogroup");
  expect(group.getAttribute("aria-disabled")).toBe("true");
  expect(container.querySelector(".opacity-50")).toBeTruthy();
  // The stars are removed from the tab order entirely.
  expect(screen.getAllByRole("radio").every((star) => !star.hasAttribute("tabindex"))).toBe(true);

  await user.click(screen.getByRole("radio", { name: "4 of 5" }));
  group.focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).not.toHaveBeenCalled();
});

/*
  The colour and the number of filled stars are the only visual carrier of the value.
  Without a text line a screen reader would read five identical elements.
*/
/*
  The value in words is part of the group name in interactive mode too: without it an
  arrow would change `aria-checked` on the element, and nothing would be spoken aloud.
*/
test("the value is part of the group name, not a stray line", () => {
  render(<Stars initial={3} />);
  expect(screen.getByRole("radiogroup", { name: "Quality Rated 3 out of 5" })).toBeTruthy();
});

test("the caption is the consumer's, the kit does not compute it", () => {
  render(<Rating value={4} aria-label="Quality" caption="4,2 · 128 ratings" />);
  expect(screen.getByText("4,2 · 128 ratings")).toBeTruthy();
});

/*
  The star token is its own, not `--warning`: the colour is the same today, and that is
  the trap — editing the warning would silently recolour every rating (ADR-0040).
*/
test("filled stars take the rating token, empty ones the muted foreground", () => {
  const { container } = render(<Stars initial={2} />);

  expect(container.querySelectorAll(".text-rating-star")).toHaveLength(2);
  expect(container.querySelectorAll(".text-fg-3")).toHaveLength(3);
});

/*
  The type allows a fractional `value`, and the component takes its fill from it
  (`star <= 4.2` gives four stars), so it cannot be forbidden silently. Previously it
  matched none of the stars, roving tabindex put the tab stop nowhere, and the radio
  group became unreachable from the keyboard altogether.
*/
test("a fractional value still leaves exactly one tab stop", () => {
  render(<Stars initial={4.2} />);

  const stars = screen.getAllByRole("radio");
  const tabbable = stars.filter((s) => s.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]?.getAttribute("aria-label")).toBe("4 of 5");
});

test("a non-numeric value does not strand the control either", () => {
  render(<Stars initial={Number.NaN} />);

  const tabbable = screen.getAllByRole("radio").filter((s) => s.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
});

/*
  `max` and `value` come from the consumer's data, and their type is a plain number.
  A scale with zero divisions is not a scale: previously `max={0}` gave a radio group
  with no options at all and the caption "out of 0".
*/
test("a degenerate max is brought back to a usable scale", () => {
  render(<Rating value={1} max={0} aria-label="Quality" />);
  expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
  expect(screen.getByText("Rated 1 out of 1")).toBeTruthy();
});

test("a non-numeric value is announced as zero, not as NaN", () => {
  render(<Rating value={Number.NaN} aria-label="Quality" />);
  expect(screen.getByText("Rated 0 out of 5")).toBeTruthy();
});

/*
  An event without a change of value is read by the recipient as an edit. An arrow at
  the edge and a click on an already chosen star do not change the value.
*/
test("the rating stays silent when the value would not change", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={5} onValue={onValue} />);

  screen.getByRole("radio", { name: "5 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).not.toHaveBeenCalled();

  await user.click(screen.getByRole("radio", { name: "5 of 5" }));
  expect(onValue).not.toHaveBeenCalled();

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenCalledWith(4);
});

/**
 * The arithmetic runs on the COERCED numbers, not on the raw props.
 *
 * The file declares in a comment "coercing both numbers before any use" and computes
 * `total` and `rounded` — but `onKeyDown` did not use them: `End` took the raw `max`,
 * the arrows took the raw `value`. Both come from the consumer's data, and the `max`
 * JSDoc explicitly allows them to be any value.
 */
describe("keyboard arithmetic uses the coerced numbers", () => {
  test("End goes to the top of the scale even when max is not a number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={2} max={Number.NaN} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{End}");

    // `clamp(NaN, 0, total)` returns `NaN`, the check `clamped === rounded` does not
    // fire on it, and `onChange(NaN)` went out: the consumer's rating became `NaN` for good.
    const [value] = onChange.mock.calls.at(-1) ?? [];
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBe(5);
  });

  test("End goes to the top, not to zero, when max is zero", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={0} max={0} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{End}");

    // `max={0}` is coerced to a scale of one star; End must give it, not zero.
    expect(onChange).toHaveBeenCalledWith(1);
  });

  test("an arrow steps from the rounded value, not from the fraction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    /*
      A value OUTSIDE the clamp zone.

      On `4.2` the raw step gave `5.2`, but `clamp(…, 5)` returned `5` — that is,
      exactly the expected result, and the test passed on unfixed code. On `2.2` the step
      from the raw value gives `3.2`, the clamp does not touch it, and the difference shows.
    */
    render(<Rating value={2.2} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith(3);
  });

  test("a fractional value still marks a star as checked", () => {
    render(<Rating value={4.2} onChange={() => {}} aria-label="Rating" />);

    // Fill and roving were computed from `rounded`, while `aria-checked` came from the
    // raw `value`: the radio group was announced with no option selected at all.
    const checked = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });
});
