import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelpTooltip } from "./HelpTooltip.js";

const meta = {
  title: "Overlays/HelpTooltip",
  component: HelpTooltip,
  parameters: { layout: "centered" },
  args: {
    label: "What the dashboard shows",
    title: "Dashboard overview",
    children: (
      <p className="text-fg-2 m-0 text-[13px] leading-relaxed">
        The cards at the top show the state of the library and the schedule over the last day. The
        numbers refresh once a minute.
      </p>
    ),
  },
} satisfies Meta<typeof HelpTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger at rest. It expands on click; the popover lives in a portal. */
export const Playground: Story = {};

/**
 * With a hint about a keyboard shortcut. The combination arrives as one whole string: the modifier
 * depends on the platform, and the consumer knows about it, not the package.
 */
export const WithShortcut: Story = {
  args: {
    shortcut: "⌘+Shift+D",
    shortcutLabel: "Open the section",
  },
};

/** A narrow hint without a title: just text. */
export const WithoutTitle: Story = {
  args: {
    title: undefined,
    widthClassName: "w-[240px]",
    children: <p className="text-fg-2 m-0 text-[13px]">Only unpublished photos are shown.</p>,
  },
};
