// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { PinInput } from "../src/components/inputs/PinInput.js";

afterEach(cleanup);

function Code({ initial = "", length = 6 }: { initial?: string; length?: number }) {
  const [value, setValue] = useState(initial);
  return <PinInput value={value} onChange={setValue} length={length} label="SMS code" />;
}

const fields = () => screen.getAllByRole("textbox") as HTMLInputElement[];

test("the fields are named for a screen reader instead of being nameless", () => {
  render(<Code />);

  // Otherwise a screen reader reads six nameless fields in a row, and the place
  // in the code gets lost.
  expect(screen.getByRole("textbox", { name: "Digit 1 of 6" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Digit 6 of 6" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "SMS code" })).toBeTruthy();
});

test('autocomplete="one-time-code" sits on the first field and only on it', () => {
  render(<Code />);

  const list = fields();
  expect(list[0]!.getAttribute("autocomplete")).toBe("one-time-code");
  expect(list[1]!.getAttribute("autocomplete")).toBe("off");
});

test("pasting the whole code fills every field", async () => {
  const user = userEvent.setup();
  render(<Code />);

  fields()[0]!.focus();
  await user.paste("123456");

  // The code arrives from an SMS in full; with `maxLength=1` the browser itself
  // would trim the paste down to the first digit.
  expect(fields().map((f) => f.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
});

test("pasting into a middle field continues the code from there", async () => {
  const user = userEvent.setup();
  render(<Code initial="12" />);

  fields()[2]!.focus();
  await user.paste("345");

  expect(fields().map((f) => f.value)).toEqual(["1", "2", "3", "4", "5", ""]);
});

test("only digits are taken from a paste", async () => {
  const user = userEvent.setup();
  render(<Code />);

  fields()[0]!.focus();
  await user.paste("12-34 56");

  expect(fields().map((f) => f.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
});

test("typing moves focus forward", async () => {
  const user = userEvent.setup();
  render(<Code />);

  fields()[0]!.focus();
  await user.keyboard("7");

  expect(document.activeElement).toBe(fields()[1]);
});

test("Backspace on an empty field moves focus back and erases the digit", async () => {
  const user = userEvent.setup();
  render(<Code initial="12" />);

  fields()[2]!.focus();
  await user.keyboard("{Backspace}");

  // Otherwise focus stops at an empty field, and there is nothing to erase the
  // previous digit with.
  expect(fields().map((f) => f.value)).toEqual(["1", "", "", "", "", ""]);
  expect(document.activeElement).toBe(fields()[1]);
});

test("arrows walk between the fields", async () => {
  const user = userEvent.setup();
  render(<Code initial="123" />);

  fields()[2]!.focus();
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(fields()[1]);

  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(fields()[2]);
});

test("a string goes outwards, not an array", () => {
  const onChange = vi.fn();
  render(<PinInput value="" onChange={onChange} label="Code" />);

  fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "9" } });

  // The consumer needs the whole code: it goes into the request as one string.
  expect(onChange).toHaveBeenCalledWith("9");
});

test("a value longer than the set is trimmed to the number of fields", async () => {
  const user = userEvent.setup();
  render(<Code length={4} />);

  fields()[0]!.focus();
  await user.paste("1234567");

  expect(fields().map((f) => f.value)).toEqual(["1", "2", "3", "4"]);
});

test("deleting in the middle shifts the rest — the value is one, there are no holes", () => {
  const onChange = vi.fn();
  render(<PinInput value="1234" onChange={onChange} length={4} label="Code" />);

  fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: "" } });

  expect(onChange).toHaveBeenCalledWith("134");
});

/**
 * Regression. Focus selects the contents of a field, so a letter typed over an occupied
 * digit reaches the handler as a replacement. Without telling it apart from a clear, the
 * component ERASED the digit for a character it did not even show: "482913" became "48913"
 * after a single wrong key press.
 */
test("a non-digit over an occupied field erases nothing", async () => {
  const user = userEvent.setup();
  render(<Code initial="482913" />);

  fields()[2]!.focus();
  await user.keyboard("x");

  expect(fields().map((f) => f.value)).toEqual(["4", "8", "2", "9", "1", "3"]);
});

test("clearing a field still removes the digit", async () => {
  const user = userEvent.setup();
  render(<Code initial="482913" />);

  fields()[2]!.focus();
  await user.keyboard("{Backspace}");

  expect(fields().map((f) => f.value)).toEqual(["4", "8", "9", "1", "3", ""]);
});

describe("invalid", () => {
  const invalidFlags = () => fields().map((f) => f.getAttribute("aria-invalid"));

  test("the prop marks every cell invalid, so the shell turns red", () => {
    render(<PinInput value="12" onChange={() => {}} label="SMS code" invalid />);

    expect(invalidFlags()).toEqual(Array(6).fill("true"));
  });

  test("without the prop nothing is marked", () => {
    render(<Code />);

    expect(invalidFlags()).toEqual(Array(6).fill(null));
  });

  test("an error of the surrounding FormField marks the cells as well", () => {
    render(
      <FormField label="Code" error="Wrong code">
        <PinInput value="" onChange={() => {}} label="SMS code" />
      </FormField>
    );

    expect(invalidFlags()).toEqual(Array(6).fill("true"));
  });

  test("a hint of FormField does not make the code invalid", () => {
    render(
      <FormField label="Code" hint="Six digits">
        <PinInput value="" onChange={() => {}} label="SMS code" />
      </FormField>
    );

    expect(invalidFlags()).toEqual(Array(6).fill(null));
  });

  test("an explicit invalid={false} wins over the FormField error", () => {
    render(
      <FormField label="Code" error="Wrong code">
        <PinInput value="" onChange={() => {}} label="SMS code" invalid={false} />
      </FormField>
    );

    expect(invalidFlags()).toEqual(Array(6).fill("false"));
  });
});
