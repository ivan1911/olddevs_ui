// @vitest-environment jsdom
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SwatchGroup, type SwatchOption } from "../src/components/inputs/SwatchGroup.js";

/**
 * The swatch set: names, roles and keyboard handling on a grid.
 *
 * Horizontal arrows are NOT checked here: the browser handles them by the name of the
 * radio group, and jsdom does not do that at all, so the check would pass even on a
 * broken set. They are measured in a live browser (`tests-visual/interactions.spec.ts`),
 * where the look of the selected state is checked too.
 */

afterEach(cleanup);

const HUES: SwatchOption[] = [
  { value: "none", name: "No colour" },
  { value: "blue", hue: "blue", name: "Blue" },
  { value: "violet", hue: "violet", name: "Violet" },
  { value: "teal", hue: "teal", name: "Teal" },
  { value: "green", hue: "green", name: "Green" },
  { value: "amber", hue: "amber", name: "Amber" },
  { value: "red", hue: "red", name: "Red" },
  { value: "pink", hue: "pink", name: "Pink" },
  { value: "steel", hue: "steel", name: "Steel" },
];

test("the set is a named radio group and every option is named by a word", () => {
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />);

  // Without a name, nine identical circles cannot be told apart by ear at all, and
  // colour is not a name: it cannot be read out.
  expect(screen.getByRole("radiogroup", { name: "Project colour" })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(9);
  expect(screen.getByRole("radio", { name: "Teal" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "No colour" })).toBeTruthy();
});

test("selection is announced by the role, not only by the colour", () => {
  render(<SwatchGroup label="Project colour" value="teal" options={HUES} onChange={vi.fn()} />);

  const checked = screen
    .getAllByRole("radio")
    .filter((radio) => (radio as HTMLInputElement).checked);
  expect(checked).toHaveLength(1);
  expect(checked[0]!).toBe(screen.getByRole("radio", { name: "Teal" }));
});

test("the option shows ONE circle: the swatch itself, with no second dot beside it", () => {
  const { container } = render(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />
  );

  /*
    This is exactly why the component exists: on `RadioGroup` the option had two circles
    in a row — the radio button and the swatch — and a grid of nine read as ripples.
  */
  expect(container.querySelectorAll(".rounded-full.size-6")).toHaveLength(9);
});

test("a click yields the value of the option, not its colour", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} />);

  await user.click(screen.getByRole("radio", { name: "Amber" }));

  expect(onChange).toHaveBeenCalledWith("amber");
});

test("vertical arrows walk the COLUMN, a step of `columns`, and apply at once", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{ArrowDown}");

  // The browser in a radio group reads "down" as "next", which would move focus to the
  // neighboring column. On the grid, down means skipping a full row.
  expect(onChange).toHaveBeenCalledWith("green");
});

test("the edges do not wrap: the set is not a carousel", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{ArrowUp}");

  expect(onChange).not.toHaveBeenCalled();
});

test("Home and End go to the first and the last option", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SwatchGroup label="Project colour" value="teal" options={HUES} onChange={onChange} />);

  screen.getByRole("radio", { name: "Teal" }).focus();
  await user.keyboard("{End}");
  expect(onChange).toHaveBeenLastCalledWith("steel");

  await user.keyboard("{Home}");
  expect(onChange).toHaveBeenLastCalledWith("none");
});

test("a disabled option is not chosen by the edges either", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const options = HUES.map((option, index) =>
    index === 0 ? { ...option, disabled: true } : option
  );
  render(<SwatchGroup label="Project colour" value="teal" options={options} onChange={onChange} />);

  screen.getByRole("radio", { name: "Teal" }).focus();
  await user.keyboard("{Home}");

  // "First" means the first AVAILABLE option: a disabled option stays on screen so the
  // set does not change its layout, but it cannot be selected in any way.
  expect(onChange).toHaveBeenCalledWith("blue");
});

test("a disabled set answers neither the mouse nor the keyboard", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} disabled />
  );

  await user.click(screen.getByRole("radio", { name: "Amber" }));
  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{End}");

  expect(onChange).not.toHaveBeenCalled();
});

test("the step is counted from where the focus is, not from what is selected", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  // The consumer does not apply the value: this is how a save that went to the server
  // behaves — the person is already on the new option, while the old one still counts
  // as selected.
  render(
    <SwatchGroup
      label="Project colour"
      value="none"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Violet" }).focus();
  await user.keyboard("{ArrowDown}");

  // From the focus ("Violet", index 2) down is "Amber" (index 5). From the value
  // ("No colour", index 0) it would be "Green".
  expect(onChange).toHaveBeenCalledWith("amber");
});

/*
  TOOLTIP WITH THE SHADE NAME (`tooltips`).

  The delay is turned off here (`delayDuration={0}`): the check is WHAT the tooltip
  names and who gets its text. The pace is set by the shared provider, and there is
  nothing to measure it with here.
*/

const withTooltips = (ui: React.ReactNode) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

/** The tooltip does not appear instantly even with zero delay: Radix opens it in an effect. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("without the prop there is no tooltip at all — and no TooltipProvider needed", async () => {
  // The set shipped before the tooltip and is used by consumers without a provider:
  // without `tooltips` it must render outside a provider, or the patch would break them
  // on update. Radix throws without a provider, so the render itself is the check.
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />);

  screen.getByRole("radio", { name: "Amber" }).focus();
  await settle();

  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("the tooltip names the option under the keyboard focus, not only under the mouse", async () => {
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  screen.getByRole("radio", { name: "Amber" }).focus();
  await settle();

  // A tooltip on the radio button itself would appear only with the mouse: RAC does not
  // pass `onFocus` and `onBlur` into the markup. Hence the wrapper.
  expect(screen.getByRole("tooltip").textContent).toBe("Amber");
});

test("the name is still announced ONCE: the tooltip describes nothing", async () => {
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  const radio = screen.getByRole("radio", { name: "Amber" });
  radio.focus();
  await settle();

  /*
    The main check of the task. Radix puts `aria-describedby` on the trigger, and on the
    option itself that would double the name: "Amber Amber". The description must settle
    on the wrapper: the radio button has no `aria-describedby` of its own, and a
    description is not inherited from an ancestor.
  */
  expect(radio.getAttribute("aria-describedby")).toBeNull();
  expect(radio.closest("label")?.getAttribute("aria-describedby")).toBeNull();
  expect(screen.getByRole("tooltip").id).toBe(
    radio.closest("span.block")?.getAttribute("aria-describedby")
  );
});

test("Escape removes the tooltip and leaves the focus where it was", async () => {
  const user = userEvent.setup();
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  const radio = screen.getByRole("radio", { name: "Amber" });
  radio.focus();
  await settle();
  await user.keyboard("{Escape}");
  await settle();

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(document.activeElement).toBe(radio);
});

test("a disabled option is named too: «what colour is it» is a fair question", async () => {
  const user = userEvent.setup();
  const options = HUES.map((option) =>
    option.value === "red" ? { ...option, disabled: true } : option
  );
  withTooltips(
    <SwatchGroup
      label="Project colour"
      value="blue"
      options={options}
      onChange={vi.fn()}
      tooltips
    />
  );

  await user.hover(screen.getByRole("radio", { name: "Red" }).closest("label")!);
  await settle();

  expect(screen.getByRole("tooltip").textContent).toBe("Red");
});

test("the wrapper does not swallow the click: the option is still chosen by the mouse", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} tooltips />
  );

  await user.click(screen.getByRole("radio", { name: "Amber" }));

  expect(onChange).toHaveBeenCalledWith("amber");
});

test("the tooltip does not take the grid keys away", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  withTooltips(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
      tooltips
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await settle();
  await user.keyboard("{ArrowDown}");

  expect(onChange).toHaveBeenCalledWith("green");
});
