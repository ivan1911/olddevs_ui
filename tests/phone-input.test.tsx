// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { PhoneInput } from "../src/components/inputs/PhoneInput.js";

afterEach(cleanup);

function Field({ mask }: { mask?: string }) {
  const [value, setValue] = useState("");
  return <PhoneInput mask={mask} value={value} onChange={setValue} aria-label="Phone" />;
}

const field = () => screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement;

test("the default mask is the Russian one", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "9161234567");

  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("a foreign format is set by a prop", async () => {
  const user = userEvent.setup();
  render(<Field mask="+9 (999) 999-9999" />);

  await user.type(field(), "12125550123");

  // Умолчание — выбор, а не истина: другой стране нужен другой формат.
  expect(field().value).toBe("+1 (212) 555-0123");
});

test("raw digits go outwards together with what is shown", () => {
  const onChange = vi.fn();
  render(<PhoneInput value="" onChange={onChange} aria-label="Phone" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "916" } });

  expect(onChange).toHaveBeenCalledWith("916", "+7 (916");
});

test("phone attributes are set but do not become prohibitions", () => {
  const { rerender } = render(<PhoneInput value="" onChange={() => {}} aria-label="Phone" />);

  expect(field().getAttribute("inputmode")).toBe("tel");
  expect(field().getAttribute("autocomplete")).toBe("tel");

  rerender(<PhoneInput value="" onChange={() => {}} aria-label="Phone" autoComplete="off" />);
  expect(field().getAttribute("autocomplete")).toBe("off");
});

test("the number is not validated — that is not the kit business", () => {
  const onChange = vi.fn();
  render(<PhoneInput value="000" onChange={onChange} aria-label="Phone" />);

  // Заведомо несуществующий номер показывается как есть: правила «настоящий ли
  // это номер» остаются у того, кто его отправляет (ADR-0024).
  expect(field().value).toBe("+7 (000");
  expect(field().getAttribute("aria-invalid")).toBeNull();
});
