import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArchiveIcon, BellIcon, DashboardIcon, FolderIcon, UploadIcon } from "../../icons.js";
import { Badge } from "../content/Badge.js";
import { Kbd } from "../content/Kbd.js";
import { NavCollapsedProvider, NavItem } from "./NavItem.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "App shell/NavItem",
  component: NavItem,
  parameters: { layout: "padded" },
  args: { label: "Dashboard", href: "#", icon: <DashboardIcon size={20} /> },
  decorators: [
    // The meta decorators also wrap the story decorator, so the story sets the frame
    // width with the `frameWidth` parameter rather than with a second frame inside.
    (Story, { parameters }) => (
      <div
        className="border-line-soft bg-bg-1 rounded-lg border p-2.5"
        style={{ width: parameters.frameWidth ?? "var(--sidenav-w)" }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single item with live controls. Tweak the props. */
export const Playground: Story = {
  args: { active: false },
};

/**
 * States in a row. This is the point of the showcase: a single instance won't show that the
 * active item differs from its neighbor not only by color but also by a framed background.
 * That is exactly what breaks when the tokens are edited.
 */
export const States: Story = {
  render: (args) => (
    <nav className="flex flex-col gap-0.5">
      <NavItem {...args} label="Dashboard" icon={<DashboardIcon size={20} />} active />
      <NavItem {...args} label="Sections" icon={<FolderIcon size={20} />} />
      <NavItem
        {...args}
        label="Activity"
        icon={<BellIcon size={20} />}
        badge={<Badge tone="danger">7</Badge>}
      />
      <NavItem {...args} label="Uploads" icon={<UploadIcon size={20} />} shortcut={<Kbd>⌘U</Kbd>} />
      <NavItem {...args} label="Archive" icon={<ArchiveIcon size={20} />} aria-disabled="true" />
    </nav>
  ),
};

/**
 * Icon-only mode. The label is hidden from sight but remains the accessible name, so the
 * navigation does not turn into a set of unnamed icons. A test checks this; the story
 * shows what it looks like.
 *
 * `TooltipProvider` is required here: a collapsed item expands a tooltip, and without a
 * provider Radix throws. This is a requirement on the consumer, not on the showcase.
 */
export const Collapsed: Story = {
  parameters: { frameWidth: "var(--sidenav-w-collapsed)" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: (args) => (
    <NavCollapsedProvider value={true}>
      <nav className="flex flex-col gap-0.5">
        <NavItem {...args} label="Dashboard" icon={<DashboardIcon size={20} />} active />
        <NavItem {...args} label="Sections" icon={<FolderIcon size={20} />} />
        <NavItem {...args} label="Uploads" icon={<UploadIcon size={20} />} />
      </nav>
    </NavCollapsedProvider>
  ),
};

/**
 * The kit's look applied to the consumer's element. Here it is a plain link; in the app it
 * is `next/link` or the router's `<Link>`. The kit knows nothing about the router, and the
 * active state comes in as a prop (ADR-0018).
 */
export const AsChild: Story = {
  render: (args) => (
    <nav className="flex flex-col gap-0.5">
      <NavItem {...args} label="Documents" icon={<FolderIcon size={20} />} active asChild>
        <a href="#docs" />
      </NavItem>
      <NavItem {...args} label="Archive" icon={<ArchiveIcon size={20} />} asChild>
        <a href="#archive" />
      </NavItem>
    </nav>
  ),
};
