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
import { NavGroup, SideNav } from "./SideNav.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "App shell/SideNav",
  component: SideNav,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      // Провайдер подсказок нужен схлопнутому режиму — требование к
      // потребителю, а не к витрине.
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

const UserSlot = () => (
  <div className="bg-bg-2 mb-2 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2">
    <Avatar name="AL" />
    <div className="min-w-0 flex-1">
      <div className="truncate text-xs font-semibold">Ada Lovelace</div>
      <div className="text-fg-3 text-[11px]">Full access</div>
    </div>
  </div>
);

const NavSections = (
  <>
    <NavGroup label="Work">
      <NavItem label="Dashboard" href="#dashboard" icon={<DashboardIcon />} active />
      <NavItem label="Documents" href="#docs" icon={<FolderIcon />} />
      <NavItem label="Uploads" href="#upload" icon={<UploadIcon />} />
    </NavGroup>
    <NavGroup label="Other">
      <NavItem
        label="Activity"
        href="#events"
        icon={<BellIcon />}
        badge={<Badge tone="danger">7</Badge>}
      />
      <NavItem label="Archive" href="#archive" icon={<ArchiveIcon />} />
      <NavItem label="Settings" href="#settings" icon={<SettingsIcon />} />
    </NavGroup>
  </>
);

/**
 * Неуправляемый режим: схлопнутость держит сам компонент, кнопка в подвале
 * переключает её. Персистентность при этом остаётся у потребителя — кит не
 * знает ни про хранилище приложения, ни про `localStorage` (ADR-0018).
 */
export const Playground: Story = {
  args: { header: <BrandSlot />, footer: <UserSlot />, children: NavSections },
};

/**
 * Иконочный режим. Подписи уходят с экрана, но остаются доступными именами, а
 * заголовки разделов заменяются чертой: без неё навигация теряет структуру
 * целиком, а с подписью — не помещается в ширину.
 */
export const Collapsed: Story = {
  args: {
    defaultCollapsed: true,
    header: <BrandSlot />,
    footer: <UserSlot />,
    children: NavSections,
  },
};

/** Без слотов и без кнопки — минимум, который вообще имеет смысл. */
export const Bare: Story = {
  args: { collapsible: false, children: NavSections },
};
