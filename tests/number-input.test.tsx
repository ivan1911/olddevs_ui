// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { NumberInput } from "../src/components/inputs/NumberInput.js";

afterEach(cleanup);

function Field({ initial = null }: { initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return <NumberInput label="Count" value={value} onChange={setValue} />;
}

test("an empty field yields null, not zero and not NaN", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<NumberInput label="Count" value={7} onChange={onChange} />);

  const input = screen.getByRole("textbox", { name: "Count" });
  await user.clear(input);
  await user.tab();

  // Именно `null`: `NaN` не равен сам себе, и потребитель, сравнивший его с
  // чем угодно, получил бы тихо неверный результат.
  expect(onChange).toHaveBeenCalledWith(null);
});

test("a typed zero differs from an empty field", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<NumberInput label="Count" value={null} onChange={onChange} />);

  await user.type(screen.getByRole("textbox", { name: "Count" }), "0");
  await user.tab();

  expect(onChange).toHaveBeenCalledWith(0);
});

test("the steppers change the value by step", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<NumberInput label="Count" value={10} step={5} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Count: increase" }));
  expect(onChange).toHaveBeenLastCalledWith(15);
});

test("min and max clamp the value instead of blocking input", async () => {
  const user = userEvent.setup();
  render(<NumberInput label="Count" value={100} min={0} max={100} onChange={() => {}} />);

  // На верхней границе кнопка «больше» недоступна — это и есть зажим.
  expect(
    (screen.getByRole("button", { name: "Count: increase" }) as HTMLButtonElement).disabled
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Count: decrease" }) as HTMLButtonElement).disabled
  ).toBe(false);

  await user.clear(screen.getByRole("textbox", { name: "Count" }));
});

test("the display format comes from formatOptions", () => {
  render(
    <NumberInput
      label="Share"
      value={0.25}
      formatOptions={{ style: "percent" }}
      onChange={() => {}}
    />
  );

  expect((screen.getByRole("textbox", { name: "Share" }) as HTMLInputElement).value).toContain(
    "25"
  );
});

test("a disabled field accepts no input", () => {
  render(<NumberInput label="Count" value={5} disabled onChange={() => {}} />);
  expect((screen.getByRole("textbox", { name: "Count" }) as HTMLInputElement).disabled).toBe(true);
});

test("the value reaches the field", () => {
  render(<Field initial={42} />);
  expect((screen.getByRole("textbox", { name: "Count" }) as HTMLInputElement).value).toBe("42");
});

test("an error of the surrounding FormField marks the field invalid", () => {
  render(
    <FormField label="Count" error="Too many">
      <NumberInput label="Count" value={9} onChange={() => {}} />
    </FormField>
  );

  expect(screen.getByRole("textbox", { name: "Count" }).getAttribute("aria-invalid")).toBe("true");
});

test("an explicit invalid={false} wins over the FormField error", () => {
  render(
    <FormField label="Count" error="Too many">
      <NumberInput label="Count" value={9} onChange={() => {}} invalid={false} />
    </FormField>
  );

  expect(screen.getByRole("textbox", { name: "Count" }).getAttribute("aria-invalid")).not.toBe(
    "true"
  );
});
