// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";

afterEach(cleanup);

test("submitting is announced and not clickable", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <Button loading onClick={onClick}>
      Save
    </Button>
  );

  const button = screen.getByRole("button", { name: "Save" });
  expect(button.getAttribute("aria-busy")).toBe("true");
  // Выключенность наступает сама: отдельный `disabled` вызывающему не нужен.
  expect((button as HTMLButtonElement).disabled).toBe(true);

  await user.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

test("the spinner is not part of the button accessible name", () => {
  render(<Button loading>Save</Button>);
  // Ровно ради этого внутри не `Spinner`: у того есть невидимая подпись
  // «Загрузка», и имя стало бы «Загрузка Сохранить».
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  expect(screen.queryByText("Loading")).toBeNull();
});

test("the spinner takes the icon slot instead of joining it", () => {
  const { container } = render(
    <Button loading icon={<span data-testid="icon">★</span>}>
      Save
    </Button>
  );
  expect(screen.queryByTestId("icon")).toBeNull();
  expect(container.querySelector(".animate-spin")).toBeTruthy();
});

test("without submitting nothing is announced", () => {
  render(<Button>Save</Button>);
  const button = screen.getByRole("button", { name: "Save" });
  expect(button.getAttribute("aria-busy")).toBeNull();
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

test("with asChild disabledness is expressed independently of the role", () => {
  render(
    <Button asChild loading>
      <a href="#where">Link</a>
    </Button>
  );
  const link = screen.getByRole("link", { name: "Link" });
  expect(link.getAttribute("aria-disabled")).toBe("true");
  expect(link.getAttribute("aria-busy")).toBe("true");
  // Атрибута `disabled` у ссылки не существует — он не должен уехать в разметку.
  expect(link.hasAttribute("disabled")).toBe(false);
});
