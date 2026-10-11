import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BellIcon, CheckIcon, ErrorIcon, InfoIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Chip } from "../actions/Chip.js";
import { EmptyState } from "./EmptyState.js";
import { Image } from "./Image.js";
import { NotificationCenter, type NotificationCenterProps } from "./NotificationCenter.js";
import { NotificationItem, NotificationList } from "./NotificationList.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";

const meta = {
  title: "Content/NotificationCenter",
  component: NotificationCenter,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<NotificationCenterProps>;

export default meta;
type Story = StoryObj<NotificationCenterProps>;

const PREVIEW =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8be6"/><stop offset="1" stop-color="#9a7cf6"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/></svg>`
  );

const EVENTS = (
  <NotificationList
    groups={[
      {
        id: "today",
        label: "Today",
        children: (
          <>
            <NotificationItem
              title="Publishing failed"
              description="The channel is disconnected from the account."
              time="5 minutes ago"
              icon={<ErrorIcon size={16} />}
              tone="danger"
              unread
            />
            <NotificationItem
              title="Moderation finished"
              time="an hour ago"
              icon={<InfoIcon size={16} />}
              unread
            />
          </>
        ),
      },
      {
        id: "older",
        label: "Earlier",
        children: (
          <NotificationItem
            title="The report is ready"
            time="12 March"
            icon={<BellIcon size={16} />}
          />
        ),
      },
    ]}
  />
);

export const Playground: Story = {
  render: () => (
    <div className="border-line-soft bg-bg-1 h-[420px] w-[420px] rounded-lg border">
      <NotificationCenter
        unreadCount={12}
        filters={
          <>
            <Chip selected size="sm">
              All
            </Chip>
            <Chip size="sm">Unread</Chip>
            <Chip size="sm">Errors</Chip>
          </>
        }
        actions={
          <Button size="sm" variant="ghost" icon={<CheckIcon />}>
            Mark all read
          </Button>
        }
        footer={
          <a href="#all" className="text-accent-strong text-xs font-semibold">
            Show all events
          </a>
        }
      >
        {EVENTS}
      </NotificationCenter>
    </div>
  ),
};

/** Массовые действия — существующий `SelectionBar`, а не своя полоса. */
export const WithHighlight: Story = {
  render: function Render() {
    const [count, setCount] = useState(3);
    return (
      <div className="border-line-soft bg-bg-1 h-[420px] w-[420px] rounded-lg border">
        <NotificationCenter
          unreadCount={12}
          selectedCount={count}
          onClearSelection={() => setCount(0)}
          selectionActions={
            <Button size="sm" icon={<CheckIcon />}>
              Mark as read
            </Button>
          }
        >
          {EVENTS}
        </NotificationCenter>
      </div>
    );
  },
};

/**
 * Поверхности у центра нет: он содержимое. Здесь — существующий `Popover`;
 * с тем же успехом это `Drawer` или страница.
 *
 * Имя поповера приходит от заголовка центра: `titleId` ложится на настоящий
 * `<h2>` (`level`), а `aria-labelledby` поповера ссылается на него.
 */
export const InPopover: Story = {
  render: function Render() {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" icon={<BellIcon />}>
            Notifications
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" aria-labelledby="bell-popover-title">
          <div className="h-[360px] w-[380px]">
            <NotificationCenter unreadCount={12} level={2} titleId="bell-popover-title">
              {EVENTS}
            </NotificationCenter>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
};

/** Строки с превью и строки-кнопки в центре; заголовок — `<h3>`. */
export const WithPreviewRows: Story = {
  render: function Render() {
    const [unread, setUnread] = useState([true, true, false]);
    return (
      <div className="border-line-soft bg-bg-1 h-[420px] w-[420px] rounded-lg border">
        <NotificationCenter unreadCount={unread.filter(Boolean).length} level={3}>
          <NotificationList>
            {["Sunset over the city", "Morning fog", "Night market"].map((name, index) => (
              <NotificationItem
                key={name}
                title={`Moderation finished: ${name}`}
                time={`${index + 1} h ago`}
                icon={<InfoIcon size={16} />}
                media={
                  <Image
                    src={PREVIEW}
                    alt=""
                    className="border-line-soft size-9 rounded-md border"
                  />
                }
                unread={unread[index]}
                onAction={() => setUnread((prev) => prev.map((v, i) => (i === index ? false : v)))}
              />
            ))}
          </NotificationList>
        </NotificationCenter>
      </div>
    );
  },
};

/** Пустое состояние приходит списку, а не центру: центр остаётся оболочкой. */
export const Empty: Story = {
  render: () => (
    <div className="border-line-soft bg-bg-1 h-[320px] w-[420px] rounded-lg border">
      <NotificationCenter>
        <NotificationList
          groups={[]}
          empty={
            <div className="p-4">
              <EmptyState title="Quiet for now" description="New events will show up here." />
            </div>
          }
        />
      </NotificationCenter>
    </div>
  ),
};
