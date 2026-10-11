// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CopyButton } from "../src/components/actions/CopyButton.js";

afterEach(cleanup);

/*
  Заглушка ставится ПОСЛЕ `userEvent.setup()`, и это не придирка к порядку:
  setup сам подменяет `navigator.clipboard` своей реализацией, и заглушка,
  поставленная раньше, молча им перетирается — тест на отказ проходил бы как
  успех.
*/
function setup(writeText: () => Promise<void>) {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return user;
}

test("the value goes to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const user = setup(writeText);
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenCalledWith("OLDSUI-42");
});

test("the result is announced, not only reflected in the icon", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" />);

  // Галочка — сигнал для глаз; пользователь скринридера иначе не узнает,
  // сработала кнопка или нет.
  expect(screen.getByRole("status").textContent).toBe("");
  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
});

test("the button name changes with the state", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button", { name: "Copy" }));
  // «Скопировано» на кнопке, которая ничего не скопировала, — ложь.
  await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
});

test("a clipboard failure is visible and does not break the button", async () => {
  const user = setup(vi.fn().mockRejectedValue(new Error("denied")));
  const onCopy = vi.fn();
  render(<CopyButton value="OLDSUI-42" onCopy={onCopy} />);

  // В небезопасном контексте `navigator.clipboard` отсутствует вовсе, а запись
  // может быть запрещена разрешениями. Молчать об этом значит показать кнопку,
  // которая ничего не делает.
  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Could not copy"));
  expect(onCopy).toHaveBeenCalledWith(false);
});

test("a missing API is also a failure, not a crash", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Could not copy"));
});

test("the state resets after the given time", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" resetDelay={50} />);

  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""), { timeout: 2000 });
});

test("with a label the button is not icon-only and takes its name from the text", () => {
  render(<CopyButton value="OLDSUI-42">Copy the key</CopyButton>);
  expect(screen.getByRole("button", { name: "Copy the key" })).toBeTruthy();
});
