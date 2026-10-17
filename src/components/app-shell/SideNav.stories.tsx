import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  BellIcon,
  DashboardIcon,
  FolderIcon,
  SettingsIcon,
  UploadIcon,
} from "../../icons.js";
import { Avatar } from "../content/Avatar.js";
import { Badge } from "../content/Badge.js";
import { NavItem } from "./NavItem.js";
import { NavGroup, SideNav, useNavCollapsed } from "./SideNav.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "App shell/SideNav",
  component: SideNav,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      // The tooltip provider is needed by the collapsed mode. It is a requirement
      // on the consumer, not on the showcase.
      <TooltipProvider delayDuration={0}>
        <div className="bg-bg-0 flex h-[520px]">
          <Story />
          <div className="text-fg-3 flex-1 p-6 text-sm">Page content</div>
        </div>
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const BrandSlot = () => (
  <div className="flex items-center gap-2.5 px-[18px] pt-[22px] pb-[14px]">
    <div className="bg-accent-strong size-[34px] shrink-0 rounded-[10px]" />
    <span className="truncate text-sm font-bold tracking-tight">Olddevs</span>
  </div>
);

// In icon-only mode the column has room only for the avatar. A name and a role left
// as they are would wrap word by word and spill past the edge. The name leaves the
// screen but not the accessible text, the same as an item's label.
const UserSlot = () =>
  useNavCollapsed() ? (
    <div className="mb-2 flex justify-center">
      <Avatar name="AL" />
      <span className="sr-only">Ada Lovelace</span>
    </div>
  ) : (
    <div className="bg-bg-2 mb-2 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2">
      <Avatar name="AL" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">Ada Lovelace</div>
        <div className="text-fg-3 truncate text-[11px]">Full access</div>
      </div>
    </div>
  );

const NavSections = (
  <>
    <NavGroup label="Work">
      <NavItem label="Dashboard" href="#dashboard" icon={<DashboardIcon size={20} />} active />
      <NavItem label="Documents" href="#docs" icon={<FolderIcon size={20} />} />
      <NavItem label="Uploads" href="#upload" icon={<UploadIcon size={20} />} />
    </NavGroup>
    <NavGroup label="Other">
      <NavItem
        label="Activity"
        href="#events"
        icon={<BellIcon size={20} />}
        badge={<Badge tone="danger">7</Badge>}
      />
      <NavItem label="Archive" href="#archive" icon={<ArchiveIcon size={20} />} />
      <NavItem label="Settings" href="#settings" icon={<SettingsIcon size={20} />} />
    </NavGroup>
  </>
);

/**
 * Uncontrolled mode: the component keeps the collapsed state itself, and the button in the
 * footer toggles it. Persistence stays with the consumer. The kit knows nothing about the
 * app's storage or about `localStorage` (ADR-0018).
 */
export const Playground: Story = {
  args: { header: <BrandSlot />, footer: <UserSlot />, children: NavSections },
};

/**
 * Icon-only mode. The labels leave the screen but remain accessible names, and section
 * headings are replaced by a divider. Without the divider the navigation loses its structure
 * entirely, and with a label it does not fit the width.
 */
export const Collapsed: Story = {
  args: {
    defaultCollapsed: true,
    header: <BrandSlot />,
    footer: <UserSlot />,
    children: NavSections,
  },
};

/** No slots and no button: the minimum that makes any sense at all. */
export const Bare: Story = {
  args: { collapsible: false, children: NavSections },
};
