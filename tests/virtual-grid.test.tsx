// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Selection } from "react-aria-components";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VirtualGrid, type VirtualGridItem } from "../src/components/content/VirtualGrid.js";
import { ContextMenuItem } from "../src/components/overlays/ContextMenu.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/*
  WHAT IS NOT TESTED HERE, AND WHY. jsdom has no layout: the container's width and height are zero,
  so the virtualizer correctly decides that no cells are visible — the markup contains none,
  whatever the number of items. Testing virtualization, the column count or scrolling here is
  pointless: the test would either always pass or fail on a working component.

  The real checks are in the browser, `tests-visual/interactions.spec.ts`: how many nodes are in
  the DOM with six hundred cells, that scrolling is custom, and that scrolling renders other cells.
  The split is ADR-0012 and ADR-0028.
*/

const cells: VirtualGridItem[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  textValue: `Cell ${i}`,
  content: <div>Cell {i}</div>,
}));

test("the grid is named; the role comes from the behaviour layer", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // `grid` with `data-layout="grid"` is react-aria's decision (`GridList`): we do not set the roles
  // by hand, otherwise the keyboard would stop matching the markup. Before OLDSUI-199 this was
  // `listbox` (ADR-0028, addendum).
  const grid = screen.getByRole("grid", { name: "Frames" });
  expect(grid.getAttribute("data-layout")).toBe("grid");
});

test("the container itself owns the scrolling, not the window", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // The window-scrolling grid scrolls the page (`useWindowVirtualizer`); here scrolling is its own,
  // and the consumer must set the container's height — without it, virtualization does not turn on
  // at all.
  const grid = screen.getByRole("grid");
  expect(grid.className).toContain("overflow-auto");
  expect(grid.className).toContain("h-[300px]");
});

test("an empty grid shows its own state", () => {
  render(
    <VirtualGrid items={[]} aria-label="Frames" emptyText="Nothing here" className="h-[300px]" />
  );
  expect(screen.getByText("Nothing here")).toBeTruthy();
});

test("without the prop there is no selection axis at all", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // The axis is turned on EXPLICITLY: a grid without the prop promises no selection and does not
  // announce one.
  expect(screen.getByRole("grid").hasAttribute("aria-multiselectable")).toBe(false);
});

test("selectionMode puts the axis on the grid, not inside the cell", () => {
  render(
    <VirtualGrid items={cells} aria-label="Frames" selectionMode="multiple" className="h-[300px]" />
  );

  // The cell itself is selected — by role. A selection checkbox inside the cell is legal since
  // OLDSUI-199 (`gridcell`), but the axis still belongs to the grid.
  expect(screen.getByRole("grid").getAttribute("aria-multiselectable")).toBe("true");
});

/*
  CELL BEHAVIOR. There is no layout in jsdom, so the container's size is set by a stub: the
  virtualizer gets a non-zero window and renders the cells. The number of columns and scrolling are
  still checked only in the browser.
*/
function withLayout() {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 600,
    height: 400,
    top: 0,
    left: 0,
    right: 600,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

beforeEach(withLayout);

test("onAction opens a cell on click and on Enter without selecting it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  const options = screen.getAllByRole("row");
  await user.click(options[1]!);
  expect(onAction).toHaveBeenLastCalledWith(
    "1",
    expect.objectContaining({ rect: expect.anything() })
  );

  options[2]!.focus();
  await user.keyboard("{Enter}");
  expect(onAction).toHaveBeenLastCalledWith(
    "2",
    expect.objectContaining({ rect: expect.anything() })
  );

  expect(onAction).toHaveBeenCalledTimes(2);
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(screen.getByRole("grid").hasAttribute("aria-multiselectable")).toBe(false);
  expect(options.some((option) => option.getAttribute("aria-selected") === "true")).toBe(false);
});

test("with selectionMode, Enter acts and Space selects", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  screen.getAllByRole("row")[1]!.focus();
  await user.keyboard("{Enter}");
  expect(onAction).toHaveBeenCalledWith("1", expect.objectContaining({ rect: expect.anything() }));
  expect(onSelectionChange).not.toHaveBeenCalled();

  await user.keyboard(" ");
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
});

const withMenu = (onSelect = vi.fn()): VirtualGridItem[] =>
  cells.map((cell) => ({
    ...cell,
    contextMenu: <ContextMenuItem onSelect={() => onSelect(cell.id)}>Rename</ContextMenuItem>,
  }));

test("a cell with contextMenu opens it on the right click", () => {
  render(<VirtualGrid items={withMenu()} aria-label="Frames" className="h-[300px]" />);

  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.contextMenu(screen.getByText("Cell 1"));
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
});

test("Shift+F10 and the context-menu key open the menu with focus on the cell itself", async () => {
  const user = userEvent.setup();
  render(<VirtualGrid items={withMenu()} aria-label="Frames" className="h-[300px]" />);

  const option = screen.getAllByRole("row")[1]!;
  option.focus();
  await user.keyboard("{Shift>}{F10}{/Shift}");
  expect(screen.getByRole("menu")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  // A menu closed from the keyboard returns focus to the cell, rather than losing it.
  expect(document.activeElement).toBe(option);

  await user.keyboard("{ContextMenu}");
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("picking a menu item neither selects the cell nor fires its action", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={withMenu(onSelect)}
      aria-label="Frames"
      selectionMode="single"
      onSelectionChange={onSelectionChange}
      onAction={onAction}
      className="h-[300px]"
    />
  );

  fireEvent.contextMenu(screen.getByText("Cell 1"));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(onSelect).toHaveBeenCalledWith("1");
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onAction).not.toHaveBeenCalled();
});

test("cells without contextMenu keep their markup and open nothing", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  fireEvent.contextMenu(screen.getByText("Cell 1"));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  OLDSUI-199: a grid for a photo library. Window scrolling, load-on-edge and touch drag live in the
  browser (`tests-visual/interactions.spec.ts`); here are the things visible in the markup and in
  the calls.
*/

test("a button inside a cell is legal and neither selects nor opens the cell", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  const favourite = vi.fn();
  render(
    <VirtualGrid
      items={cells.map((cell) => ({
        ...cell,
        content: (
          <div>
            {cell.textValue}
            <button type="button" onClick={() => favourite(cell.id)}>
              Favourite {cell.id}
            </button>
          </div>
        ),
      }))}
      aria-label="Frames"
      selectionMode="multiple"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  // The button sits in the `gridcell`, not in an `option`: this way axe does not see a nested
  // interactive element (in `option` it was a serious-level nested-interactive violation).
  const button = screen.getByRole("button", { name: "Favourite 1" });
  expect(button.closest('[role="gridcell"]')).not.toBeNull();
  expect(button.closest('[role="option"]')).toBeNull();

  await user.click(button);
  expect(favourite).toHaveBeenCalledWith("1");
  expect(onAction).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
});

test("onAction hands over the cell's rectangle for an opening animation", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <VirtualGrid items={cells} aria-label="Frames" onAction={onAction} className="h-[300px]" />
  );

  await user.click(screen.getAllByRole("row")[1]!);
  expect(onAction).toHaveBeenCalledTimes(1);
  const [id, details] = onAction.mock.calls[0]!;
  expect(id).toBe("1");
  // In jsdom the rectangle is replaced by the layout stub (600×400): what matters is that it came
  // and that it is the cell's rectangle, not the grid's.
  expect(details.rect).toMatchObject({ width: 600, height: 400 });
});

test("selectionBehavior is passed to the behaviour layer", async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  const onAction = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      selectionBehavior="replace"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  // In `replace`, a click selects rather than opens: the action is double-click and Enter.
  await user.click(screen.getAllByRole("row")[2]!);
  expect(onAction).not.toHaveBeenCalled();
  expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["2"]);
});

test('rangeSelection="add": Shift extends the selection without dropping what was there', async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      selectedKeys={new Set(["0", "4"])}
      rangeSelection="add"
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  const rows = screen.getAllByRole("row");
  rows[1]!.focus();
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  // react-aria would replace the set with a range from the anchor; `add` mode adds the range to the
  // previous selection — "0" and "4" remain.
  const keys = [...onSelectionChange.mock.lastCall![0]].sort();
  expect(keys).toEqual(expect.arrayContaining(["0", "4"]));
  expect(keys.length).toBeGreaterThan(2);
});

test('rangeSelection="add": a second Shift range in a row still starts at the anchor', async () => {
  // The consumer stores the selection as it arrived, as the component's page instructs.
  function Harness() {
    const [keys, setKeys] = useState<Selection>(new Set());
    return (
      <VirtualGrid
        items={cells}
        aria-label="Frames"
        selectionMode="multiple"
        selectedKeys={keys}
        rangeSelection="add"
        onSelectionChange={setKeys}
        className="h-[2000px]"
      />
    );
  }
  const user = userEvent.setup();
  render(<Harness />);

  const row = (i: number) => screen.getAllByRole("row")[i]!;
  await user.click(row(0));
  await user.keyboard("{Shift>}");
  await user.click(row(2));
  await user.click(row(4));
  await user.keyboard("{/Shift}");
  // The anchor is cell "0": the second range extends from it and captures "3". Merging into a plain
  // `Set` lost the anchor, and the second Shift+click selected only cell "4" (OLDSUI-203).
  const selected = screen
    .getAllByRole("row")
    .filter((r) => r.getAttribute("aria-selected") === "true")
    .map((r) => r.getAttribute("data-key"));
  expect(selected).toEqual(["0", "1", "2", "3", "4"]);
});

test('scroll="window": no own scrolling, cells keep clear of the sticky bar', () => {
  render(<VirtualGrid items={cells} aria-label="Frames" scroll="window" />);

  const grid = screen.getByRole("grid");
  expect(grid.className).not.toContain("overflow-auto");
  // Focus moved by an arrow past the window edge is not hidden under the sticky TopBar: the offset is
  // the same variable that `TopBar` publishes (ADR-0016/0019).
  const row = screen.getAllByRole("row")[0]!;
  expect(row.style.scrollMarginTop).toBe("var(--topbar-h, 0px)");
});

test("offsetVar renames the variable of the sticky bar, like SelectionBar", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" scroll="window" offsetVar="--app-bar" />);
  expect(screen.getAllByRole("row")[0]!.style.scrollMarginTop).toBe("var(--app-bar, 0px)");
});

test("isLoadingMore shows the loading row with an accessible status", () => {
  // react-aria's load-more sensor relies on `IntersectionObserver`, which is absent in jsdom. A
  // consumer with `onLoadMore` needs the same stub in jsdom — this is stated on the component's page.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      onLoadMore={() => {}}
      isLoadingMore
      className="h-[300px]"
    />
  );
  expect(screen.getByRole("status")).toBeTruthy();
});

test("minItemHeight is a real minimum: the cell is never lower", () => {
  render(
    <VirtualGrid items={cells} aria-label="Frames" minItemHeight={140} className="h-[300px]" />
  );
  // `gridcell` in react-aria is `display: contents`; the height is held by a wrapper inside.
  const cell = screen.getAllByRole("gridcell")[0]!.firstElementChild as HTMLElement;
  expect(cell.style.minHeight).toBe("140px");
});

test("the cell wrapper gives its content a definite height, so `h-full` content fills the row", () => {
  render(
    <VirtualGrid items={cells} aria-label="Frames" minItemHeight={140} className="h-[300px]" />
  );
  const cell = screen.getAllByRole("gridcell")[0]!.firstElementChild as HTMLElement;
  // A nested node's percentage height is resolved against the grid row, not against `min-height`,
  // so the wrapper is a one-row grid that is never shorter than the minimum.
  expect(cell.classList.contains("grid")).toBe(true);
  expect(cell.style.gridTemplateRows).toBe("minmax(140px, 1fr)");
});

test("edgeGap={false} puts the outer cells flush with the edges", () => {
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      minItemWidth={180}
      gap={12}
      edgeGap={false}
      className="h-[300px]"
    />
  );
  // The layout positions cells absolutely; the first cell, with no outer margin,
  // starts at zero on both axes.
  const first = screen.getAllByRole("row")[0]!.parentElement!;
  expect(first.style.left).toBe("0px");
  expect(first.style.top).toBe("0px");
});

test('dragToSelect without selectionMode="multiple" warns in development', () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<VirtualGrid items={cells} aria-label="Frames" dragToSelect className="h-[300px]" />);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("dragToSelect"));
});
