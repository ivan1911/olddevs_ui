import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Transfer, type TransferItem } from "./Transfer.js";

const RIGHTS: TransferItem[] = [
  { id: "reports", label: "View reports" },
  { id: "export", label: "Export data" },
  { id: "roles", label: "Manage roles" },
  { id: "delete", label: "Delete records", disabled: true },
  { id: "hooks", label: "Configure webhooks" },
  { id: "billing", label: "Manage billing" },
  { id: "invite", label: "Invite teammates" },
];

const meta = {
  title: "Inputs/Transfer",
  component: Transfer,
  parameters: { layout: "padded" },
  args: { items: RIGHTS, value: [], onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Transfer {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof Transfer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A live transfer. "Delete records" is disabled: it is shown but cannot be moved.
 * Hiding it would misstate the set of rights, and moving it would bypass the restriction.
 */
export const Playground: Story = {
  args: { value: ["reports"] },
};

/**
 * Search in each column. The field name is parameterized by the column label: there are
 * two fields, and a shared "Search" label would not tell them apart.
 */
export const Searchable: Story = {
  args: { value: ["reports", "billing"], searchable: true },
};

/**
 * Custom column labels. The domain stays with the consumer: the kit does not know
 * what is being split between the columns.
 */
export const CustomLabels: Story = {
  args: {
    value: ["export"],
    sourceLabel: "All permissions",
    targetLabel: "Granted to the role",
  },
};

/** An empty target column says "empty" instead of showing a bare frame. */
export const Empty: Story = {
  args: { value: [] },
};
