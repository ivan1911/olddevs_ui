// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TagInput } from "../src/components/inputs/TagInput.js";

afterEach(cleanup);

test("Backspace on empty input removes the last tag", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset", "mountains"]} onChange={onChangeSpy} label="Tags" />);

  await user.click(screen.getByLabelText("Tags: add"));
  await user.keyboard("{Backspace}");

  expect(onChangeSpy).toHaveBeenCalledWith(["sunset"]);
});

test("Backspace with non-empty input does not touch the tags", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset"]} onChange={onChangeSpy} label="Tags" />);

  const field = screen.getByLabelText("Tags: add");
  await user.type(field, "fo{Backspace}");

  // Стирается набранное, а не соседний тег: иначе исправить опечатку было бы
  // нельзя, не потеряв тег.
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test("Enter adds a tag, an empty Enter does nothing", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={[]} onChange={onChangeSpy} label="Tags" />);

  const field = screen.getByLabelText("Tags: add");
  await user.click(field);
  await user.keyboard("{Enter}");
  expect(onChangeSpy).not.toHaveBeenCalled();

  await user.type(field, "sunset{Enter}");
  expect(onChangeSpy).toHaveBeenCalledWith(["sunset"]);
});

test("duplicates are neither added nor complained about", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset"]} onChange={onChangeSpy} label="Tags" />);

  await user.type(screen.getByLabelText("Tags: add"), "sunset{Enter}");

  // Повторный тег ничего не значит; сообщать о нём — ругаться на действие,
  // которое ничего не сломало.
  expect(onChangeSpy).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tags: add")).toHaveProperty("value", "");
});

/**
 * Набор добран — поле только для чтения, а НЕ выключено.
 *
 * `disabled` на поле, в котором стоит каретка, снимает с него фокус: пользователь
 * набирал последний тег, жал Enter — и фокус улетал на документ, а обход формы
 * начинался заново. Заодно переставал работать Backspace для снятия последнего
 * тега: события выключенного поля не приходят вовсе.
 */
test("the limit stops input without dropping focus or removal", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TagInput value={["a", "b"]} onChange={onChange} label="Tags" max={2} />);

  const field = screen.getByLabelText("Tags: add") as HTMLInputElement;
  expect(field.disabled).toBe(false);
  expect(field.readOnly).toBe(true);

  field.focus();
  expect(document.activeElement).toBe(field);

  // Backspace по-прежнему снимает последний тег — у выключенного поля события
  // не приходили вовсе.
  await user.keyboard("{Backspace}");
  expect(onChange).toHaveBeenCalledWith(["a"]);
});

/**
 * Регрессия ревью волны 18. Имя кнопки снятия задваивалось: react-aria
 * дописывает подпись своего тега сам, и «Убрать тег альфа» читалось как
 * «Убрать тег альфа альфа». По разметке этого не видно — атрибут выглядит
 * правильным, — поэтому проверяется вычисленное доступное имя.
 */
test("TagInput: the remove button names the tag exactly once", () => {
  render(<TagInput label="Tags" value={["alpha"]} onChange={() => {}} />);

  // Запрос по роли считает доступное имя тем же способом, что и скринридер —
  // и в отличие от чтения `aria-label` видит то, что дописал react-aria.
  // Подписи приходят из английского фолбэка: провайдера здесь нет.
  expect(screen.getByRole("button", { name: "Remove tag alpha" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove tag alpha alpha" })).toBeNull();
});
