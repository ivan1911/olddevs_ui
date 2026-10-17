// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Checkbox } from "../src/components/inputs/Checkbox.js";

afterEach(cleanup);

// Clicks on the LABEL are deliberately not checked here: jsdom does not reproduce the
// activation of a `<label>` by a click on its descendant the way a browser does, so the
// test would either fail on a working component or check the wrong thing. For exactly
// this reason the focus trap is not checked in jsdom either (ADR-0012).
// The real check is in a browser: `tests-visual/interactions.spec.ts`.

test("onCheckedChange receives a boolean, not an event", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(<Checkbox onCheckedChange={onCheckedChange}>Consent</Checkbox>);

  await user.click(screen.getByRole("checkbox"));

  expect(onCheckedChange).toHaveBeenCalledTimes(1);
  // The value itself, not a `ChangeEvent`: the kit's vocabulary speaks of state, while
  // RAC speaks of `isSelected`, so the wrapper has to translate one into the other.
  expect(onCheckedChange).toHaveBeenCalledWith(true);
});

test("the third state does not pass itself off as checked", () => {
  render(
    <Checkbox indeterminate onCheckedChange={() => {}}>
      Partly selected
    </Checkbox>
  );

  const box = screen.getByRole("checkbox") as HTMLInputElement;
  // The `indeterminate` PROPERTY is checked, not the `aria-checked` attribute: RAC renders
  // a native `<input type="checkbox">`, for which "partial" is a DOM property, while the
  // browser exposes "mixed" to the accessibility tree on its own. There must be no
  // `aria-checked` attribute here: duplicating native semantics with an ARIA attribute is
  // a known way to let the two drift apart.
  expect(box.indeterminate).toBe(true);
  expect(box.checked).toBe(false);
});

test("a click does not clear the third state", async () => {
  const user = userEvent.setup();
  render(
    <Checkbox indeterminate onCheckedChange={() => {}}>
      Partly selected
    </Checkbox>
  );

  await user.click(screen.getByRole("checkbox"));

  // It stays "partial": the caller sets this state when it recalculates the set.
  // Clearing it with a click would mean inventing what the user meant.
  expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
});

test("a checkbox without a visible label takes its name from label", () => {
  render(<Checkbox label="Select all rows" />);
  expect(screen.getByRole("checkbox", { name: "Select all rows" })).toBeTruthy();
});

test("the hint is linked to the checkbox, not just placed nearby", () => {
  render(<Checkbox description="Arrives by email within a day">Send a report</Checkbox>);

  const box = screen.getByRole("checkbox");
  const describedBy = box.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy!)?.textContent).toBe("Arrives by email within a day");
});

test("a disabled checkbox does not toggle", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Checkbox disabled onCheckedChange={onCheckedChange}>
      Unavailable
    </Checkbox>
  );

  await user.click(screen.getByRole("checkbox"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("states sit on the RAC element as data attributes", async () => {
  const user = userEvent.setup();
  const { container } = render(<Checkbox indeterminate>Partly selected</Checkbox>);

  // This is not cosmetic: it is a load-bearing assumption of the package. The `hover:`
  // and `disabled:` variants from the tone vocabulary act on react-aria elements only
  // because the plugin overrides them with a double selector
  // `:is(:where([data-rac])[data-hovered], :where(:not([data-rac])):hover)`.
  // If `data-rac` on the `<label>` ever disappears, the vocabulary silently stops painting
  // states, and no snapshot will show it: the states are captured at rest.
  const label = container.querySelector("label")!;
  expect(label.hasAttribute("data-rac")).toBe(true);
  expect(label.hasAttribute("data-indeterminate")).toBe(true);

  await user.hover(label);
  expect(label.hasAttribute("data-hovered")).toBe(true);
});

test("the hit area is 24px tall even when the control is smaller", () => {
  render(<Checkbox label="Done" />);

  /*
    Measured on 3.12.0: `md` without a visible label gave a 26×22 target, and `sm` with
    a label gave 20 in height. Of the four combinations of size and label, only one
    passed the WCAG 2.5.8 threshold.

    The height in the layout cannot be raised: the list row holds it at 32 pixels. So the
    target is extended with a pseudo-element: the control keeps its place, and the hit
    area is 24px.
  */
  const control = screen.getByRole("checkbox").closest("label")!;

  // Two strips along the edges, not a layer over the control: the layer captured the
  // pointer over its own label, and one pushed under the content with `-z-10` went behind
  // the ancestor's background and stopped catching clicks altogether.
  expect(control.className).toContain("before:bottom-full");
  expect(control.className).toContain("after:top-full");
  // Without `relative`, the strips would be positioned against a foreign ancestor and
  // would land somewhere unpredictable.
  expect(control.className).toContain("relative");
});
