// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PasswordInput } from "../src/components/inputs/PasswordInput.js";

afterEach(cleanup);

const field = () => document.querySelector("input") as HTMLInputElement;

test("by default the value is hidden and the reveal button is not pressed", () => {
  render(<PasswordInput aria-label="Password" />);

  expect(field().type).toBe("password");
  expect(screen.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed")).toBe(
    "false"
  );
});

test("the button announces the state, not only swaps the icon", async () => {
  const user = userEvent.setup();
  render(<PasswordInput aria-label="Password" />);

  await user.click(screen.getByRole("button", { name: "Show password" }));

  // Without `aria-pressed` a screen reader will not announce that the password
  // is currently shown, and that is a security state.
  expect(field().type).toBe("text");
  expect(screen.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed")).toBe(
    "true"
  );
});

test("the button label does not change with the state", async () => {
  const user = userEvent.setup();
  render(<PasswordInput aria-label="Password" />);

  const button = screen.getByRole("button", { name: "Show password" });
  await user.click(button);

  // A button whose name and state both change reads contradictorily: "Hide
  // password, pressed". The APG rule: the name stays constant, the state changes.
  expect(button.getAttribute("aria-label")).toBe("Show password");
});

test("toggling visibility does not reset the caret to the end", async () => {
  const user = userEvent.setup();
  render(<PasswordInput aria-label="Password" defaultValue="secret" />);

  field().setSelectionRange(3, 3);
  await user.click(screen.getByRole("button", { name: "Show password" }));

  // Changing `type` resets the selection to the end of the value, so a user who
  // revealed the password in the middle of an edit lost their place.
  expect(field().selectionStart).toBe(3);
  expect(field().selectionEnd).toBe(3);
});

test("Caps Lock is read from getModifierState instead of being guessed from input", () => {
  render(<PasswordInput aria-label="Password" />);

  // A password field shows no characters, and "all capitals" is a legitimate
  // password: there is nothing to infer the case from.
  expect(screen.queryByText("Caps Lock is on")).toBeNull();

  fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
  expect(screen.getByText("Caps Lock is on")).toBeTruthy();

  fireEvent.keyUp(field(), { key: "A", modifierCapsLock: false });
  expect(screen.queryByText("Caps Lock is on")).toBeNull();
});

test("the warning is cleared on leaving the field", () => {
  render(<PasswordInput aria-label="Password" />);

  fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
  fireEvent.blur(field());

  expect(screen.queryByText("Caps Lock is on")).toBeNull();
});

test("the warning region exists before the text appears", () => {
  const { container } = render(<PasswordInput aria-label="Password" />);

  // A live region that appears in the markup together with its text is not
  // announced by a screen reader, so it has to be in place in advance.
  const region = container.querySelector("[role='status']");
  expect(region).toBeTruthy();
  expect(region?.textContent).toBe("");
});

test("our keyboard handlers do not eat foreign ones", () => {
  const onKeyDown = vi.fn();
  render(<PasswordInput aria-label="Password" onKeyDown={onKeyDown} />);

  fireEvent.keyDown(field(), { key: "A", modifierCapsLock: false });
  expect(onKeyDown).toHaveBeenCalled();
});

test("without capsLockWarning no wrapper and no handlers appear", () => {
  const { container } = render(<PasswordInput aria-label="Password" capsLockWarning={false} />);

  expect(container.querySelector("[role='status']")).toBeNull();
  // The markup is the same as `TextControl` with a slot: the root is the field's wrapper.
  expect(container.firstElementChild?.querySelector("input")).toBeTruthy();
});

test("the component draws no border of its own — it stays with TextControl", () => {
  const { container } = render(<PasswordInput aria-label="Password" />);

  // The border lives on exactly one wrapper: a second one would mean the password
  // field gets focus differently from a neighboring field in the same form.
  expect(container.querySelectorAll(".border-line")).toHaveLength(1);
});

test("a disabled field disables the reveal button too", () => {
  render(<PasswordInput aria-label="Password" disabled />);

  expect(
    (screen.getByRole("button", { name: "Show password" }) as HTMLButtonElement).disabled
  ).toBe(true);
});
