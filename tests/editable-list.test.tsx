// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  EditableList,
  type EditableListHandle,
  type EditableListItem,
} from "../src/components/content/EditableList.js";

afterEach(cleanup);

const rows: EditableListItem[] = [
  { id: "1", value: "First" },
  { id: "2", value: "Second" },
  { id: "3", value: "Third" },
];

const base = {
  onReorder: () => {},
  onValueChange: () => {},
  editLabel: (item: EditableListItem) => `Rename ${item.value}`,
  "aria-label": "Order",
} as const;

/*
  HERE ONLY MARKUP, NAMES AND THE ABSENCE OF STORAGE ARE CHECKED.

  Focus moves and key clashes with the list are checked in a live browser
  (`tests-visual/interactions.spec.ts`), and this is not overcaution: the collection
  of react-aria mounts row content differently in jsdom, and `document
  .activeElement` behaves differently after unmounting than in a browser. All
  three defects found while building the component would slip past jsdom silently.
*/

test("every row has a drag handle", () => {
  render(<EditableList items={rows} {...base} />);

  // Without `<Button slot="drag">` a row drags with the mouse, but the keyboard does not
  // pick it up at all: react-aria only logs a warning to the console (ADR-0028).
  expect(screen.getAllByRole("button", { name: /Drag/ })).toHaveLength(3);
});

test("the handle name does not repeat the row label", () => {
  render(<EditableList items={rows} {...base} />);

  // The library appends the row label itself: "Drag First".
  expect(screen.getAllByRole("button")[0]!.getAttribute("aria-label")).toBe("Drag");
});

test("the list is named and the rows are in place", () => {
  render(<EditableList items={rows} {...base} aria-label="Task order" />);

  expect(screen.getByRole("grid", { name: "Task order" })).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("the list has no live region of its own", () => {
  const { container } = render(<EditableList items={rows} {...base} />);

  // react-aria announces the drag itself, with localized text; a region of our own
  // would duplicate those announcements, while the appearance of an added row is announced
  // by the consumer, who already has a live region of their own for that.
  expect(container.querySelector("[aria-live]")).toBeNull();
});

test("the component stores neither the order nor the values", async () => {
  const { rerender } = render(<EditableList items={rows} {...base} />);
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("First");

  // The order arrives as a prop and leaves as a whole, the same way table sorting does
  // (ADR-0023).
  rerender(<EditableList items={[rows[2]!, rows[0]!, rows[1]!]} {...base} />);
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("Third");

  // The value is a prop too. A component that kept the confirmed value would show its own
  // copy after the server refused to save.
  rerender(<EditableList items={[{ id: "1", value: "Renamed outside" }]} {...base} />);
  // Wait for the exit to finish: the two removed rows stay in place until it ends
  // (OLDSUI-14), and until then the list keeps its old order.
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1));
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("Renamed outside");
});

test("an empty value shows the empty label", () => {
  render(<EditableList items={[{ id: "1", value: "" }]} {...base} />);

  // An empty value is not a data error: the row must stay visible and
  // editable, or there would be no way to fix it.
  expect(screen.getByText("Not set")).toBeTruthy();

  // It must also stay NAMED. An empty `textValue` triggers a react-aria warning
  // in the console: the row looks fine, but type-ahead by first letters
  // cannot reach it.
  expect(screen.getByRole("row", { name: /Not set/ })).toBeTruthy();
});

test("an empty list shows its own state", () => {
  render(<EditableList items={[]} {...base} emptyText="Nothing here" />);

  expect(screen.getByText("Nothing here")).toBeTruthy();
});

test("the add row exists only with the add prop and carries a name", () => {
  const { rerender } = render(<EditableList items={rows} {...base} />);
  expect(screen.queryByRole("textbox")).toBeNull();

  rerender(
    <EditableList
      items={rows}
      {...base}
      add={{ label: "New task", placeholder: "What needs doing?", onAdd: () => {} }}
    />
  );

  // A placeholder does not count as a name: it disappears exactly when the field
  // has a value, while the name is needed both before and after.
  expect(screen.getByRole("textbox", { name: "New task" })).toBeTruthy();
});

test("the row action is the consumer's, not the component's", async () => {
  const onRowAction = vi.fn();
  render(<EditableList items={rows} {...base} onRowAction={onRowAction} />);

  await userEvent.click(screen.getAllByRole("row")[1]!);

  // A single click opens the details, not the editor; otherwise the row would have no way
  // to open them.
  expect(onRowAction).toHaveBeenCalledWith("2");
});

test("slots render the consumer's content", () => {
  render(
    <EditableList
      items={rows}
      {...base}
      leading={(item) => <span>L{String(item.id)}</span>}
      trailing={(item) => <span>T{String(item.id)}</span>}
    />
  );

  // The checkbox, status badge and row buttons belong to the consumer: the component
  // knows no domain states.
  expect(screen.getByText("L1")).toBeTruthy();
  expect(screen.getByText("T3")).toBeTruthy();
});

/*
  THE CHECK "ENTER ON THE HANDLE DOES NOT OPEN THE EDITOR" LIVES IN THE BROWSER, NOT HERE, AND
  THIS IS NOT OVERCAUTION.

  Written in jsdom, it started a real move, the very thing the fix was made for, and
  jsdom has no way to finish it: `Escape` never reaches its target. While a move session
  is open, react-aria hides from the accessibility tree everything not taking part in it,
  and it does so with a DOM observer:
  the containers of the NEXT tests ended up under `aria-hidden`. One test or another failed,
  about once every four runs.

  In `tests-visual/interactions.spec.ts` the same check is worded more strongly:
  "Enter on the handle starts a move, not an edit" - there the move is real and
  runs to the end.
*/

test("Enter on a control in a slot does not open the editor either", async () => {
  /*
    `leading` and `trailing` are not ours. The handler caught `Enter` there too:
    the done checkbox and the row action buttons opened rename.

    The check is exactly "the editor did not open". Beyond that point the key is handled
    by `GridList` per its own cell rules, which is no longer our concern:
    the component must not take it away from the list.
  */
  const user = userEvent.setup();
  render(
    <EditableList
      items={rows}
      {...base}
      trailing={(item) => (
        <button type="button" onClick={() => {}}>
          Details {item.value}
        </button>
      )}
    />
  );

  screen.getByRole("button", { name: "Details First" }).focus();
  await user.keyboard("{Enter}");

  expect(screen.queryByRole("textbox", { name: "Rename First" })).toBeNull();
});

test("Enter on the row itself still opens the editor", async () => {
  // The flip side of the same check: narrowing the condition easily takes away
  // from the row the very thing the handler was set up for.
  const user = userEvent.setup();
  render(<EditableList items={rows} {...base} />);

  screen.getAllByRole("row")[0]!.focus();
  await user.keyboard("{Enter}");

  expect(screen.getByRole("textbox", { name: "Rename First" })).toBeTruthy();
});

test("pending does not disable the add field", () => {
  /*
    The second defect, a consumer's find: `pending` turned into `disabled`,
    so the disabled field lost focus and never got it back. A run of tasks
    broke on the first one as soon as adding goes through the network,
    which means for everyone.
  */
  render(
    <EditableList items={rows} {...base} add={{ label: "New", onAdd: () => {}, pending: true }} />
  );

  const field = screen.getByRole("textbox", { name: "New" }) as HTMLInputElement;

  expect(field.disabled).toBe(false);
  expect(field.getAttribute("aria-busy")).toBe("true");
});

test("rows are not divided by default", () => {
  render(<EditableList items={rows} {...base} />);

  expect(screen.getAllByRole("row")[0]!.className).not.toContain("border-b");
});

test("divided draws a hairline between the rows, not under the last one", () => {
  render(<EditableList items={rows} {...base} divided />);

  // Under the last row, the line would underline a list nobody underlined, so its border
  // is removed with the `last:` variant.
  const row = screen.getAllByRole("row")[0]!.className;
  expect(row).toContain("border-b");
  expect(row).toContain("last:border-b-0");
  // The rounding is removed: under a rounded row the line would bend at the corners.
  expect(row).toContain("rounded-none");
});

test("focusAdd puts the caret where the person is about to type", () => {
  const handle = createRef<EditableListHandle>();
  render(
    <EditableList ref={handle} items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );

  handle.current!.focusAdd();

  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "New" }));
});

test("focusAdd on a list without an add row does nothing, silently", () => {
  const handle = createRef<EditableListHandle>();
  render(<EditableList ref={handle} items={rows} {...base} />);

  // Silently, not by throwing: the caller comes from the command palette and
  // does not want to know what state the list is in.
  expect(() => handle.current!.focusAdd()).not.toThrow();
});

test("focusAdd selects what is typed only when asked", async () => {
  const handle = createRef<EditableListHandle>();
  render(
    <EditableList ref={handle} items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );
  const field = screen.getByRole("textbox", { name: "New" }) as HTMLInputElement;
  await userEvent.type(field, "Draft");

  handle.current!.focusAdd();
  expect(field.selectionStart).toBe(field.value.length);

  // With `select`, a repeated call starts typing afresh instead of appending to the old input.
  handle.current!.focusAdd({ select: true });
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
});

test("the row stays a Tailwind group root, and slot content sits inside it", () => {
  render(
    <EditableList
      items={rows}
      {...base}
      trailing={(item) => <button type="button">Delete {item.value}</button>}
    />
  );

  // A contract promised to the consumer, not a markup detail (ADR-0046). Inside
  // the kit nothing on this row uses `group`, so cleaning up dead classes would
  // strip it with a clear conscience, and hover in the consumer's code would
  // break silently: the buttons would simply always be visible.
  const row = document.querySelector('[data-key="1"]') as HTMLElement;
  expect(row.classList.contains("group")).toBe(true);

  // The second half of the contract: the slot content sits INSIDE the group root,
  // otherwise `group-hover:` cannot reach it, however you place the marker.
  expect(row.contains(screen.getByRole("button", { name: "Delete First" }))).toBe(true);
});

test("add.leading reserves a column before the field, and nothing when omitted", () => {
  const { rerender } = render(
    <EditableList items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );
  const field = screen.getByRole("textbox", { name: "New" });
  const addRow = field.closest(".flex.items-center") as HTMLElement;

  // Without a leading slot there is exactly one column: a spacer for the drag handle.
  expect(addRow.querySelector('[data-testid="add-leading"]')).toBeNull();

  rerender(
    <EditableList
      items={rows}
      {...base}
      add={{
        label: "New",
        onAdd: () => {},
        leading: <span data-testid="add-leading" />,
      }}
    />
  );

  const slot = screen.getByTestId("add-leading");
  expect(addRow.contains(slot)).toBe(true);

  // Order matters more than presence: the slot goes AFTER the drag handle spacer and BEFORE
  // the field, or the add row's columns would not line up with the rows' columns.
  const order = Array.from(addRow.querySelectorAll("*"));
  expect(order.indexOf(slot)).toBeLessThan(order.indexOf(field));
});

/*
  THE GRAB CURSOR IS ON THE HANDLE WRAPPER, NOT ON THE HANDLE ITSELF.

  react-aria sets `pointer-events: none` on the move button: it needs it as a
  keyboard target, not a pointer one. So the cursor is not applied to it at all:
  measured in a live browser, `getComputedStyle` of the button returns `grab`,
  while `elementFromPoint` at the center of the handle returns the row with
  `cursor: auto`. This check lives here so the class is not "fixed" back onto the
  button, where it looks more fitting but does nothing.
*/
test("the grab cursor sits on the handle wrapper, not on the handle itself", () => {
  render(<EditableList items={rows} {...base} />);

  const handle = screen.getAllByRole("button", { name: /Drag/ })[0]!;
  expect(handle.className).not.toContain("cursor-grab");
  expect(handle.parentElement?.className).toContain("cursor-grab");
});

test("a row that cannot be dragged shows no grab cursor", () => {
  render(<EditableList items={[{ id: "1", value: "First", disabled: true }]} {...base} />);

  const handle = screen.getAllByRole("button", { name: /Drag/ })[0]!;
  expect(handle.parentElement?.className).not.toContain("cursor-grab");
});

/*
  ROW EXIT - OLDSUI-14.

  jsdom does not run animations, so here they are MOCKED: the stub says
  "something is playing on the row", and the test fires the end of the exit itself, with the
  `animationend` event, the same one the browser uses to remove the row. That way
  the test checks exactly what the component says: the row lives while its exit
  runs. The exit itself (gap closing, timing, curve and the `reduce` behavior) is measured
  in a live browser, in `tests-visual/interactions.spec.ts`.
*/
const realGetAnimations = Element.prototype.getAnimations;

function stubAnimations() {
  Element.prototype.getAnimations = function getAnimations() {
    return [{} as Animation];
  };
}

afterEach(() => {
  Element.prototype.getAnimations = realGetAnimations;
});

const shorter = rows.filter((row) => row.id !== "2");

/** The whole row, matched by the text inside it. */
const rowWith = (text: string) => screen.getByText(text).closest("[data-key]") as HTMLElement;

test("a row gone from items lives until its exit is over", async () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  // The row stays in place and its space is still taken: the gap closes along with the exit.
  expect(rowWith("Second")).not.toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(3);

  await act(async () => {
    // A real event, not `fireEvent.animationEnd`: React's synthetic handler does not
    // fire on it in jsdom, and the component listens for the real one,
    // so the test dispatches a real event.
    rowWith("Second").dispatchEvent(new Event("animationend", { bubbles: true }));
  });

  expect(screen.queryByText("Second")).toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(2);
});

test("the leaving row is inert from the first frame, not at the end of the exit", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  const ghost = rowWith("Second");
  // `inert` removes focus, clicks and the screen reader announcement at once: for a
  // blind user the entry vanished at the moment of the action.
  expect(ghost.hasAttribute("inert")).toBe(true);
  expect(ghost.getAttribute("data-disabled")).toBe("true");
  // The drag handle is disabled along with the row: a row that is leaving cannot be dragged.
  const handle = within(ghost).getByRole("button", { name: /Drag/ });
  expect((handle as HTMLButtonElement).disabled).toBe(true);
});

test("the exit carries the measured height, because height does not animate from auto", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  const ghost = rowWith("Second");
  expect(ghost.className).toContain("animate-rowout");
  // jsdom has no layout and the height is zero, so the test checks that the variable
  // is set at all, not what it equals: the value is measured in a browser.
  expect(ghost.style.getPropertyValue("--row-exit-h")).toMatch(/^\d+px$/);
});

test("a key that came back cancels its own ghost: no two rows with one id", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);
  rerender(<EditableList items={rows} {...base} />);

  expect(screen.getAllByText("Second")).toHaveLength(1);
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("two rows leaving one after another keep their places, not swap them", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  // The second row leaves first, then the third. The index into the old `items` knows
  // nothing about the ghost: it is shifted by the departed row, and the rows swapped places.
  rerender(<EditableList items={[rows[0]!, rows[2]!]} {...base} />);
  rerender(<EditableList items={[rows[0]!]} {...base} />);

  expect(screen.getAllByRole("row").map((row) => row.textContent)).toEqual([
    expect.stringContaining("First"),
    expect.stringContaining("Second"),
    expect.stringContaining("Third"),
  ]);
});

test("a row nothing animates is dropped on the next frame, not held forever", async () => {
  // The stub is NOT installed: `getAnimations` does not exist in jsdom at all, which is
  // the same state as a browser with nothing to play.
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  await waitFor(() => expect(screen.queryByText("Second")).toBeNull());
  expect(screen.getAllByRole("row")).toHaveLength(2);
});
