// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { SearchControl } from "../src/components/inputs/SearchControl.js";

afterEach(cleanup);

function Field({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <SearchControl label="Find a category" value={value} onChange={setValue} />;
}

function FieldWithKeyboard() {
  const [value, setValue] = useState("sunset");
  const [layout, setLayout] = useState<"en" | "ru">("ru");

  return (
    <SearchControl
      label="Find a category"
      value={value}
      onChange={setValue}
      keyboard={{ layout, onLayoutChange: setLayout }}
    />
  );
}

test("yields a string, not an event", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SearchControl label="Find" value="" onChange={onChange} />);

  await user.type(screen.getByRole("searchbox", { name: "Find" }), "f");

  // For a search field the value is the whole point: all five hand-written copies in the
  // front end read `e.target.value` first thing.
  expect(onChange).toHaveBeenCalledWith("f");
});

test("the cross appears only when there is something to clear", async () => {
  const user = userEvent.setup();
  render(<Field />);
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

  await user.type(screen.getByRole("searchbox"), "forest");
  expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
});

test("clearing returns focus to the field", async () => {
  const user = userEvent.setup();
  render(<Field initial="forest" />);

  await user.click(screen.getByRole("button", { name: "Clear search" }));

  // The clear button unmounts on clear, and without an explicit return the focus moves to
  // `<body>`: a keyboard user loses their place in the dialog.
  expect(document.activeElement).toBe(screen.getByRole("searchbox"));
});

test("a disabled field shows no cross", () => {
  render(<SearchControl label="Find" value="forest" onChange={vi.fn()} disabled />);
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
});

test("the optional on-screen keyboard edits the selection in SearchControl", async () => {
  const user = userEvent.setup();
  render(<FieldWithKeyboard />);

  const input = screen.getByRole("searchbox", { name: "Find a category" }) as HTMLInputElement;
  input.focus();
  input.setSelectionRange(2, 4);
  fireEvent.select(input);

  await user.click(screen.getByRole("button", { name: "Open the on-screen keyboard" }));
  const keyboardPopover = screen.getByRole("dialog", { name: "Russian keyboard" });
  expect(keyboardPopover.className).toContain("bg-transparent");
  expect(keyboardPopover.className).toContain("border-0");
  expect(keyboardPopover.className).toContain("shadow-none");
  await user.click(screen.getByRole("button", { name: "Show symbols" }));
  await user.click(screen.getByRole("button", { name: "*" }));

  expect(input.value).toBe("su*et");
});

test("it can show the on-screen keyboard right away to demonstrate a scenario", () => {
  render(
    <SearchControl
      label="Search with the keyboard open"
      value="sunset"
      onChange={vi.fn()}
      keyboard={{ layout: "ru", onLayoutChange: vi.fn(), defaultOpen: true }}
    />
  );

  expect(screen.getByRole("dialog", { name: "Russian keyboard" })).toBeTruthy();
});

test("it passes the submit from the on-screen keyboard to the search consumer", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <SearchControl
      label="Search with Enter"
      value="sunset"
      onChange={vi.fn()}
      keyboard={{ layout: "ru", onLayoutChange: vi.fn(), defaultOpen: true, onSubmit }}
    />
  );

  await user.click(screen.getByRole("button", { name: "Submit search" }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
});

/**
 * An on-screen keyboard inserts at the caret's CURRENT position.
 *
 * The position lived in state and was updated by `onChange`, `onSelect` and the trigger
 * button's `onPointerDown`: that is, only during pointer interaction. A keyboard user tabbed
 * to the button and pressed Enter: no `pointerdown` came, the position stayed as it was at
 * mount, `{0,0}`, and the first character was inserted at the START of a non-empty string.
 */
test("a keyboard-opened panel types at the caret, not at the start", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  const props = {
    label: "Search",
    onChange,
    keyboard: { layout: "en" as const, onLayoutChange: () => {} },
  };

  // We mount EMPTY and the value arrives later: this is how the query is restored from the
  // address. The position state was computed once at mount and stayed `{0,0}`, while the caret
  // in the field sits at the end.
  const { rerender } = render(<SearchControl {...props} value="" />);
  rerender(<SearchControl {...props} value="photo" />);

  // The keyboard opens FROM THE KEYBOARD: there are no pointer events at all, which are the
  // only events that updated the position.
  const trigger = screen.getByRole("button", { name: /keyboard/i });
  trigger.focus();
  await user.keyboard("{Enter}");

  await user.click(screen.getByRole("button", { name: "s" }));

  expect(onChange).toHaveBeenCalledWith("photos");
});
