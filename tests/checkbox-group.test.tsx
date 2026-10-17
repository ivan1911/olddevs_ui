// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { CheckboxGroup } from "../src/components/inputs/CheckboxGroup.js";
import { CHOICE_CARD_IDLE_BORDER, CHOICE_CARD_SELECTED_BORDER } from "../src/lib/choice-card.js";
import { TONE_TOKENS, type Tone } from "../src/lib/variants.js";

afterEach(cleanup);

function GroupDemo({
  initial = [],
  disabled,
  errorMessage,
}: {
  initial?: string[];
  disabled?: boolean;
  errorMessage?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label="Where to publish"
      value={value}
      onChange={setValue}
      disabled={disabled}
      errorMessage={errorMessage}
      description="Pick more than one"
    >
      <Checkbox value="tg">Telegram</Checkbox>
      <Checkbox value="vk" disabled>
        VK
      </Checkbox>
    </CheckboxGroup>
  );
}

test("a checkbox state comes from membership in the group array", () => {
  render(<GroupDemo initial={["tg"]} />);

  expect((screen.getByRole("checkbox", { name: "Telegram" }) as HTMLInputElement).checked).toBe(
    true
  );
  expect((screen.getByRole("checkbox", { name: "VK" }) as HTMLInputElement).checked).toBe(false);
});

test("picking appends to the array instead of replacing it", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <CheckboxGroup label="Where to publish" value={["tg"]} onChange={onChange}>
      <Checkbox value="tg">Telegram</Checkbox>
      <Checkbox value="ok">OK</Checkbox>
    </CheckboxGroup>
  );

  await user.click(screen.getByRole("checkbox", { name: "OK" }));

  expect(onChange).toHaveBeenCalledWith(["tg", "ok"]);
});

test("group disabled overrides the individual one instead of adding to it", () => {
  render(<GroupDemo disabled />);

  // Both are disabled, including the one with no `disabled` of its own: the whole group
  // is unavailable, so every item is unavailable. There is no other reading here.
  expect((screen.getByRole("checkbox", { name: "Telegram" }) as HTMLInputElement).disabled).toBe(
    true
  );
  expect((screen.getByRole("checkbox", { name: "VK" }) as HTMLInputElement).disabled).toBe(true);
});

test("an individual disabled does not disable the group", () => {
  render(<GroupDemo />);

  expect((screen.getByRole("checkbox", { name: "Telegram" }) as HTMLInputElement).disabled).toBe(
    false
  );
  expect((screen.getByRole("checkbox", { name: "VK" }) as HTMLInputElement).disabled).toBe(true);
});

test("the error is linked to the group, not just placed nearby", () => {
  render(<GroupDemo errorMessage="Pick at least one channel" />);

  const group = screen.getByRole("group", { name: "Where to publish" });
  const describedBy = group.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();

  const text = describedBy!
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
  expect(text).toContain("Pick at least one channel");
});

test("the error displaces the hint instead of standing under it", () => {
  render(<GroupDemo errorMessage="Pick at least one channel" />);

  expect(screen.getByText("Pick at least one channel")).toBeTruthy();
  // Two lines under the group, one contradicting the other, are a source of noise.
  expect(screen.queryByText("Pick more than one")).toBeNull();
});

// ─── tone ────────────────────────────────────────────────────────────────────

const classesOf = (el: Element) => el.className.split(/\s+/);
const hasAll = (el: Element, classes: string) =>
  classes.split(/\s+/).every((c) => classesOf(el).includes(c));

/** Finds the node or fails the test: negative checks must not pass on an empty result. */
function must<T extends Element>(el: T | null | undefined, what: string): T {
  if (!el) throw new Error(`Not found: ${what}`);
  return el;
}

/** The card root (the react-aria field): the frame hangs on it, not on the `input`. */
const cardOf = (name: string) =>
  must(screen.getByRole("checkbox", { name }).closest("div[data-rac]"), `card of ${name}`);
/**
 * The checkbox box in its default form: a `span` with a border. The label's first
 * `span` hides the `input`.
 */
const boxOf = (name: string) =>
  must(cardOf(name).querySelector("label > span.border"), `box of ${name}`);
const indicatorOf = (name: string) =>
  must(cardOf(name).querySelector("[data-indicator]"), `indicator of ${name}`);

function ToneGroup({
  tone,
  appearance,
  boxTone,
}: {
  tone?: Tone;
  appearance?: "default" | "card";
  boxTone?: Tone;
}) {
  return (
    <CheckboxGroup
      label="Modules"
      value={["a"]}
      onChange={() => {}}
      tone={tone}
      appearance={appearance}
    >
      <Checkbox value="a" tone={boxTone}>
        Checked
      </Checkbox>
      <Checkbox value="b" tone={boxTone}>
        Unchecked
      </Checkbox>
    </CheckboxGroup>
  );
}

test("the group tone paints the border and the box of a checked card", () => {
  render(<ToneGroup tone="danger" appearance="card" />);

  expect(classesOf(cardOf("Checked"))).toContain(CHOICE_CARD_SELECTED_BORDER.danger);
  expect(hasAll(indicatorOf("Checked"), TONE_TOKENS.danger.solid)).toBe(true);
});

test("an unchecked card stays neutral under any group tone", () => {
  render(<ToneGroup tone="danger" appearance="card" />);

  expect(classesOf(cardOf("Unchecked"))).toContain(CHOICE_CARD_IDLE_BORDER);
  expect(hasAll(indicatorOf("Unchecked"), TONE_TOKENS.danger.solid)).toBe(false);
});

test("the group tone wins over the tone of a single checkbox inside it", () => {
  // The set cannot drift apart visually: as in `RadioGroup`, one tone for all.
  render(<ToneGroup tone="success" appearance="card" boxTone="danger" />);

  expect(classesOf(cardOf("Checked"))).toContain(CHOICE_CARD_SELECTED_BORDER.success);
  expect(classesOf(cardOf("Checked"))).not.toContain(CHOICE_CARD_SELECTED_BORDER.danger);
  expect(hasAll(indicatorOf("Checked"), TONE_TOKENS.success.solid)).toBe(true);
});

test("without a group tone each checkbox card keeps its own tone", () => {
  render(<ToneGroup appearance="card" boxTone="warning" />);

  expect(classesOf(cardOf("Checked"))).toContain(CHOICE_CARD_SELECTED_BORDER.warning);
  expect(hasAll(indicatorOf("Checked"), TONE_TOKENS.warning.solid)).toBe(true);
});

test("without any tone a checked card is accent", () => {
  render(<ToneGroup appearance="card" />);

  expect(classesOf(cardOf("Checked"))).toContain(CHOICE_CARD_SELECTED_BORDER.accent);
});

test("the group tone paints the box of a plain checkbox row too", () => {
  render(<ToneGroup tone="warning" />);

  expect(hasAll(boxOf("Checked"), TONE_TOKENS.warning.solid)).toBe(true);
  expect(hasAll(boxOf("Unchecked"), TONE_TOKENS.warning.solid)).toBe(false);
});

test("without a group tone a plain checkbox row keeps the tone of the checkbox", () => {
  render(<ToneGroup boxTone="success" />);

  expect(hasAll(boxOf("Checked"), TONE_TOKENS.success.solid)).toBe(true);
});

test("a checkbox outside a group paints itself with its own tone", () => {
  render(
    <Checkbox checked tone="danger" onCheckedChange={() => {}}>
      Solo
    </Checkbox>
  );

  expect(hasAll(boxOf("Solo"), TONE_TOKENS.danger.solid)).toBe(true);
});
