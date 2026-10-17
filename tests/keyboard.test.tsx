// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { useState } from "react";
import { Keyboard, type KeyboardSelection } from "../src/components/content/Keyboard.js";

afterEach(cleanup);

function renderKeyboard(value: string, selection: KeyboardSelection) {
  const onChange = vi.fn();
  const onSelectionChange = vi.fn();
  const onLayoutChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <Keyboard
      value={value}
      selection={selection}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
      layout="ru"
      onLayoutChange={onLayoutChange}
      onSubmit={onSubmit}
    />
  );

  return { onChange, onSelectionChange, onLayoutChange, onSubmit };
}

test("inserts a character at the caret", async () => {
  const user = userEvent.setup();
  const { onChange, onSelectionChange } = renderKeyboard("закат", { start: 2, end: 2 });

  await user.click(screen.getByRole("button", { name: "й" }));

  expect(onChange).toHaveBeenCalledWith("зайкат");
  expect(onSelectionChange).toHaveBeenCalledWith({ start: 3, end: 3 });
});

test("a character replaces the selected fragment", async () => {
  const user = userEvent.setup();
  const { onChange, onSelectionChange } = renderKeyboard("закат", { start: 2, end: 4 });

  await user.click(screen.getByRole("button", { name: "Show symbols" }));
  await user.click(screen.getByRole("button", { name: "*" }));

  expect(onChange).toHaveBeenCalledWith("за*т");
  expect(onSelectionChange).toHaveBeenCalledWith({ start: 3, end: 3 });
});

test("Backspace deletes one Unicode code point left of the caret", async () => {
  const user = userEvent.setup();
  const { onChange, onSelectionChange } = renderKeyboard("а😀", { start: 3, end: 3 });

  await user.click(screen.getByRole("button", { name: "Delete character" }));

  expect(onChange).toHaveBeenCalledWith("а");
  expect(onSelectionChange).toHaveBeenCalledWith({ start: 1, end: 1 });
});

test("Backspace sits in the numeric top row next to 0", () => {
  renderKeyboard("", { start: 0, end: 0 });

  const backspace = screen.getByRole("button", { name: "Delete character" });
  expect(backspace.parentElement?.textContent).toContain("0");
});

test("space replaces the selection", async () => {
  const user = userEvent.setup();
  const { onChange, onSelectionChange } = renderKeyboard("закат", { start: 2, end: 5 });

  await user.click(screen.getByRole("button", { name: "Space" }));

  expect(onChange).toHaveBeenCalledWith("за ");
  expect(onSelectionChange).toHaveBeenCalledWith({ start: 3, end: 3 });
});

test("space spans the width of four compact keys", () => {
  renderKeyboard("", { start: 0, end: 0 });

  expect(screen.getByRole("button", { name: "Space" }).className).toContain("w-[8.75rem]");
});

test("the plain layout shows a compact numeric top row", () => {
  renderKeyboard("", { start: 0, end: 0 });

  for (const number of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]) {
    expect(screen.getByRole("button", { name: number })).toBeTruthy();
  }
  expect(screen.getByRole("button", { name: "й" })).toBeTruthy();
});

test("the panel has an opaque backdrop and its own fixed width", () => {
  renderKeyboard("", { start: 0, end: 0 });

  const panel = screen.getByRole("group", { name: "Russian keyboard" });
  expect(panel.className).toContain("bg-bg-1");
  expect(panel.className).toContain("w-[28rem]");
  expect(panel.className.split(" ")).not.toContain("w-full");
});

test("Shift changes the key set and the accessible state", async () => {
  const user = userEvent.setup();
  renderKeyboard("", { start: 0, end: 0 });

  const shift = screen.getByRole("button", { name: "Shift" });
  expect(shift.getAttribute("aria-pressed")).toBe("false");

  await user.click(shift);

  expect(shift.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Й" })).toBeTruthy();
});

test("Shift shows Russian symbols instead of digits and the period, and resets after input", async () => {
  const user = userEvent.setup();
  const { onChange } = renderKeyboard("", { start: 0, end: 0 });

  await user.click(screen.getByRole("button", { name: "Shift" }));

  for (const symbol of ["!", '"', "№", ";", "%", ":", "?", "*", "(", ")"]) {
    expect(screen.getByRole("button", { name: symbol })).toBeTruthy();
  }
  expect(screen.getByRole("button", { name: "Semicolon" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Colon" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "!" }));

  expect(onChange).toHaveBeenCalledWith("!");
  expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Period" })).toBeTruthy();
});

test("Shift shows English symbols instead of digits and punctuation", async () => {
  const user = userEvent.setup();
  render(
    <Keyboard
      value=""
      selection={{ start: 0, end: 0 }}
      onChange={() => {}}
      onSelectionChange={() => {}}
      layout="en"
      onLayoutChange={() => {}}
    />
  );

  await user.click(screen.getByRole("button", { name: "Shift" }));

  for (const symbol of ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"])
    expect(screen.getByRole("button", { name: symbol })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Less than" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Greater than" })).toBeTruthy();
});

test("double-clicking Shift turns on Caps Lock until the next Shift click", async () => {
  const user = userEvent.setup();
  const { onChange } = renderKeyboard("", { start: 0, end: 0 });

  const shift = screen.getByRole("button", { name: "Shift" });
  await user.dblClick(shift);

  expect(shift.getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Й" }));
  expect(onChange).toHaveBeenLastCalledWith("Й");
  expect(shift.getAttribute("aria-pressed")).toBe("true");

  await user.click(shift);

  expect(shift.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "й" })).toBeTruthy();
});

test("?123 shows Russian symbols and returns to letters", async () => {
  const user = userEvent.setup();
  renderKeyboard("", { start: 0, end: 0 });

  const symbols = screen.getByRole("button", { name: "Show symbols" });
  expect(symbols.className).toContain("w-14");
  expect(symbols.className).toContain("rounded-full");
  await user.click(symbols);

  const letters = screen.getByRole("button", { name: "Show Russian letters" });
  expect(letters.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Show the extra symbol set" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "₽" })).toBeTruthy();
});

test("?123 uses the English return label in the EN layout", async () => {
  const user = userEvent.setup();
  render(
    <Keyboard
      value=""
      selection={{ start: 0, end: 0 }}
      onChange={() => {}}
      onSelectionChange={() => {}}
      layout="en"
      onLayoutChange={() => {}}
    />
  );

  await user.click(screen.getByRole("button", { name: "Show symbols" }));

  expect(screen.getByRole("button", { name: "Show English letters" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "$" })).toBeTruthy();
});

test("=< switches the extra symbol set per the matrix from the screenshot", async () => {
  const user = userEvent.setup();
  renderKeyboard("", { start: 0, end: 0 });

  await user.click(screen.getByRole("button", { name: "Show symbols" }));
  const additionalSymbols = screen.getByRole("button", {
    name: "Show the extra symbol set",
  });
  expect(additionalSymbols.getAttribute("aria-pressed")).toBe("false");
  expect(additionalSymbols.parentElement?.textContent).toContain("*");

  await user.click(additionalSymbols);

  expect(
    screen.getByRole("button", { name: "Show the primary symbol set" }).getAttribute("aria-pressed")
  ).toBe("true");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Show the primary symbol set" })
  );
  for (const symbol of [
    "~",
    "√",
    "π",
    "÷",
    "£",
    "€",
    "{",
    "}",
    "\\",
    "%",
    "©",
    "®",
    "™",
    "✓",
    "[",
    "]",
  ]) {
    expect(screen.getByRole("button", { name: symbol })).toBeTruthy();
  }
  expect(screen.getByRole("button", { name: "~" }).parentElement).toBe(
    screen.getByRole("button", { name: "Delete character" }).parentElement
  );
  expect(screen.getByRole("button", { name: "£" }).parentElement?.textContent).toBe("£€$¢^°={}\\");
  expect(
    screen.getByRole("button", { name: "Show the primary symbol set" }).parentElement?.textContent
  ).toBe("?123%©®™✓[]");
  expect(screen.queryByRole("button", { name: "₽" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Show the primary symbol set" }));

  expect(screen.getByRole("button", { name: "Show the extra symbol set" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "₽" })).toBeTruthy();
});

test("the comma and period right of space insert characters", async () => {
  const user = userEvent.setup();
  const { onChange, onSelectionChange } = renderKeyboard("закат", { start: 2, end: 2 });

  await user.click(screen.getByRole("button", { name: "Comma" }));
  await user.click(screen.getByRole("button", { name: "Period" }));

  expect(onChange).toHaveBeenNthCalledWith(1, "за,кат");
  expect(onChange).toHaveBeenNthCalledWith(2, "за.кат");
  expect(onSelectionChange).toHaveBeenNthCalledWith(1, { start: 3, end: 3 });
  expect(onSelectionChange).toHaveBeenNthCalledWith(2, { start: 3, end: 3 });
});

test("Enter triggers the search submit and has an accessible name", async () => {
  const user = userEvent.setup();
  const { onSubmit } = renderKeyboard("закат", { start: 5, end: 5 });

  await user.click(screen.getByRole("button", { name: "Submit search" }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("the language-icon button requests a layout switch and Close closes the panel", async () => {
  const user = userEvent.setup();
  const onLayoutChange = vi.fn();
  const onRequestClose = vi.fn();

  render(
    <Keyboard
      value=""
      selection={{ start: 0, end: 0 }}
      onChange={() => {}}
      onSelectionChange={() => {}}
      layout="ru"
      onLayoutChange={onLayoutChange}
      onRequestClose={onRequestClose}
    />
  );

  expect(screen.getAllByRole("button", { name: "Switch layout to English" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Switch layout to English" }));
  await user.click(screen.getByRole("button", { name: "Close the on-screen keyboard" }));

  expect(onLayoutChange).toHaveBeenCalledWith("en");
  expect(onRequestClose).toHaveBeenCalledOnce();
});

test("moves the panel by the handle with a pointer", () => {
  renderKeyboard("", { start: 0, end: 0 });

  const panel = screen.getByRole("group", { name: "Russian keyboard" });
  const handle = panel.querySelector<HTMLElement>("[data-keyboard-drag-handle]");
  expect(handle).toBeTruthy();

  fireEvent.pointerDown(handle!, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(handle!, { buttons: 1, clientX: 132, clientY: 124, pointerId: 1 });
  fireEvent.pointerUp(handle!, { pointerId: 1 });

  expect(panel.style.transform).toBe("translate3d(32px, 24px, 0)");
});

test("the handle moves the panel with arrow keys", () => {
  renderKeyboard("", { start: 0, end: 0 });

  const panel = screen.getByRole("group", { name: "Russian keyboard" });
  const handle = screen.getByRole("button", { name: "Move the on-screen keyboard" });
  fireEvent.keyDown(handle, { key: "ArrowRight" });

  expect(panel.style.transform).toBe("translate3d(24px, 0px, 0)");
});

test("an arrow key moves roving focus to the next key in the row", async () => {
  const user = userEvent.setup();
  renderKeyboard("", { start: 0, end: 0 });

  const one = screen.getByRole("button", { name: "1" });
  one.focus();
  await user.keyboard("{ArrowRight}");

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "2" }));
});

test("disabled fires no editing callbacks", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <Keyboard
      value="закат"
      selection={{ start: 2, end: 2 }}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
      layout="ru"
      onLayoutChange={() => {}}
      disabled
    />
  );

  await user.click(screen.getByRole("button", { name: "й" }));

  expect(onChange).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
});

/**
 * `preserveFocus` must not break the roving tabindex.
 *
 * All three restore effects returned early on `if (preserveFocus) return;` BEFORE
 * `setActiveIndex`, while the number of keys changes with the layout and the mode:
 * ru letters have 50 keys, en letters 44, ru symbols 35. After arrowing to a position
 * that does not exist in the new set, the panel was left WITHOUT a single tab stop: no
 * button had `tabIndex={0}`, and the panel dropped out of the tab order entirely.
 *
 * `activeIndex` is markup state, not focus state: it must always be clamped, and only
 * the `focus()` call itself is skipped under `preserveFocus`.
 */
function keyTabStops() {
  // Only the grid keys: the panel has other buttons with their own tab stop.
  return (
    screen
      .getAllByRole("button")
      // The grid keys are the only ones with an explicitly set tabindex (roving):
      // the panel's other buttons have no attribute at all.
      .filter((b) => b.hasAttribute("tabindex") && b.tabIndex === 0)
  );
}

test("switching layout with preserveFocus keeps exactly one tab stop", async () => {
  const user = userEvent.setup();

  function Host() {
    const [layout, setLayout] = useState<"ru" | "en">("ru");
    return (
      <Keyboard
        value=""
        selection={{ start: 0, end: 0 }}
        onChange={() => {}}
        onSelectionChange={() => {}}
        layout={layout}
        onLayoutChange={setLayout}
        preserveFocus
      />
    );
  }

  render(<Host />);
  expect(keyTabStops()).toHaveLength(1);

  // Roving into the END of the ru set: 50 keys against 44 in en. First down through the
  // rows, then right: arrows right alone do not move past their own row. The click itself
  // does not move the tab stop, so without this pass the position stays valid in both
  // layouts and the defect does not reproduce.
  const keys = screen.getAllByRole("button").filter((b) => b.hasAttribute("tabindex"));
  keys[0]?.focus();
  await user.keyboard("{ArrowDown>6/}{ArrowRight>20/}");

  await user.click(screen.getByRole("button", { name: "Switch layout to English" }));

  expect(keyTabStops()).toHaveLength(1);
});
