// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { Toggle } from "../src/components/actions/Toggle.js";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { CheckboxCard } from "../src/components/inputs/CheckboxCard.js";
import { CheckboxGroup } from "../src/components/inputs/CheckboxGroup.js";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";
import { RangeSlider, Slider } from "../src/components/inputs/Slider.js";

afterEach(cleanup);

/*
  A disabled `<fieldset disabled>` (this is how `Form` with `pending` disables its fields)
  disables the nested native controls, but does NOT set `data-disabled` on react-aria
  elements: they know only about their own `isDisabled`. So `disabled:` on their root
  does not fire, and the control looks "alive" while it does not work. Only the `:disabled`
  pseudo-class on the hidden `input` inside sees the native state, hence `has-[input:disabled]:`.

  jsdom has no computed Tailwind styles, so two facts are checked: that the `input` is really
  disabled by an ancestor, and that its wrapper has a class tied to this state.
*/
const inDisabledFieldset = (ui: ReactNode) => render(<fieldset disabled>{ui}</fieldset>);

const dimsOnDisabledDescendant = (el: Element | null) =>
  el?.className.split(" ").includes("has-[input:disabled]:opacity-50");

test("a checkbox inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(<Checkbox>Pin</Checkbox>);
  const input = screen.getByRole("checkbox");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label"))).toBe(true);
});

test("a card checkbox inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <CheckboxGroup label="Where" appearance="card" value={[]} onChange={() => {}}>
      <Checkbox value="a">Site</Checkbox>
    </CheckboxGroup>
  );
  const input = screen.getByRole("checkbox");

  expect(input.matches(":disabled")).toBe(true);
  // The card root is the `div` of the RAC field, not the label inside it.
  expect(dimsOnDisabledDescendant(input.closest("label")?.parentElement ?? null)).toBe(true);
});

test("a radio inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <RadioGroup label="How" value={null} onChange={() => {}}>
      <Radio value="auto">Auto</Radio>
    </RadioGroup>
  );
  const input = screen.getByRole("radio");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label"))).toBe(true);
});

test("a card radio inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <RadioGroup label="How" appearance="card" value={null} onChange={() => {}}>
      <Radio value="auto">Auto</Radio>
    </RadioGroup>
  );
  const input = screen.getByRole("radio");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label")?.parentElement ?? null)).toBe(true);
});

test.each([
  ["Slider", <Slider key="s" label="Level" defaultValue={40} />],
  ["RangeSlider", <RangeSlider key="r" label="Level" defaultValue={[20, 80]} />],
])("a %s inside a disabled fieldset is dimmed as a whole", (_, element) => {
  inDisabledFieldset(element);

  const thumb = screen.getAllByRole("slider")[0]!;
  expect(thumb.matches(":disabled")).toBe(true);
  // The `fieldset` itself also has the `group` role, so the root is looked up from the thumb.
  expect(dimsOnDisabledDescendant(thumb.closest('[role="group"]'))).toBe(true);
});

test("a switch caption inside a disabled fieldset is dimmed together with the track", () => {
  inDisabledFieldset(
    <Toggle checked={false} onCheckedChange={() => {}}>
      Notifications
    </Toggle>
  );
  const control = screen.getByRole("switch");

  // The track dims on its own (`disabled:` on the native button), while the caption
  // dims only by its own `disabled`, so inside the fieldset it stayed bright.
  expect(control.matches(":disabled")).toBe(true);
  expect(
    screen
      .getByText("Notifications")
      .parentElement?.className.split(" ")
      .includes("group-has-[[role=switch]:disabled]/toggle:opacity-50")
  ).toBe(true);
});

test("a disabled node in the description does not dim a working card", () => {
  // A bare `has-disabled` caught any disabled node inside and dimmed a working card
  // because of a button in the description. The condition is narrowed to the hidden `input`.
  render(
    <CheckboxCard tone="accent" description={<button disabled>Upgrade</button>}>
      Analytics
    </CheckboxCard>
  );
  const input = screen.getByRole("checkbox");
  const card = input.closest("[class*='has-[input:disabled]']");
  expect(card).not.toBeNull();
  expect(input.matches(":disabled")).toBe(false);
  expect(card?.matches(":has(input:disabled)")).toBe(false);
  expect(card?.matches(":has(:disabled)")).toBe(true);
});
