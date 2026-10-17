// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Transfer, type TransferItem } from "../src/components/inputs/Transfer.js";

afterEach(cleanup);

const RIGHTS: TransferItem[] = [
  { id: "reports", label: "View reports" },
  { id: "export", label: "Export data" },
  { id: "roles", label: "Manage roles" },
  { id: "delete", label: "Delete records", disabled: true },
  { id: "hooks", label: "Configure webhooks" },
];

function Rights({ initial = [] as string[], searchable = false }) {
  const [value, setValue] = useState(initial);
  return <Transfer items={RIGHTS} value={value} onChange={setValue} searchable={searchable} />;
}

/*
  A list's accessible name combines the column label and the counter: the number is on screen, so
  it must be in the spoken name too. Hence the lookup by the start of the name.
*/
const available = () => screen.getByRole("listbox", { name: /^Available/ });
const selected = () => screen.getByRole("listbox", { name: /^Selected/ });
const toRight = () => screen.getByRole("button", { name: "Move to selected" });
const toLeft = () => screen.getByRole("button", { name: "Move to available" });

test("an item moves to the other column and disappears from the first", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(toRight());

  expect(within(selected()).getByRole("option", { name: "Export data" })).toBeTruthy();
  expect(within(available()).queryByRole("option", { name: "Export data" })).toBeNull();
});

test("an item moves back", async () => {
  const user = userEvent.setup();
  render(<Rights initial={["export"]} />);

  await user.click(within(selected()).getByRole("option", { name: "Export data" }));
  await user.click(toLeft());

  expect(within(available()).getByRole("option", { name: "Export data" })).toBeTruthy();
  expect(within(selected()).queryByRole("option", { name: "Export data" })).toBeNull();
});

/*
  The counter is checked through the column's accessible name, not through a layout class: binding
  to `.text-caption` would break when the type scale changes without any change in behavior, and
  would not assert which column the number belongs to.
*/
test("the counters follow the columns", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  expect(screen.getByRole("listbox", { name: "Available 5" })).toBeTruthy();
  expect(screen.getByRole("listbox", { name: "Selected 0" })).toBeTruthy();

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.click(toRight());

  expect(screen.getByRole("listbox", { name: "Available 4" })).toBeTruthy();
  expect(screen.getByRole("listbox", { name: "Selected 1" })).toBeTruthy();
});

/*
  The counter covers the whole column, not what is left after a search: it answers "how many are
  available in total", while a filter is only a view of them.
*/
test("the counter counts the column, not the filtered view", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("listbox", { name: "Available 5" })).toBeTruthy();
});

/*
  An unavailable item is shown but cannot be moved: hiding it would misstate the set of rights, and
  moving it would bypass the restriction.
*/
test("a disabled item is shown but never moves", async () => {
  const user = userEvent.setup();

  // A disabled item cannot be selected by a click at all, so "click and check that the button is
  // dead" would also pass on a component with no guard: before the click, the button is dead in
  // the same way. The only meaningful scenario is to select an available item and disable it with
  // the prop.
  function Switchable() {
    const [items, setItems] = useState(RIGHTS);
    const [value, setValue] = useState<string[]>([]);
    return (
      <>
        <button
          onClick={() =>
            setItems((list) =>
              list.map((item) => (item.id === "export" ? { ...item, disabled: true } : item))
            )
          }
        >
          Revoke
        </button>
        <Transfer items={items} value={value} onChange={setValue} />
      </>
    );
  }
  render(<Switchable />);

  expect(
    within(available())
      .getByRole("option", { name: "Delete records" })
      .getAttribute("aria-disabled")
  ).toBe("true");

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);

  await user.click(screen.getByRole("button", { name: "Revoke" }));
  expect(toRight().hasAttribute("disabled")).toBe(true);

  await user.click(toRight());
  expect(within(selected()).queryByRole("option", { name: "Export data" })).toBeNull();
});

/*
  `Ctrl`/`Cmd`+`A` inside the list is react-aria's standard shortcut, and it yields the string
  `'all'` rather than a set of keys. While it returned an empty list, "select all and move" disabled
  both buttons: the most common scenario was a dead end.
*/
test("select-all inside a column moves the whole column", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.keyboard("{Control>}a{/Control}");

  expect(toRight().hasAttribute("disabled")).toBe(false);
  await user.click(toRight());

  // An unavailable "Delete records" stays on the left: selecting everything does not mean
  // bypassing the restriction.
  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(selected()).getAllByRole("option")).toHaveLength(4);
});

/*
  The button must not move what is not on screen: the user is responsible for what they see.
  Before the fix, a selected item hidden by the filter moved along with the visible ones.
*/
test("a selection hidden by the filter does not travel with the visible ones", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(toRight().hasAttribute("disabled")).toBe(true);
});

/*
  The highlight lives inside the component and survives an external change of `value`. A key that
  was moved to another column by someone else's edit stayed "movable" and arrived in `value` as a
  second copy, invisible on screen.
*/
test("an external change to value does not let a stale selection duplicate a key", async () => {
  const user = userEvent.setup();
  const seen: string[][] = [];

  function Outside() {
    const [value, setValue] = useState<string[]>([]);
    seen.push(value);
    return (
      <>
        <button onClick={() => setValue(["export"])}>Grant outside</button>
        <Transfer items={RIGHTS} value={value} onChange={setValue} />
      </>
    );
  }
  render(<Outside />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(screen.getByRole("button", { name: "Grant outside" }));

  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(seen.at(-1)).toEqual(["export"]);
});

test("the move buttons are off while there is nothing to move", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(toLeft().hasAttribute("disabled")).toBe(true);

  await user.click(within(available()).getByRole("option", { name: "Manage roles" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);
  expect(toLeft().hasAttribute("disabled")).toBe(true);
});

/*
  Focus after a move is checked IN THE BROWSER, not here (ADR-0012): react-aria delegates it from
  the container into the collection, and in jsdom this path is not faithfully reproduced. The
  previous version of the test was green only because the receiving column in the fixture was
  empty: there was nowhere to delegate to. See
  `tests-visual/interactions.spec.ts`.
*/

/*
  A consequence of the same rule: moved items become the selection where they arrive, so they can
  be moved back without selecting them again.
*/
test("moved items arrive selected, so the return move needs no reselection", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(toRight());

  expect(toLeft().hasAttribute("disabled")).toBe(false);

  await user.click(toLeft());
  expect(within(available()).getByRole("option", { name: "Export data" })).toBeTruthy();
});

/*
  The order of the target column is the order of assignment, not the order of `items`. Otherwise
  the list of assigned rights would reshuffle itself.
*/
test("the target column keeps the order in which items were added", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Configure webhooks" }));
  await user.click(toRight());
  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.click(toRight());

  const labels = within(selected())
    .getAllByRole("option")
    .map((node) => node.textContent);
  expect(labels).toEqual(["Configure webhooks", "View reports"]);
});

test("search filters a column without touching the other one", async () => {
  const user = userEvent.setup();
  render(<Rights initial={["export"]} searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(selected()).getAllByRole("option")).toHaveLength(1);
});

test("a search with no matches says so instead of showing an empty box", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "zzz");
  expect(within(available()).getByText("Nothing found")).toBeTruthy();
});

/*
  Without a name, an AT user hears two unrelated lists and two arrows between them, and nothing
  says that this is one question rather than two. An unnamed group is worse than no group at all,
  the same rule as for `ButtonGroup`.
*/
test("a name turns the pair into one announced group", () => {
  const { rerender } = render(
    <Transfer items={RIGHTS} value={[]} onChange={() => {}} aria-label="Role permissions" />
  );
  expect(screen.getByRole("group", { name: "Role permissions" })).toBeTruthy();

  rerender(<Transfer items={RIGHTS} value={[]} onChange={() => {}} />);
  expect(screen.queryByRole("group")).toBeNull();
});

/*
  The component's own `disabled` applies to the whole control, unlike `TransferItem.disabled`,
  which applies to one shown but non-movable item.
*/
/*
  Selection is done BEFORE disabling: otherwise the button is dead anyway, because there is nothing
  to move, and the test would pass with any code.
*/
test("a disabled transfer moves nothing at all", async () => {
  const user = userEvent.setup();

  let turnOff = () => {};
  function Switchable() {
    const [off, setOff] = useState(false);
    const [value, setValue] = useState<string[]>([]);
    turnOff = () => setOff(true);
    return <Transfer items={RIGHTS} value={value} onChange={setValue} disabled={off} />;
  }
  render(<Switchable />);

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);

  act(() => turnOff());
  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(toLeft().hasAttribute("disabled")).toBe(true);
});

test("searchable is an axis: without it there is no search field", () => {
  render(<Rights />);
  expect(screen.queryByRole("textbox")).toBeNull();
});

/*
  The query is typed in lowercase, while the label starts with a capital: only this way does the
  check catch the loss of case folding on the LABEL. The query is lowercased separately, and
  "ROLES" against "Manage roles" would pass even without it.
*/
test("search ignores case on the label, not just on the query", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "manage");
  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(available()).getByRole("option", { name: "Manage roles" })).toBeTruthy();
});
