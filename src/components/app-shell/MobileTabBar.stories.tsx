import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BellIcon, DashboardIcon, FolderIcon, SettingsIcon, UploadIcon } from "../../icons.js";
import { Badge } from "../content/Badge.js";
import { MobileTabBar, MobileTabBarItem } from "./MobileTabBar.js";

const meta = {
  title: "App shell/MobileTabBar",
  component: MobileTabBar,
  parameters: { layout: "padded" },
  args: { children: null },
  decorators: [
    (Story) => (
      // Узкая рамка вместо вьюпорта: полоса считает ширину колонки, а не окна.
      <div className="border-line-soft w-[375px] max-w-full overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const SECTIONS = [
  { id: "home", label: "Dashboard", icon: <DashboardIcon size={20} /> },
  { id: "docs", label: "Documents", icon: <FolderIcon size={20} /> },
  { id: "upload", label: "Uploads", icon: <UploadIcon size={20} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={20} /> },
];

/** Полоса с переключаемым текущим разделом — нажмите на пункт. */
export const Playground: Story = {
  render: () => {
    const [route, setRoute] = useState("home");
    return (
      <MobileTabBar>
        {SECTIONS.map((item) => (
          <MobileTabBarItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={route === item.id}
            href={`#${item.id}`}
            onClick={() => setRoute(item.id)}
          />
        ))}
      </MobileTabBar>
    );
  },
};

/**
 * Счётчик, точка «есть новое», строка и свой элемент. Значок лежит поверх
 * иконки, а для скринридера у него есть текст — «3 new», «New», сама строка,
 * либо свой через `badgeLabel` (у своего элемента он обязателен).
 */
export const Badges: Story = {
  render: () => (
    <MobileTabBar>
      <MobileTabBarItem label="Dashboard" icon={<DashboardIcon size={20} />} href="#home" active />
      <MobileTabBarItem label="Activity" icon={<BellIcon size={20} />} href="#activity" badge={7} />
      <MobileTabBarItem label="Documents" icon={<FolderIcon size={20} />} href="#docs" badge />
      <MobileTabBarItem
        label="Uploads"
        icon={<UploadIcon size={20} />}
        href="#upload"
        badge={240}
        badgeLabel="240 files waiting"
      />
      <MobileTabBarItem
        label="Reports"
        icon={<FolderIcon size={20} />}
        href="#reports"
        badge="Beta"
      />
      <MobileTabBarItem
        label="Billing"
        icon={<DashboardIcon size={20} />}
        href="#billing"
        badge={<Badge tone="warning" dot />}
        badgeLabel="Payment overdue"
      />
    </MobileTabBar>
  ),
};

/**
 * Пункт без иконки: значку не за что зацепиться, он встаёт в строку подписи,
 * после неё. Подпись обрезается раньше значка.
 */
export const BadgesWithoutIcon: Story = {
  render: () => (
    <MobileTabBar>
      <MobileTabBarItem label="Inbox" href="#inbox" active badge={12} />
      <MobileTabBarItem label="Drafts" href="#drafts" badge />
      <MobileTabBarItem label="Reports" href="#reports" badge="Beta" />
      <MobileTabBarItem
        label="Billing"
        href="#billing"
        badge={<Badge tone="warning" dot />}
        badgeLabel="Payment overdue"
      />
      <MobileTabBarItem label="Scheduled uploads and reminders" href="#upload" badge="Beta" />
    </MobileTabBar>
  ),
};

/**
 * Длинная подпись обрезается многоточием и не ломает полосу; полная подпись
 * остаётся доступным именем. Пять пунктов на 375px — предел, при котором
 * подписи на 11px начинают обрезаться (известный компромисс, см. справочник).
 */
export const LongLabels: Story = {
  render: () => (
    <MobileTabBar data-testid="long-labels">
      <MobileTabBarItem label="Dashboard" icon={<DashboardIcon size={20} />} href="#home" active />
      <MobileTabBarItem label="Documents" icon={<FolderIcon size={20} />} href="#docs" />
      <MobileTabBarItem
        label="Scheduled uploads and reminders"
        icon={<UploadIcon size={20} />}
        href="#upload"
      />
      <MobileTabBarItem
        label="Notifications"
        icon={<BellIcon size={20} />}
        href="#activity"
        badge={3}
      />
      <MobileTabBarItem label="Preferences" icon={<SettingsIcon size={20} />} href="#settings" />
    </MobileTabBar>
  ),
};
