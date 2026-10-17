// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SavedViews, type SavedView } from "../src/components/table/SavedViews.js";

afterEach(cleanup);

interface Filters {
  status: string;
  page: number;
}

const views: SavedView<Filters>[] = [
  { id: "all", name: "All", state: { status: "", page: 1 } },
  { id: "drafts", name: "Drafts", state: { status: "draft", page: 1 } },
  { id: "failed", name: "Failed", state: { status: "failed", page: 3 } },
];

test("the active view is announced, not only highlighted", () => {
  render(<SavedViews views={views} activeId="drafts" onSelect={() => {}} />);

  // A color highlight is not a message for the screen reader: the same defect was fixed in
  // `Segmented` and in the theme switcher.
  const pressed = screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true");
  expect(pressed).toHaveLength(1);
  expect(pressed[0]?.textContent).toBe("Drafts");
});

test("without an active view none is announced as pressed", () => {
  // `activeId` is not set: in the consumer this is the "default view", a reset address.
  render(<SavedViews views={views} onSelect={() => {}} />);
  const pressed = screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true");
  expect(pressed).toHaveLength(0);
});

test("picking yields the whole snapshot in ONE call", async () => {
  // This is why the component is built this way. In the consumer, the state is carried into
  // the address, and consecutive writes by key build the address from one snapshot of the
  // current render: the last one wins and the earlier edits are lost. That is exactly how the
  // lower bound of the range was lost in the front end, and why `setMany` was added there.
  const onSelect = vi.fn();
  render(<SavedViews views={views} activeId="all" onSelect={onSelect} />);

  const user = userEvent.setup();
  await user.click(screen.getByText("Failed"));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(views[2]);
  // The snapshot arrives whole, not by key: both parts of the state are in place.
  expect(onSelect.mock.calls[0]?.[0].state).toEqual({ status: "failed", page: 3 });
});

test("the kit stores nothing and subscribes to nothing", async () => {
  // The storages are REPLACED WHOLE, not spied on through `Storage.prototype`.
  // The reason is the same as the one written for `themeInitScript` in `themes.test.ts`:
  // in this version of jsdom `localStorage` exists by name, but without the `Storage`
  // methods. A spy on the prototype would never fire there, and the "nothing was written"
  // check would pass whatever the component does.
  //
  // This is not a theory here but a caught defect: the first version of the gate spied on
  // the prototype and stayed green when a write to `localStorage` was deliberately added to
  // the component.
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  const pushState = vi.spyOn(window.history, "pushState");
  const replaceState = vi.spyOn(window.history, "replaceState");

  const { rerender } = render(<SavedViews views={views} activeId="all" onSelect={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Drafts"));
  rerender(<SavedViews views={views} activeId="drafts" onSelect={() => {}} />);

  // The `useTableState` model (ADR-0023): the shape belongs to the kit, the ownership
  // to the consumer.
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(pushState).not.toHaveBeenCalled();
  expect(replaceState).not.toHaveBeenCalled();

  vi.unstubAllGlobals();
  pushState.mockRestore();
  replaceState.mockRestore();
});

test("an empty list is not drawn at all", () => {
  // An empty group would announce itself to the screen reader while containing nothing.
  const { container } = render(<SavedViews views={[]} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});

test("the group accessible name comes from the catalog and is overridden by a prop", () => {
  const { rerender } = render(<SavedViews views={views} onSelect={() => {}} />);
  expect(screen.getByRole("group", { name: "Saved views" })).toBeTruthy();

  rerender(<SavedViews views={views} onSelect={() => {}} aria-label="Library views" />);
  expect(screen.getByRole("group", { name: "Library views" })).toBeTruthy();
});

test("a snapshot with a range filter is handed back untouched", async () => {
  // A view stores the snapshot as an opaque value (ADR-0033): a range with `to`, including one
  // with an empty bound, must come back as the same object, without the normalization "an empty
  // bound means no bound".
  const range = { id: "r", field: "amount", value: "50", to: "" };
  const withRange: SavedView<{ filters: (typeof range)[] }>[] = [
    { id: "big", name: "Big orders", state: { filters: [range] } },
  ];
  const onSelect = vi.fn();
  render(<SavedViews views={withRange} onSelect={onSelect} />);

  await userEvent.setup().click(screen.getByRole("button", { name: "Big orders" }));

  expect(onSelect.mock.calls[0]![0].state.filters[0]).toBe(range);
});
