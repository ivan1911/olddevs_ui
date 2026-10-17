// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { parseDate, parseDateTime } from "@internationalized/date";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { DateTimePicker } from "../src/components/date-time/DateTimePicker.js";
import { TimePicker, upcomingSlots } from "../src/components/date-time/TimePicker.js";

/**
 * The "nearest first" order and the equal standing of the two ways of entering a value
 * are what neither the snapshot nor axe can see. The snapshot shows the closed field;
 * here it is checked that the list starts with the right slot, that the filter does not
 * swallow it when a value is already selected, and that blur with a typed value still
 * commits as before.
 */

afterEach(cleanup);

describe("upcomingSlots — the nearest future first, wrapping around", () => {
  test.each([
    // [now, first slot, last slot]
    ["14:07", "14:30", "14:00"],
    // Exactly on a slot means "strictly after": that slot cannot be offered again.
    ["14:30", "15:00", "14:30"],
    // The end of the day wraps around to midnight.
    ["23:45", "00:00", "23:30"],
    // Midnight is a special case of "exactly on a slot".
    ["00:00", "00:30", "00:00"],
  ])("in %s the list starts with %s", (now, first, last) => {
    const [h, m] = now.split(":").map(Number);
    const slots = upcomingSlots(30, new Date(2026, 6, 27, h!, m!));
    expect(slots[0]).toBe(first);
    expect(slots.at(-1)).toBe(last);
    expect(slots).toHaveLength(48);
  });

  test("a 15-minute step yields 96 slots", () => {
    expect(upcomingSlots(15, new Date(2026, 6, 27, 12, 0))).toHaveLength(96);
  });
});

describe("TimePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 27, 14, 7));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (props: Partial<Parameters<typeof TimePicker>[0]> = {}) => {
    const onChange = vi.fn();
    render(<TimePicker value="10:00" onChange={onChange} {...props} />);
    return { onChange, user: userEvent.setup(), field: screen.getByRole("combobox") };
  };

  test("focus opens the list, the first slot is the nearest future one", async () => {
    const { user, field } = setup();
    await user.click(field);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0]!.textContent).toBe("14:30");
    // The selected value is marked, even though it is not first.
    expect(screen.getByRole("option", { name: "10:00" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("clicking a slot calls onChange and closes the list", async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.click(screen.getByRole("option", { name: "21:00" }));

    expect(onChange).toHaveBeenCalledWith("21:00");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("typed text filters by prefix, Enter takes the highlighted one", async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.clear(field);
    await user.keyboard("21");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["21:00", "21:30"]);

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("21:30");
  });

  test("an already selected value does not filter the list on opening", async () => {
    const { user, field } = setup();
    await user.click(field);

    // The filter applies only to what was typed after opening; otherwise value="10:00"
    // would narrow the list down to a single item.
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(48);
  });

  test("Enter without a highlight commits what was typed, as before", async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.clear(field);
    await user.keyboard("2145{Enter}");

    expect(onChange).toHaveBeenCalledWith("21:45");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("blur normalises partial input — the field's existing contract", async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.clear(field);
    await user.keyboard("7");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("07:00");
  });

  test("Escape closes the list without touching the value", async () => {
    const { onChange, user, field } = setup();
    await user.click(field);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("an empty filter result hides the panel, typing continues", async () => {
    const { user, field } = setup();
    await user.click(field);
    await user.clear(field);
    await user.keyboard("77");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect((field as HTMLInputElement).value).toBe("77");
  });

  test("step is passed through to the list", async () => {
    const { user, field } = setup({ step: 15 });
    await user.click(field);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(96);
    expect(options[0]!.textContent).toBe("14:15");
  });
});

/**
 * An empty field does not turn into midnight when focus leaves it.
 *
 * `normalizeTime("", value ?? "00:00")` on an empty value returned `00:00`, and
 * `next !== value` was true (`"00:00" !== null`): a user who tabbed through the form,
 * touching the field and typing nothing, sent `onChange("00:00")` outward. The form became
 * dirty, and the publish drifted to midnight.
 */
test("tabbing through an empty field commits nothing", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TimePicker value={null} onChange={onChange} />);

  await user.click(screen.getByRole("combobox"));
  await user.tab();

  expect(onChange).not.toHaveBeenCalled();
});

/**
 * A non-positive step does not hang the tab.
 *
 * The loop `m += step` never ends with zero, and with a negative step it runs off into
 * negative values: the array grows until memory runs out. `openList` is called from
 * `onFocus`, so the tab hung on the very first focus of the field.
 */
test.each([0, -15, Number.NaN])("step %o falls back instead of hanging", (step) => {
  expect(() => upcomingSlots(step, new Date("2026-03-15T10:00:00"))).not.toThrow();
  expect(upcomingSlots(step, new Date("2026-03-15T10:00:00")).length).toBe(48);
});

/**
 * A value rejected by the parent does not linger in the field.
 *
 * `commit` wrote to local state immediately; if the prop did not change, the `[value]`
 * effect did not fire, and the text the parent had not accepted stayed in the field forever.
 */
/**
 * Uncontrolled call: `value` is optional, and what was typed must stay.
 *
 * The first fix called the sync with `value` directly in `onBlur`, but the prop there was
 * still the old one. Both `setState` calls were in one batch, and the second one won:
 * `onChange("09:30")` still went out, while the field emptied and stayed that way.
 */
test("an uncontrolled field keeps what was typed", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TimePicker onChange={onChange} />);

  const field = screen.getByRole("combobox") as HTMLInputElement;
  await user.click(field);
  await user.type(field, "0930");
  await user.tab();

  expect(onChange).toHaveBeenCalledWith("09:30");
  expect(field.value).toBe("09:30");
});

test("a value the parent refused does not stay in the field", async () => {
  const user = userEvent.setup();
  render(<TimePicker value="10:00" onChange={() => {}} />);

  const field = screen.getByRole("combobox") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "21:00");
  await user.tab();

  // The parent ignored the value — the field goes back to the accepted one.
  expect(field.value).toBe("10:00");
});

/**
 * The bounds of `DateTimePicker` are day-level, and that is written into the contract.
 *
 * Calendar cells are dates without a time, and comparison goes by the day. The test records
 * the owner's decision (the component does not accept time bounds), so that "fix it, it
 * does not work" does not turn into a silent addition of a prop.
 */
test("the datetime bounds are day-level by contract", () => {
  expect(parseDate("2026-09-11").compare(parseDateTime("2026-09-11T14:00"))).toBe(0);
});

const setup = (props: Partial<Parameters<typeof TimePicker>[0]> = {}) => {
  render(<TimePicker value="10:00" onChange={vi.fn()} {...props} />);
  return { field: screen.getByRole("combobox") };
};

describe("TimePicker hourCycle={12}", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 27, 14, 7));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup12 = (props: Partial<Parameters<typeof TimePicker>[0]> = {}) => {
    const onChange = vi.fn();
    render(<TimePicker value="10:00" onChange={onChange} hourCycle={12} {...props} />);
    return { onChange, user: userEvent.setup(), field: screen.getByRole("combobox") };
  };

  test("the field shows the value on the 12-hour clock, the value itself stays HH:MM", () => {
    const { field } = setup12();
    expect((field as HTMLInputElement).value).toBe("10:00 AM");
  });

  test("slots are listed with AM/PM, the nearest future one first", async () => {
    const { user, field } = setup12();
    await user.click(field);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0]!.textContent).toBe("2:30 PM");
    expect(options).toHaveLength(48);
    expect(screen.getByRole("option", { name: "10:00 AM" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("clicking a slot reports HH:MM, not the display text", async () => {
    const { onChange, user, field } = setup12();
    await user.click(field);
    await user.click(screen.getByRole("option", { name: "9:00 PM" }));

    expect(onChange).toHaveBeenCalledWith("21:00");
    expect((field as HTMLInputElement).value).toBe("9:00 PM");
  });

  test("typed text filters the displayed slots by prefix", async () => {
    const { user, field } = setup12();
    await user.click(field);
    await user.clear(field);
    await user.type(field, "2");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(option.textContent!.startsWith("2:")).toBe(true);
  });

  test("a typed '230p' is masked and committed as 14:30 on Enter", async () => {
    const { onChange, user, field } = setup12();
    await user.click(field);
    await user.clear(field);
    await user.type(field, "230p");
    expect((field as HTMLInputElement).value).toBe("2:30 PM");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("14:30");
  });

  test("blur keeps the period of the previous value when none was typed", async () => {
    const { onChange, user, field } = setup12({ value: "15:00" });
    await user.click(field);
    await user.clear(field);
    await user.type(field, "230");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("14:30");
  });

  test("Backspace at the end erases the period instead of re-completing it", async () => {
    const { user, field } = setup12({ value: "14:30" });
    await user.click(field);
    await user.keyboard("{End}{Backspace}");

    expect((field as HTMLInputElement).value).toBe("2:30");
  });

  test("a leading zero in the filter still finds the slots", async () => {
    const { user, field } = setup12();
    await user.click(field);
    await user.clear(field);
    await user.type(field, "02");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(option.textContent!.startsWith("2:")).toBe(true);
  });

  test("the 24-hour clock stays the default", () => {
    const { field } = setup({ value: "21:05" });
    expect((field as HTMLInputElement).value).toBe("21:05");
  });

  test("the placeholder of an empty field is the 12-hour mask", () => {
    const { field } = setup12({ value: null });
    expect(field.getAttribute("placeholder")).toBe("h:mm AM");
  });
});

describe("TimePicker invalid", () => {
  const field = () => screen.getByRole("combobox");

  test("the prop sets aria-invalid on the field", () => {
    render(<TimePicker value="10:00" onChange={() => {}} invalid />);

    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  test("without the prop there is no aria-invalid", () => {
    render(<TimePicker value="10:00" onChange={() => {}} />);

    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  test("an error of the surrounding FormField marks the field and describes it", () => {
    render(
      <FormField label="Time" error="Outside working hours">
        <TimePicker value="23:00" onChange={() => {}} />
      </FormField>
    );

    expect(field().getAttribute("aria-invalid")).toBe("true");
    const describedBy = field().getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Outside working hours");
  });

  test("a hint of FormField does not make the field invalid", () => {
    render(
      <FormField label="Time" hint="Working hours only">
        <TimePicker value="10:00" onChange={() => {}} />
      </FormField>
    );

    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  test("an explicit invalid={false} wins over the FormField error", () => {
    render(
      <FormField label="Time" error="Outside working hours">
        <TimePicker value="23:00" onChange={() => {}} invalid={false} />
      </FormField>
    );

    expect(field().getAttribute("aria-invalid")).toBe("false");
  });
});

test("DateTimePicker passes hourCycle through to its time field", () => {
  render(
    <DateTimePicker
      date="2026-07-27"
      time="14:30"
      onDateChange={vi.fn()}
      onTimeChange={vi.fn()}
      hourCycle={12}
    />
  );
  const fields = screen.getAllByRole("combobox");
  expect((fields.at(-1) as HTMLInputElement).value).toBe("2:30 PM");
});
