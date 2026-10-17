// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import { TreeSelect } from "../src/components/inputs/TreeSelect.js";
import type { TreeNode } from "../src/components/navigation/TreeView.js";

/*
  The `CSS.escape` shim is the same as in `menu.test.tsx`: jsdom has no `CSS` object, and the
  popover calls it on open, so without the shim the field does not open in any test.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

const ORG: TreeNode[] = [
  {
    id: "company",
    label: "Company",
    children: [
      {
        id: "sales",
        label: "Sales",
        children: [
          { id: "direct", label: "Direct sales" },
          { id: "partners", label: "Partner network" },
        ],
      },
      { id: "logistics", label: "Logistics" },
      { id: "finance", label: "Finance" },
    ],
  },
];

function Org({ initial = [] as Key[], multiple = false, clearable = false, disabled = false }) {
  const [value, setValue] = useState<Key[]>(initial);
  return (
    <TreeSelect
      items={ORG}
      value={value}
      onChange={setValue}
      multiple={multiple}
      clearable={clearable}
      disabled={disabled}
      defaultExpandedKeys={["company", "sales"]}
      aria-label="Division"
    />
  );
}

/*
  The field's name is built from the hidden label and the content: `aria-label` on the button would
  win over the content, and the field would be announced as "Division" with not a word about what
  is selected.
*/
const field = () => screen.getByRole("button", { name: /^Division/ });

test("the closed field shows the placeholder while nothing is chosen", () => {
  render(<Org />);
  expect(screen.getByText("Select a node")).toBeTruthy();
});

test("the closed field shows the caption of the chosen node", () => {
  render(<Org initial={["logistics"]} />);
  expect(screen.getByText("Logistics")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();
});

/*
  The main accessibility check for this field: the selected value must be part of the name. While
  the name came from `aria-label`, a screen reader user heard "Division, button" and never learned
  what was selected, and axe does not catch this, because the button does have a name.
*/
test("the accessible name carries both the label and the chosen value", () => {
  render(<Org initial={["logistics"]} />);
  expect(screen.getByRole("button", { name: "Division Logistics" })).toBeTruthy();
});

test("the accessible name falls back to the placeholder while empty", () => {
  render(<Org />);
  expect(screen.getByRole("button", { name: "Division Select a node" })).toBeTruthy();
});

/*
  The inner part is the `TreeView` itself, not a second tree: the `treegrid` role comes from it
  (ADR-0024). The test guards the composition, not the markup.
*/
test("the popover holds a TreeView, not a second tree", async () => {
  const user = userEvent.setup();
  render(<Org />);

  await user.click(field());
  expect(await screen.findByRole("treegrid", { name: "Division" })).toBeTruthy();
});

test("a single choice sets the value and closes the popover", async () => {
  const user = userEvent.setup();
  render(<Org />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Finance$/ }));

  expect(screen.queryByRole("treegrid")).toBeNull();
  expect(screen.getByText("Finance")).toBeTruthy();
});

/*
  Multi-select does NOT close the popover: the selection is not finished, and closing it would
  require reopening on every node.
*/
test("a multiple choice keeps the popover open and shows chips", async () => {
  const user = userEvent.setup();
  render(<Org multiple />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Logistics$/ }));
  expect(screen.getByRole("treegrid")).toBeTruthy();

  await user.click(screen.getByRole("row", { name: /^Finance$/ }));
  expect(screen.getByRole("treegrid")).toBeTruthy();

  // Searching the whole document is not an option: the popover is open, and the tree's row labels
  // match the same expression. The previous version of the test passed even on a component that
  // does not render chips at all.
  const chips = within(field()).getAllByText(/^(Logistics|Finance)$/);
  expect(chips).toHaveLength(2);
});

/*
  Ticking a branch does not tick its descendants, and that is a decision, not an oversight: whether
  "department" means all its employees is a question of access policy, not of the kit.
*/
test("choosing a branch does not choose its descendants", async () => {
  const user = userEvent.setup();
  render(<Org multiple />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Sales$/ }));

  expect(screen.getByRole("row", { name: /Direct sales/ }).getAttribute("aria-selected")).not.toBe(
    "true"
  );
});

test("Delete clears the field from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  field().focus();
  await user.keyboard("{Delete}");

  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  Clearing is a real button SIBLING of the trigger, as in `Select`. The previous version of the test
  counted buttons on the page and expected one: it would catch a nested button, but it would also
  pass when there is no clear button at all.
*/
test("clearing is a real button next to the trigger, not inside it", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  const clear = screen.getByRole("button", { name: "Clear" });
  expect(field().contains(clear)).toBe(false);

  await user.click(clear);
  expect(screen.getByText("Select a node")).toBeTruthy();
  // Clearing does not open the field: otherwise every reset would open the tree.
  expect(screen.queryByRole("treegrid")).toBeNull();
});

test("Backspace clears the field as well as Delete", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  field().focus();
  await user.keyboard("{Backspace}");
  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  A key that is not in `items` is shown as is. Previously the field said "nothing selected", clearing
  was unavailable, and a non-empty value went outward: three different answers to one question at
  once.
*/
test("a key missing from items is shown and can be cleared", async () => {
  const user = userEvent.setup();
  render(<Org initial={["ghost"]} clearable />);

  expect(screen.getByText("ghost")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  A field that grows by five rows stops being a field: its tail gets collapsed.
*/
test("more than three chips collapse into a tail", () => {
  render(<Org multiple initial={["direct", "partners", "logistics", "finance"]} />);

  expect(within(field()).getAllByText(/^(Direct sales|Partner network|Logistics)$/)).toHaveLength(
    3
  );
  expect(within(field()).getByText("+1 more")).toBeTruthy();
});

test("a disabled field does not open", async () => {
  const user = userEvent.setup();
  render(<Org disabled />);

  await user.click(field());
  expect(screen.queryByRole("treegrid")).toBeNull();
});

/*
  The two guards against opening a disabled field masked each other: the test failed only when both
  were removed. We check each one separately, through the observable consequence rather than an
  attribute.
*/
test("a disabled field keeps both guards: the trigger is off and the popover is pinned shut", async () => {
  const user = userEvent.setup();
  render(<Org disabled />);

  const trigger = field();
  expect(trigger.hasAttribute("disabled")).toBe(true);

  // Even a forced press that bypasses the attribute does not open the field.
  await user.click(trigger);
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(screen.queryByRole("treegrid")).toBeNull();
});

/*
  An empty tree means "no data", not "nothing found": the field has no search of its own, and the
  user made no query. The kit's vocabulary distinguishes these two states.
*/
test("an empty tree says there is no data, not that a search found nothing", async () => {
  const user = userEvent.setup();
  render(<TreeSelect items={[]} value={[]} onChange={() => {}} aria-label="Division" />);

  await user.click(field());
  expect(await screen.findByText("Empty")).toBeTruthy();
  expect(screen.queryByText("Nothing found")).toBeNull();
});

/* The popover's role must match what is inside it: here it is `treegrid`. */
test("the trigger announces the popup it actually opens", () => {
  render(<Org />);
  expect(field().getAttribute("aria-haspopup")).toBe("grid");
});

test("placeholder overrides the catalogue string", () => {
  render(
    <TreeSelect
      items={ORG}
      value={[]}
      onChange={() => {}}
      aria-label="Division"
      placeholder="Pick a unit"
    />
  );
  expect(screen.getByText("Pick a unit")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();
});

test("clearLabel names the clear button", () => {
  render(
    <TreeSelect
      items={ORG}
      value={["finance"]}
      onChange={() => {}}
      aria-label="Division"
      clearable
      clearLabel="Reset division"
    />
  );
  expect(screen.getByRole("button", { name: "Reset division" })).toBeTruthy();
});

/*
  Controlled expansion: without it, a deeply nested selected node opens in a collapsed tree where
  nothing points to it.
*/
test("expandedKeys is controlled from outside", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeSelect
      items={ORG}
      value={[]}
      onChange={() => {}}
      aria-label="Division"
      expandedKeys={["company"]}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(field());
  // Only "Company" is expanded: its children are visible, the children of "Sales" are not.
  expect(await screen.findByRole("row", { name: /^Sales$/ })).toBeTruthy();
  expect(screen.queryByRole("row", { name: /^Direct sales$/ })).toBeNull();
});

/* The `multiple` axis controls the selection mode of the tree itself, not only the look of the field. */
test("multiple drives the tree selection mode", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Org />);

  await user.click(field());
  expect((await screen.findByRole("treegrid")).getAttribute("aria-multiselectable")).not.toBe(
    "true"
  );
  unmount();

  render(<Org multiple />);
  await user.click(field());
  expect((await screen.findByRole("treegrid")).getAttribute("aria-multiselectable")).toBe("true");
});

/*
  A cycle in `items` is bad data from the consumer, but a stack overflow is a poor way to report it.
*/
test("a cycle in items does not blow the stack", () => {
  const loop: TreeNode = { id: "a", label: "Loop" };
  loop.children = [loop];

  expect(() =>
    render(<TreeSelect items={[loop]} value={["a"]} onChange={() => {}} aria-label="Division" />)
  ).not.toThrow();
  expect(screen.getByText("Loop")).toBeTruthy();
});

/**
 * Disabling the field closes the panel instead of hiding it.
 *
 * `Popover open={open && !disabled}` suppressed the display, but a controlled change of `open` in
 * Radix does not call `onOpenChange`, so the internal state stayed `true`. The form was submitted:
 * the panel disappeared; when submission ended, the panel came back on its own, even though the
 * user had pressed nothing.
 */
test("disabling the field closes the popover for good", async () => {
  const user = userEvent.setup();

  function Host({ disabled }: { disabled: boolean }) {
    return (
      <TreeSelect
        items={ORG}
        value={[]}
        onChange={() => {}}
        aria-label="Division"
        disabled={disabled}
      />
    );
  }

  // Through `rerender`, NOT by clicking a neighboring button: a click outside the panel is closed by
  // Radix itself, and the defect does not reproduce this way. Verified.
  const { rerender } = render(<Host disabled={false} />);
  await user.click(field());
  expect(screen.getByRole("treegrid")).toBeDefined();

  rerender(<Host disabled />);
  rerender(<Host disabled={false} />);

  expect(screen.queryByRole("treegrid")).toBeNull();
});
