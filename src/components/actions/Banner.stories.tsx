import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Tone } from "../../lib/variants.js";
import { Banner, type BannerProps } from "./Banner.js";
import { Button } from "./Button.js";

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

const meta = {
  title: "Actions/Banner",
  component: Banner,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Maintenance in progress",
    children: "Publishing is paused until 14:00. Drafts are kept.",
  },
} satisfies Meta<BannerProps>;

export default meta;
type Story = StoryObj<BannerProps>;

export const Playground: Story = {};

/** Тона: тот же словарь, что у `Alert` и `StatusBadge`. */
export const Matrix: Story = {
  render: (args) => (
    <div className="flex flex-col">
      {TONES.map((tone) => (
        <Banner key={tone} {...args} tone={tone} title={tone} />
      ))}
    </div>
  ),
};

/** С действием и закрытием. Без обработчика крестика нет вовсе. */
export const WithAction: Story = {
  args: {
    tone: "warning",
    title: "Subscription is expiring",
    children: "Publishing stops in three days.",
    action: (
      <Button size="sm" variant="outline">
        Renew
      </Button>
    ),
    onDismiss: () => {},
  },
};

/**
 * Стопка — обычный список соседних баннеров: каждый закрывается своей кнопкой,
 * порядок задаёт потребитель. Своей очереди у компонента нет.
 *
 * Шапка под баннерами остаётся липкой на `top: 0` — контракт `--topbar-h` не
 * трогается (ADR-0027).
 */
export const Stack: Story = {
  render: () => (
    <div>
      <div className="flex flex-col">
        <Banner tone="danger" title="Service unavailable" onDismiss={() => {}}>
          Publishing is down. We are on it.
        </Banner>
        <Banner tone="accent" title="New version" onDismiss={() => {}}>
          Reload the tab to pick up the changes.
        </Banner>
      </div>
      <div className="border-line-soft bg-bg-1 text-fg-2 flex h-14 items-center border-b px-4 text-[13px] font-semibold">
        Application header
      </div>
      <div className="text-fg-2 p-4 text-[13px]">Page content</div>
    </div>
  ),
};
