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
  args: { label: "Dashboard", href: "#", icon: <DashboardIcon /> },
  decorators: [
    // Декораторы meta оборачивают и декоратор истории, поэтому ширину рамки история
    // задаёт параметром `frameWidth`, а не второй рамкой внутри.
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

/** Один пункт с живыми контролами — покрутить пропсы. */
export const Playground: Story = {
  args: { active: false },
};

/**
 * Состояния подряд. Смысл витрины в них: одиночный экземпляр не покажет, что
 * активный пункт отличается от соседа не только цветом, но и рамкой с фоном, —
 * а это и есть то, что ломается при правке токенов.
 */
export const States: Story = {
  render: (args) => (
    <nav className="flex flex-col gap-0.5">
      <NavItem {...args} label="Dashboard" icon={<DashboardIcon />} active />
      <NavItem {...args} label="Sections" icon={<FolderIcon />} />
      <NavItem
        {...args}
        label="Activity"
        icon={<BellIcon />}
        badge={<Badge tone="danger">7</Badge>}
      />
      <NavItem {...args} label="Uploads" icon={<UploadIcon />} shortcut={<Kbd>⌘U</Kbd>} />
      <NavItem {...args} label="Archive" icon={<ArchiveIcon />} aria-disabled="true" />
    </nav>
  ),
};

/**
 * Иконочный режим. Подпись прячется от глаз, но остаётся доступным именем — то
 * есть навигация не превращается в набор безымянных иконок; проверяется это
 * тестом, а история показывает, как это выглядит.
 *
 * `TooltipProvider` здесь обязателен: схлопнутый пункт разворачивает подсказку,
 * и без провайдера Radix бросает. Требование к потребителю, а не к витрине.
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
        <NavItem {...args} label="Dashboard" icon={<DashboardIcon />} active />
        <NavItem {...args} label="Sections" icon={<FolderIcon />} />
        <NavItem {...args} label="Uploads" icon={<UploadIcon />} />
      </nav>
    </NavCollapsedProvider>
  ),
};

/**
 * Вид кита на элементе потребителя. Здесь это обычная ссылка, в приложении —
 * `next/link` или `<Link>` роутера: кит о маршрутизаторе не знает вовсе, а
 * активность приходит пропом (ADR-0018).
 */
export const AsChild: Story = {
  render: (args) => (
    <nav className="flex flex-col gap-0.5">
      <NavItem {...args} label="Documents" icon={<FolderIcon />} active asChild>
        <a href="#docs" />
      </NavItem>
      <NavItem {...args} label="Archive" icon={<ArchiveIcon />} asChild>
        <a href="#archive" />
      </NavItem>
    </nav>
  ),
};
