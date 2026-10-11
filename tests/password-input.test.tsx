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

  // Без `aria-pressed` скринридер не сообщит, что пароль сейчас на экране
  // открыт, — а это состояние безопасности.
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

  // Кнопка, у которой меняются и имя, и состояние, читается противоречиво:
  // «Скрыть пароль, нажато». Правило APG — имя постоянно, меняется признак.
  expect(button.getAttribute("aria-label")).toBe("Show password");
});

test("toggling visibility does not reset the caret to the end", async () => {
  const user = userEvent.setup();
  render(<PasswordInput aria-label="Password" defaultValue="secret" />);

  field().setSelectionRange(3, 3);
  await user.click(screen.getByRole("button", { name: "Show password" }));

  // Смена `type` сбрасывает выделение в конец значения, и пользователь,
  // открывший пароль посреди правки, терял место.
  expect(field().selectionStart).toBe(3);
  expect(field().selectionEnd).toBe(3);
});

test("Caps Lock is read from getModifierState instead of being guessed from input", () => {
  render(<PasswordInput aria-label="Password" />);

  // В поле пароля символов не видно, а «все заглавные» — законный пароль:
  // угадывать по регистру нечем.
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

  // Живой регион, появившийся в разметке вместе со своим текстом, скринридер
  // не объявляет — он обязан быть на месте заранее.
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
  // Разметка та же, что у `TextControl` со слотом: корень — оболочка поля.
  expect(container.firstElementChild?.querySelector("input")).toBeTruthy();
});

test("the component draws no border of its own — it stays with TextControl", () => {
  const { container } = render(<PasswordInput aria-label="Password" />);

  // Рамка живёт ровно на одной оболочке: вторая означала бы, что поле пароля
  // фокусируется не так, как соседнее поле в той же форме.
  expect(container.querySelectorAll(".border-line")).toHaveLength(1);
});

test("a disabled field disables the reveal button too", () => {
  render(<PasswordInput aria-label="Password" disabled />);

  expect(
    (screen.getByRole("button", { name: "Show password" }) as HTMLButtonElement).disabled
  ).toBe(true);
});
