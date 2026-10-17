import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TablePreferences } from "./TablePreferences.js";
import { TableToolbar } from "./TableToolbar.js";
import type { Density } from "../../lib/variants.js";

const meta = {
  title: "Table/TableToolbar",
  component: TableToolbar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TableToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { id: "name", label: "Name", required: true },
  { id: "section", label: "Section" },
  { id: "updated", label: "Updated" },
];

/** A title, a count, and actions. The count is declined by the message catalog per locale. */
export const Playground: Story = {
  args: {
    title: "Documents",
    count: 12,
    actions: (
      <Button size="sm" tone="accent">
        Upload
      </Button>
    ),
  },
};

/** Only the count: the bar needs neither a title nor actions. */
export const CountOnly: Story = { args: { count: 0 } };

/**
 * A gear with settings. `TablePreferences` is a panel, not a menu: a menu item is not a container
 * for buttons, and buttons nested in it would break the keyboard semantics of the menu. The consumer
 * picks the wrapper; here it is a `Popover`.
 */
export const WithPreferences: Story = {
  args: { title: "Documents", count: 12 },
  render: function PreferencesSlot(args) {
    const [hidden, setHidden] = useState<Set<string>>(new Set(["updated"]));
    const [order, setOrder] = useState<string[]>(["name", "section", "updated"]);
    const [density, setDensity] = useState<Density>("comfortable");

    return (
      <TableToolbar
        {...args}
        preferences={
          <Popover>
            {/* `asChild` is required: without it, Radix draws its own button
                around ours, and you get a button inside a button. */}
            <PopoverTrigger asChild>
              <Button variant="ghost" iconOnly icon={<SettingsIcon />} aria-label="Settings" />
            </PopoverTrigger>
            <PopoverContent className="p-3">
              <TablePreferences
                columns={COLUMNS}
                hiddenColumns={hidden}
                onHiddenColumnsChange={setHidden}
                columnOrder={order}
                onColumnOrderChange={setOrder}
                density={density}
                onDensityChange={setDensity}
              />
            </PopoverContent>
          </Popover>
        }
      />
    );
  },
};
