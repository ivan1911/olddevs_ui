// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Combobox } from "../src/components/inputs/Combobox.js";

afterEach(cleanup);

const ITEMS = [
  { id: "nature", label: "Nature" },
  { id: "city", label: "City" },
];

test("a value outside the list reaches onChange", async () => {
  const user = userEvent.setup();
  const onInput = vi.fn();

  render(
    <Combobox items={ITEMS} aria-label="Category" allowsCustomValue onInputChange={onInput} />
  );

  await user.type(screen.getByRole("combobox", { name: "Category" }), "Custom");

  // This is exactly what separates `Combobox` from `Select`: the list suggests but
  // does not restrict. The set has no "Custom" item.
  expect(onInput).toHaveBeenLastCalledWith("Custom");
});
