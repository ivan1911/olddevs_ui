import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { Dialog } from "./Dialog.js";
import { FormField } from "../inputs/FormField.js";
import { Select } from "../inputs/Select.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Overlays/Dialog",
  component: Dialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    title: "New album",
    className: "w-full max-w-[420px]",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A regular window with a form and a footer: the label on the left, the actions on the right. */
export const Playground: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Dialog {...args}>
        <div className="flex flex-col gap-3 px-5 py-4">
          <FormField label="Name" htmlFor="dlg-name">
            <TextControl id="dlg-name" placeholder="Sunsets" />
          </FormField>
          <FormField label="Description" htmlFor="dlg-desc" hint="Shown in the album header">
            <TextControl id="dlg-desc" as="textarea" rows={3} />
          </FormField>
        </div>
        <div className="border-line-soft flex items-center justify-end gap-2.5 border-t px-5 py-4">
          <Button variant="ghost">Cancel</Button>
          <Button variant="solid" tone="accent">
            Create
          </Button>
        </div>
      </Dialog>
    </div>
  ),
};

/** With an icon, a subtitle below the title, and alignment to the top edge. */
export const WithIcon: Story = {
  args: {
    subtitle: "12 photos · updated yesterday",
    icon: <span aria-hidden>🌄</span>,
    align: "start",
  },
  render: (args) => (
    <div className="h-[420px]">
      <Dialog {...args}>
        <p className="text-fg-1 m-0 px-5 py-4 text-[13px]">
          The subtitle is its own prop, not part of `title`: the title accepts phrasing content
          only.
        </p>
      </Dialog>
    </div>
  ),
};

/**
 * Submission in progress. The close button is removed, and Escape and a click outside do not close
 * the dialog: one `loading` state, not three separate bans.
 */
export const Submitting: Story = {
  args: { loading: true },
  render: (args) => (
    <div className="h-[420px]">
      <Dialog {...args}>
        <p className="text-fg-1 m-0 px-5 py-4 text-[13px]">
          While the action runs there is nothing to close the window with — otherwise the form would
          go nowhere.
        </p>
      </Dialog>
    </div>
  ),
};

/**
 * Nesting is the reason the primitive was created.
 *
 * The confirmation dialog opens ON TOP of the window, and Escape closes the top layer, not both at
 * once. Check it by hand: open the confirmation, press Escape, and the outer window must stay open.
 * Tab must not move to the background on any layer.
 */
export const Nested: Story = {
  render: (args) => {
    const [confirm, setConfirm] = useState(false);
    return (
      <div className="h-[420px]">
        <Dialog {...args} title="The “Sunsets” album">
          <div className="px-5 py-4">
            <p className="text-fg-1 m-0 mb-4 text-[13px]">
              Press “Delete” — the confirmation opens on top of this window.
            </p>
            <Button variant="outline" tone="danger" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          </div>
        </Dialog>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
          title="Delete the album?"
          message="The photos stay in the library — only the album itself is deleted."
          confirmLabel="Delete"
        />
      </div>
    );
  },
};

/**
 * A list that opens INSIDE the window, with a long page behind it.
 *
 * The story is for the scroll lock, not the look: the `Select` panel is portaled into `body`, so it
 * sits outside the scrim where Radix's scroll lock lives. The wheel over it must scroll the list while
 * there is room, and stop when it reaches the end, instead of passing through the window onto the page
 * behind it.
 *
 * The page is deliberately tall: without it, a scroll leak would go unnoticed.
 */
export const SelectInside: Story = {
  render: (args) => {
    const items = Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      label: `Section ${i + 1}`,
    }));
    return (
      <div className="h-[2400px] p-6">
        <p className="text-fg-2 text-[13px]">A long page behind the window.</p>
        <Dialog {...args} title="Task details">
          <div className="flex flex-col gap-3 px-5 py-4">
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
          </div>
        </Dialog>
      </div>
    );
  },
};
