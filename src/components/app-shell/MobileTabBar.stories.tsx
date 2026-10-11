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
  { id: "home", label: "Dashboard", icon: <DashboardIcon /> },
  { id: "docs", label: "Documents", icon: <FolderIcon /> },
  { id: "upload", label: "Uploads", icon: <UploadIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
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
      <MobileTabBarItem label="Dashboard" icon={<DashboardIcon />} href="#home" active />
      <MobileTabBarItem label="Activity" icon={<BellIcon />} href="#activity" badge={7} />
      <MobileTabBarItem label="Documents" icon={<FolderIcon />} href="#docs" badge />
      <MobileTabBarItem
        label="Uploads"
        icon={<UploadIcon />}
        href="#upload"
        badge={240}
        badgeLabel="240 files waiting"
      />
      <MobileTabBarItem label="Reports" icon={<FolderIcon />} href="#reports" badge="Beta" />
      <MobileTabBarItem
        label="Billing"
        icon={<DashboardIcon />}
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
      <MobileTabBarItem label="Dashboard" icon={<DashboardIcon />} href="#home" active />
      <MobileTabBarItem label="Documents" icon={<FolderIcon />} href="#docs" />
      <MobileTabBarItem
        label="Scheduled uploads and reminders"
        icon={<UploadIcon />}
        href="#upload"
      />
      <MobileTabBarItem label="Notifications" icon={<BellIcon />} href="#activity" badge={3} />
      <MobileTabBarItem label="Preferences" icon={<SettingsIcon />} href="#settings" />
    </MobileTabBar>
  ),
};
