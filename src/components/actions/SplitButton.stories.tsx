import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon } from "../../icons.js";
import { MenuItem, MenuSeparator } from "../overlays/Menu.js";
import { SplitButton } from "./SplitButton.js";

const meta = {
  title: "Actions/SplitButton",
  component: SplitButton,
  parameters: { layout: "centered" },
  args: {
    label: "Export",
    onClick: () => {},
    children: [
      <MenuItem key="xlsx">Export to XLSX</MenuItem>,
      <MenuItem key="json">Export to JSON</MenuItem>,
      <MenuSeparator key="sep" />,
      <MenuItem key="selected">Selected rows only</MenuItem>,
    ],
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The primary action is on the left, and its relatives are in the menu on the right. The
 * arrow opens the menu and does not trigger the action; clicking the label triggers the
 * action and does not open the menu.
 */
export const Playground: Story = {
  args: { variant: "solid", tone: "accent", icon: <DownloadIcon aria-hidden /> },
};

/**
 * The `variant` and `tone` axes are the same as in `Button` and mean the same thing. The
 * component has no palette of its own, so there is nothing for it to drift apart from the button.
 */
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} variant="solid" tone="accent" />
      <SplitButton {...args} variant="outline" label="Create" />
      <SplitButton {...args} variant="soft" label="Publish" />
      <SplitButton {...args} variant="solid" tone="danger" label="Delete" />
    </div>
  ),
};

/**
 * Three sizes. The arrow is a square of the same height as the primary action.
 *
 * The labels differ on purpose. The point of the component is that its disclosure
 * triggers are distinguishable by speech, and a showcase of three identical
 * "More actions: Export" labels would show the opposite.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} size="sm" label="Export" />
      <SplitButton {...args} size="md" label="Create" />
      <SplitButton {...args} size="lg" label="Publish" />
    </div>
  ),
};

/**
 * Both buttons are disabled together. There is no separate disabled state, on purpose.
 *
 * A live arrow on a dead action offers options for things that can't be done. `loading`
 * disables it for the same reason: an open menu in the middle of a submission offers a
 * second way to do what is already being done.
 */
export const DisabledAndLoading: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} variant="solid" tone="accent" disabled />
      {/*
        The icon is required here: on a button without one, the submitting spinner
        takes a slot and the label shifts. The showcase must not lock this shift in
        as the canonical snapshot. The warning about it is in the `Button` doc comment.
      */}
      <SplitButton
        {...args}
        variant="solid"
        tone="accent"
        loading
        label="Exporting"
        icon={<DownloadIcon aria-hidden />}
      />
    </div>
  ),
};
