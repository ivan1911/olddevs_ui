// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";

afterEach(cleanup);

function Group({ initial = null, disabled }: { initial?: string | null; disabled?: boolean }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <RadioGroup label="How to publish" value={value} onChange={setValue} disabled={disabled}>
      <Radio value="now">Right away</Radio>
      <Radio value="later">On schedule</Radio>
      <Radio value="manual" disabled>
        Manually — unavailable
      </Radio>
    </RadioGroup>
  );
}

test("the group holds the value, not the buttons", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <RadioGroup label="How to publish" value="now" onChange={onChange}>
      <Radio value="now">Right away</Radio>
      <Radio value="later">On schedule</Radio>
    </RadioGroup>
  );

  await user.click(screen.getByRole("radio", { name: "On schedule" }));

  // A `string` is passed out, not an array or an event: exactly one option is selected.
  expect(onChange).toHaveBeenCalledWith("later");
});

test("arrows walk the set and CHANGE the value", async () => {
  const user = userEvent.setup();
  render(<Group initial="now" />);

  screen.getByRole("radio", { name: "Right away" }).focus();
  await user.keyboard("{ArrowDown}");

  // This is the behavior of a radio group, not of a list: the arrow does not merely
  // move focus, it selects. In a list it would be the other way round.
  expect((screen.getByRole("radio", { name: "On schedule" }) as HTMLInputElement).checked).toBe(
    true
  );
});

test("arrows skip the disabled option", async () => {
  const user = userEvent.setup();
  render(<Group initial="later" />);

  screen.getByRole("radio", { name: "On schedule" }).focus();
  await user.keyboard("{ArrowDown}");

  // "Manually" is disabled, so the set wraps around to the first available option.
  expect((screen.getByRole("radio", { name: "Right away" }) as HTMLInputElement).checked).toBe(
    true
  );
});

test("tab cannot enter the set past the selected option", () => {
  render(<Group initial="later" />);

  // Exactly one option is reachable by Tab — the selected one. Otherwise a keyboard
  // user would pass through every button of the set one by one.
  //
  // The check counts `tabindex="0"`, not "anything but -1": a disabled option has no
  // attribute at all — it is unreachable anyway, so setting -1 on it is pointless.
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  const tabbable = radios.filter((el) => el.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]!.value).toBe("later");
  expect(radios.filter((el) => el.getAttribute("tabindex") === "-1")).toHaveLength(1);
});

test("group disabled overrides the individual one", () => {
  render(<Group disabled />);
  for (const el of screen.getAllByRole("radio"))
    expect((el as HTMLInputElement).disabled).toBe(true);
});

test("a repeated click cannot clear the selection", async () => {
  const user = userEvent.setup();
  render(<Group initial="now" />);

  await user.click(screen.getByRole("radio", { name: "Right away" }));

  // A radio group cannot clear its selection by definition: the set answers the question,
  // and "no answer" is a separate explicit option, not an empty value.
  expect((screen.getByRole("radio", { name: "Right away" }) as HTMLInputElement).checked).toBe(
    true
  );
});
