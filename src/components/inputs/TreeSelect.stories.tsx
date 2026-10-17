import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { TreeSelect } from "./TreeSelect.js";
import type { TreeNode } from "../navigation/TreeView.js";

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
      {
        id: "finance",
        label: "Finance",
        children: [
          { id: "payroll", label: "Payroll" },
          { id: "treasury", label: "Treasury", disabled: true },
        ],
      },
    ],
  },
];

const meta = {
  title: "Inputs/TreeSelect",
  component: TreeSelect,
  // Periphery per ADR-0038: a composition of the ready-made `TreeView` and `Popover`.
  // The tag turns off snapshots: they would guard atoms that the core already guards.
  tags: ["periphery"],
  parameters: { layout: "centered" },
  args: {
    items: ORG,
    value: [],
    onChange: () => {},
    "aria-label": "Division",
    defaultExpandedKeys: ["company", "sales"],
  },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
  render: (args) => {
    const [value, setValue] = useState<Key[]>(args.value);
    return <TreeSelect {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof TreeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single selection: the node is selected, the popover closes, and the goal is reached. */
export const Playground: Story = {
  args: { value: ["logistics"] },
};

/**
 * Multiple selection: chips in the closed field, and the popover stays open, since the selection
 * is not finished yet; closing it would force reopening it for every node.
 */
export const Multiple: Story = {
  args: { multiple: true, value: ["direct", "logistics"] },
};

/** More than three selected: the tail collapses, and the field does not grow by five rows. */
export const ManySelected: Story = {
  args: { multiple: true, value: ["direct", "partners", "logistics", "payroll"] },
};

/**
 * Clearing uses a real button next to the trigger, as in `Select`: a nested button
 * would be `nested-interactive`, and an `aria-hidden` cross inside it would drop out of the
 * accessibility tree entirely. From the keyboard, Delete or Backspace also clears the field.
 */
export const Clearable: Story = {
  args: { clearable: true, value: ["partners"] },
};

/** An empty field shows the placeholder from the message catalog if none is passed. */
export const Empty: Story = {};

/** A disabled field does not expand. */
export const Disabled: Story = {
  args: { disabled: true, value: ["finance"] },
};
