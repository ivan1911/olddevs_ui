import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BellIcon, CheckIcon, ErrorIcon, InfoIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { EmptyState } from "./EmptyState.js";
import { Image } from "./Image.js";
import {
  NotificationItem,
  NotificationList,
  type NotificationListProps,
} from "./NotificationList.js";

const meta = {
  title: "Content/NotificationList",
  component: NotificationList,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<NotificationListProps>;

export default meta;
type Story = StoryObj<NotificationListProps>;

/** Pictures in the stories are data URIs, not network requests: a snapshot must not depend on someone else's host. */
const PREVIEW =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8be6"/><stop offset="1" stop-color="#9a7cf6"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/></svg>`
  );

const preview = (
  <Image src={PREVIEW} alt="" className="border-line-soft size-9 rounded-md border" />
);

const markRead = (
  <Button size="sm" variant="ghost" iconOnly icon={<CheckIcon />} aria-label="Read" />
);

export const Playground: Story = {
  render: () => (
    <div className="border-line-soft w-[420px] rounded-lg border">
      <NotificationList>
        <NotificationItem
          title="Publishing failed"
          description="The channel is disconnected from the account."
          time="5 minutes ago"
          icon={<ErrorIcon size={16} />}
          tone="danger"
          unread
          actions={markRead}
        />
        <NotificationItem
          title="Moderation finished"
          description="12 of 14 items approved."
          time="an hour ago"
          icon={<InfoIcon size={16} />}
          unread
          actions={markRead}
        />
        <NotificationItem
          title="The report is ready"
          time="yesterday"
          icon={<BellIcon size={16} />}
          tone="neutral"
        />
      </NotificationList>
    </div>
  ),
};

/**
 * Groups come ready-made: what "yesterday" means is known to the consumer's locale
 * and time zone, not to the kit.
 */
export const WithGroups: Story = {
  render: () => (
    <div className="border-line-soft w-[420px] rounded-lg border">
      <NotificationList
        groups={[
          {
            id: "today",
            label: "Today",
            children: (
              <>
                <NotificationItem
                  title="Publishing failed"
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
                tone="neutral"
              />
            ),
          },
        ]}
      />
    </div>
  ),
};

/** The empty state comes in as a prop: "no events" and "nothing found" have different text. */
export const Empty: Story = {
  render: () => (
    <div className="border-line-soft w-[420px] rounded-lg border p-4">
      <NotificationList
        groups={[]}
        empty={<EmptyState title="Quiet for now" description="New events will show up here." />}
      />
    </div>
  ),
};

/**
 * The preview of an object is a second slot next to the text, independent of the icon:
 * the icon says what happened, the preview says with what.
 */
export const WithPreview: Story = {
  render: () => (
    <div className="border-line-soft w-[420px] rounded-lg border">
      <NotificationList>
        <NotificationItem
          title="Publishing failed"
          description="The channel is disconnected from the account."
          time="5 minutes ago"
          icon={<ErrorIcon size={16} />}
          tone="danger"
          media={preview}
          unread
          actions={markRead}
        />
        <NotificationItem
          title="Moderation finished with a rather long title that has to wrap"
          description="12 of 14 items approved."
          time="an hour ago"
          icon={<InfoIcon size={16} />}
          media={preview}
        />
        <NotificationItem title="Preview without an icon" media={preview} time="yesterday" />
      </NotificationList>
    </div>
  ),
};

/**
 * The whole row is one button: the name comes from the heading (plus the word "Unread"),
 * and the time and details form the description. Click, Enter and Space. Not combined
 * with `actions`.
 */
export const RowAsButton: Story = {
  render: function Render() {
    const [read, setRead] = useState<string[]>([]);
    const rows = [
      { id: "failed", title: "Publishing failed", body: "The channel is disconnected." },
      { id: "done", title: "Moderation finished", body: "12 of 14 items approved." },
      { id: "report", title: "The report is ready", body: "Open to download it." },
    ];
    return (
      <div className="border-line-soft w-[420px] rounded-lg border">
        <NotificationList>
          {rows.map((row, index) => (
            <NotificationItem
              key={row.id}
              title={row.title}
              description={row.body}
              time={`${(index + 1) * 5} minutes ago`}
              icon={<InfoIcon size={16} />}
              media={preview}
              unread={!read.includes(row.id)}
              onAction={() => setRead((ids) => [...ids, row.id])}
            />
          ))}
        </NotificationList>
      </div>
    );
  },
};
