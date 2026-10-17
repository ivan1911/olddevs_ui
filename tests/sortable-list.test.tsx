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

  // Without `<Button slot="drag">`, a row can be dragged with a mouse but cannot be picked up from
  // the keyboard AT ALL. react-aria only logs a console warning in that case, so an inaccessible
  // list looks like it works. The component renders the handle, not the consumer, and it is not
  // optional.
  expect(screen.getAllByRole("button", { name: /Drag/ })).toHaveLength(3);
});

test("the handle name does not repeat the row label", () => {
  render(<SortableList items={rows} onReorder={() => {}} aria-label="Order" />);

  // react-aria appends the row label itself, for example "Drag First". Repeating it in `aria-label`
  // would announce it twice.
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

  // react-aria announces the drag itself, localized. A custom region would duplicate those
  // announcements and conflict with them.
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

  // The order comes in as a prop and goes out through a callback, like sorting in a table.
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

  // `textValue` provides the row name, the handle name and the drop announcements, for example
  // "Insert between … and …".
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

  // `id` is the key of the board's state, not the element's `id`: "todo" in the DOM would collide
  // with any other "todo" on the page.
  expect(container.querySelector("#todo")).toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});
