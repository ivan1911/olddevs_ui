// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SortableList } from "../src/components/content/SortableList.js";

afterEach(cleanup);

const rows = [
  { id: "1", label: "First" },
  { id: "2", label: "Second" },
  { id: "3", label: "Third" },
];

test("every row has a drag handle", () => {
  render(<SortableList items={rows} onReorder={() => {}} aria-label="Order" />);

  // Без `<Button slot="drag">` строка таскается мышью, а с клавиатуры не
  // берётся ВООБЩЕ — react-aria при этом лишь предупреждает в консоль, то есть
  // недоступный список выглядит рабочим. Ручку рисует компонент, а не
  // потребитель по желанию.
  expect(screen.getAllByRole("button", { name: /Drag/ })).toHaveLength(3);
});

test("the handle name does not repeat the row label", () => {
  render(<SortableList items={rows} onReorder={() => {}} aria-label="Order" />);

  // Подпись строки react-aria дописывает сама: «Перетащить Первая». Повторив
  // её в `aria-label`, мы получили бы её дважды.
  const handle = screen.getAllByRole("button")[0]!;
  expect(handle.getAttribute("aria-label")).toBe("Drag");
});

test("the list is named and the rows are in place", () => {
  render(<SortableList items={rows} onReorder={() => {}} aria-label="Section order" />);

  expect(screen.getByRole("grid", { name: "Section order" })).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("the list has no live region of its own", () => {
  const { container } = render(
    <SortableList items={rows} onReorder={() => {}} aria-label="Order" />
  );

  // react-aria объявляет перетаскивание сам и локализованно; своя область
  // дублировала бы объявления и спорила бы с ними.
  expect(container.querySelector("[aria-live]")).toBeNull();
});

test("rows are draggable", () => {
  render(<SortableList items={rows} onReorder={() => {}} aria-label="Order" />);

  const first = screen.getAllByRole("row")[0]!;
  expect(first.getAttribute("draggable")).toBe("true");
});

test("the component does not store the order", () => {
  const onReorder = vi.fn();
  const { rerender } = render(
    <SortableList items={rows} onReorder={onReorder} aria-label="Order" />
  );
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("First");

  // Порядок приходит пропом и уходит наружу — как сортировка у таблицы.
  const other = [rows[2]!, rows[0]!, rows[1]!];
  rerender(<SortableList items={other} onReorder={onReorder} aria-label="Order" />);
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("Third");
});

test("an empty list shows its own state", () => {
  render(<SortableList items={[]} onReorder={() => {}} aria-label="Order" emptyText="Empty" />);
  expect(screen.getByText("Empty")).toBeTruthy();
});

test("markup instead of a label requires textValue", () => {
  render(
    <SortableList
      items={[{ id: "1", label: <strong>Bold</strong>, textValue: "Bold" }]}
      onReorder={() => {}}
      aria-label="Order"
    />
  );

  // Из `textValue` собирается и имя строки, и имя её ручки, и объявления
  // «Вставить между … и …».
  expect(screen.getByRole("row", { name: /Bold/ })).toBeTruthy();
});

test("the list id names it inside its group and stays out of the DOM", () => {
  const { container } = render(
    <SortableList
      id="todo"
      group="board"
      items={rows}
      onReorder={() => {}}
      onMove={() => {}}
      aria-label="To do"
    />
  );

  // `id` — ключ состояния доски, а не `id` элемента: «todo» в DOM столкнулся
  // бы с любым другим «todo» на странице.
  expect(container.querySelector("#todo")).toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});
