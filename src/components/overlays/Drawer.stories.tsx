import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Drawer, type DrawerProps } from "./Drawer.js";
import { FormField } from "../inputs/FormField.js";
import { Select } from "../inputs/Select.js";
import { Text } from "../content/Text.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Overlays/Drawer",
  component: Drawer,
  parameters: { layout: "centered" },
  tags: ["periphery"],
} satisfies Meta<DrawerProps>;

export default meta;
type Story = StoryObj<DrawerProps>;

function Demo(args: Partial<DrawerProps>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="solid" tone="accent" onClick={() => setOpen(true)}>
        Open the drawer
      </Button>
      <Drawer
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        title={args.title ?? "Editing a photo"}
        subtitle="Changes apply immediately"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="solid" tone="accent" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Name" htmlFor="dw-name">
            <TextControl id="dw-name" defaultValue="Night city" shellClassName="w-full" />
          </FormField>
          <FormField label="Description" htmlFor="dw-desc">
            <TextControl id="dw-desc" as="textarea" rows={4} shellClassName="w-full" />
          </FormField>
          <Text size="sm" level={3}>
            On a narrow screen the side drawer slides in from the bottom.
          </Text>
        </div>
      </Drawer>
    </>
  );
}

export const FromRight: Story = { render: (args) => <Demo {...args} /> };
export const FromLeft: Story = { render: (args) => <Demo {...args} side="left" /> };
export const FromBottom: Story = { render: (args) => <Demo {...args} side="bottom" size="sm" /> };

/**
 * A drawer over a foreign overlay.
 *
 * An application with its own layers keeps its windows above the kit's default, and the drawer
 * must be able to sit above them. The layer is raised with ONE prop, because the scrim and the
 * panel must move together: raise only the panel, and the dimming stays under the foreign window
 * while the drawer hangs above it without its own background.
 */
export const OverForeignOverlay: Story = {
  render: (args) => (
    <>
      <div
        className="bg-bg-2 border-line fixed inset-x-20 inset-y-16 z-95 flex items-start justify-center rounded-2xl border pt-6"
        aria-hidden
      >
        <Text level={3}>A foreign application overlay, layer z-95</Text>
      </div>
      <div className="relative z-100">
        <Demo {...args} zIndex="z-100" />
      </div>
    </>
  ),
};

/**
 * A list that opens INSIDE the drawer: the `Select` panel is taller than the drawer.
 *
 * The story is for the scroll lock, not the look. The panel is portaled into `body`, so it sits
 * outside the scrim where Radix's scroll lock lives, and it gets into that lock's subtree only
 * through the React tree. That is why the drawer's panel was moved INSIDE the scrim. The wheel over
 * the list must scroll it while there is room, and stop when it reaches the end.
 *
 * The drawer is open from the start: the wheel test begins with an open panel, not with a button.
 */
export const SelectInside: Story = {
  render: (args) => {
    const items = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, label: `Section ${i + 1}` }));
    return (
      <div className="h-[2400px] p-6">
        <Text size="sm" level={3}>
          A long page behind the drawer.
        </Text>
        <Drawer {...args} open onClose={() => {}} title="Task details">
          <FormField label="Section">
            <Select
              items={items}
              value={null}
              onChange={() => {}}
              placeholder="Pick a section"
              aria-label="Section"
              highlightSelected={false}
              triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
            />
          </FormField>
        </Drawer>
      </div>
    );
  },
};
