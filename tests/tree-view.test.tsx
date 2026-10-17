// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TreeView, type TreeNode } from "../src/components/navigation/TreeView.js";

afterEach(cleanup);

const TREE: TreeNode[] = [
  {
    id: "nature",
    label: "Nature",
    children: [
      { id: "forest", label: "Forest" },
      { id: "sea", label: "Sea", children: [{ id: "sunset", label: "Sunset" }] },
    ],
  },
  { id: "city", label: "City" },
];

test("roles and levels are set by the behaviour layer, not by us", () => {
  // react-aria's tree role is `treegrid`, and the nodes are declared `row`: a row holds the expander
  // button and a checkbox, and a `treeitem` does not expect a second interactive element inside it.
  // That is its decision, and we do not override it.
  render(<TreeView items={TREE} aria-label="Categories" defaultExpandedKeys={["nature"]} />);

  expect(screen.getByRole("treegrid", { name: "Categories" })).toBeTruthy();
  const rootItem = screen.getByRole("row", { name: /Nature/ });
  expect(rootItem.getAttribute("aria-level")).toBe("1");
  expect(rootItem.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-level")).toBe("2");
});

test("a collapsed node shows no children", () => {
  render(<TreeView items={TREE} aria-label="Categories" />);

  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("row", { name: /Forest/ })).toBeNull();
});

test("expansion goes outwards as a set", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      expandedKeys={[]}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getAllByRole("button", { name: /Expand/ })[0]!);

  // The tree does not keep the state itself: the set goes to whoever owns it.
  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});

test("the expander button name does not repeat the node label", () => {
  render(<TreeView items={TREE} aria-label="Categories" />);

  // react-aria appends the label of its element on its own: "Expand Nature" would be read as
  // "Expand Nature Nature" (a lesson from the wave 18 review).
  const button = screen.getAllByRole("button")[0]!;
  expect(button.getAttribute("aria-label")).toBe("Expand");
});

test("without selectionMode there is no selection axis at all", () => {
  render(<TreeView items={TREE} aria-label="Categories" defaultExpandedKeys={["nature"]} />);

  // A category tree that is only browsed should not carry checkboxes.
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-selected")).toBeNull();
});

test("selectionMode turns on the checkboxes and selection goes outwards", async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      selectionMode="multiple"
      selectedKeys={new Set()}
      onSelectionChange={onSelectionChange}
    />
  );

  const boxes = screen.getAllByRole("checkbox");
  expect(boxes.length).toBeGreaterThan(0);
  await user.click(boxes[0]!);

  // Compare by content, not by object: the `Selection` from react-aria is a `Set` with extra fields
  // (an anchor and a current key), and strict equality of sets does not hold for it.
  const selected = onSelectionChange.mock.calls[0]![0] as Set<unknown>;
  expect([...selected]).toEqual(["nature"]);
});

test("acting on a node is not selecting it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" onAction={onAction} />);

  await user.click(screen.getByRole("row", { name: /City/ }));

  expect(onAction).toHaveBeenCalledWith("city");
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
});

test("a disabled node is announced as disabled", () => {
  render(
    <TreeView items={[{ id: "city", label: "City", disabled: true }]} aria-label="Categories" />
  );

  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-disabled")).toBe("true");
});

test("an empty tree shows the given text", () => {
  render(<TreeView items={[]} aria-label="Categories" emptyText="No categories" />);

  expect(screen.getByText("No categories")).toBeTruthy();
});

test("activeKey marks the current node with aria-current and draws no checkboxes", () => {
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature"]}
      activeKey="forest"
    />
  );

  // The current navigation location is not a selection: `aria-current`, without checkboxes and
  // without `aria-selected` (the kit's vocabulary: `active` is `aria-current="page"`).
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("row", { name: /Sea/ }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-current")).toBeNull();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-selected")).toBeNull();
});

test("activeKey follows the prop and an unknown key marks nothing", () => {
  const { rerender } = render(<TreeView items={TREE} aria-label="Categories" activeKey="city" />);
  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-current")).toBe("page");

  rerender(<TreeView items={TREE} aria-label="Categories" activeKey="missing" />);
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);

  rerender(<TreeView items={TREE} aria-label="Categories" />);
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);
});

test("activeKey moves between nested nodes when the prop changes with stable items", () => {
  // The nodes stay the same objects: the tree must re-render the rows by a single `activeKey`,
  // not by a change of `items`.
  const { rerender } = render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature", "sea"]}
      activeKey="forest"
    />
  );
  rerender(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature", "sea"]}
      activeKey="sunset"
    />
  );

  expect(screen.getByRole("row", { name: /Sunset/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-current")).toBeNull();
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
});

test("activeKey works together with onAction and does not turn into a selection", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" activeKey="city" onAction={onAction} />);

  await user.click(screen.getByRole("row", { name: /City/ }));

  // The node stays current until the consumer changes the key: the tree does not move "current"
  // by itself.
  expect(onAction).toHaveBeenCalledWith("city");
  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-current")).toBe("page");
});

test("with onAction a click on a folder acts but does not expand it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      onAction={onAction}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getByRole("row", { name: /Nature/ }));

  // This is react-aria's behavior, not ours: acting on a folder and expanding it are different
  // gestures. The chevron button and the right arrow expand a folder; whoever wants to expand on a
  // row click does it in `onAction` themselves.
  expect(onAction).toHaveBeenCalledWith("nature");
  expect(onExpandedChange).not.toHaveBeenCalled();
});

test("the chevron still expands a folder when onAction is set", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      onAction={() => {}}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getAllByRole("button", { name: /Expand/ })[0]!);

  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});

test("without onAction a click on a folder row expands it", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" onExpandedChange={onExpandedChange} />);

  await user.click(screen.getByRole("row", { name: /Nature/ }));

  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});

/*
  jsdom has no computed Tailwind styles, so what is checked is what the render returns: the colored
  element carries a LITERAL state class. The `disabled:` and `selected:` variants on the inner `div`
  never fired: react-aria puts `data-disabled` and `data-selected` on the `row`, not on the content,
  and by class names such a defect cannot be told apart from working code if you search for the
  variant. So the test searches for the class without the variant prefix.
*/
const labelBox = (name: string) => screen.getByText(name).parentElement!;
const label = (name: string) => screen.getByText(name);

test("a selected row carries the highlight on the element that is painted", () => {
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature"]}
      selectionMode="multiple"
      selectedKeys={new Set(["forest"])}
    />
  );

  // The state lives on the row, but the paint must sit on the content.
  expect(screen.getByRole("row", { name: /Forest/ }).hasAttribute("data-selected")).toBe(true);
  expect(labelBox("Forest").classList.contains("bg-accent-soft")).toBe(true);
  expect(labelBox("Sea").classList.contains("bg-accent-soft")).toBe(false);
});

test("a disabled row is dimmed on the element that is painted", () => {
  render(
    <TreeView
      items={[
        { id: "city", label: "City", disabled: true },
        { id: "sea", label: "Sea" },
      ]}
      aria-label="Categories"
    />
  );

  expect(screen.getByRole("row", { name: /City/ }).hasAttribute("data-disabled")).toBe(true);
  expect(label("City").classList.contains("opacity-50")).toBe(true);
  expect(label("Sea").classList.contains("opacity-50")).toBe(false);
});

test("a key from disabledKeys dims the row the same way as the node field", () => {
  render(<TreeView items={TREE} aria-label="Categories" disabledKeys={["city"]} />);

  expect(label("City").classList.contains("opacity-50")).toBe(true);
});

test("a disabled row with a selection checkbox is not dimmed twice", () => {
  render(
    <TreeView
      items={[{ id: "city", label: "City", disabled: true }]}
      aria-label="Categories"
      selectionMode="multiple"
    />
  );

  // The checkbox is dimmed by its own `disabled:opacity-50` (it gets the blocking from the row), so
  // the row itself must not be dimmed as well: otherwise the two would stack to 25%.
  expect(labelBox("City").classList.contains("opacity-50")).toBe(false);
  expect(screen.getByRole("checkbox").matches(":disabled")).toBe(true);
});
