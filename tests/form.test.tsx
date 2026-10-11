// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { Form } from "../src/components/inputs/Form.js";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

function FormDemo({ pending, onSubmit }: { pending?: boolean; onSubmit: () => void }) {
  return (
    <Form onSubmit={onSubmit} pending={pending}>
      <TextControl name="title" aria-label="Name" />
      <Checkbox name="pin">Pin</Checkbox>
      <Button type="submit">Save</Button>
    </Form>
  );
}

test("submitting does not reload the page", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<FormDemo onSubmit={onSubmit} />);

  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("while submitting the form does not submit again", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<FormDemo pending onSubmit={onSubmit} />);

  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("pending disables every field at once instead of one by one", () => {
  render(<FormDemo pending onSubmit={() => {}} />);

  // Родной `<fieldset disabled>` выключает и то, что появится позже, — форме
  // не нужно знать свой состав.
  //
  // Проверяется `:disabled`, а не свойство `disabled`: последнее отражает
  // СОБСТВЕННЫЙ атрибут элемента и остаётся `false` внутри выключенного
  // fieldset — так и в браузере. Унаследованное состояние видно только
  // псевдоклассу, и именно по нему срабатывают `disabled:` из словаря.
  expect(screen.getByRole("textbox", { name: "Name" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("checkbox", { name: "Pin" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Save" }).matches(":disabled")).toBe(true);
});

test("Enter in a text field does not get through while submitting either", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const { rerender } = render(<FormDemo onSubmit={onSubmit} />);

  // Сначала убеждаемся, что Enter вообще отправляет форму.
  await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
  expect(onSubmit).toHaveBeenCalledTimes(1);

  onSubmit.mockClear();
  rerender(<FormDemo pending onSubmit={onSubmit} />);
  await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a fieldset does not break the layout", () => {
  const { container } = render(<FormDemo onSubmit={() => {}} />);
  // `contents` убирает сам бокс fieldset из раскладки: поля остаются прямыми
  // детьми формы с её `gap`, иначе вертикальные отступы схлопнулись бы.
  const fieldset = container.querySelector("fieldset")!;
  expect(fieldset.className).toContain("contents");
});
