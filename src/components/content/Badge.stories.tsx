import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge.js";
import { StatusBadge } from "../actions/StatusBadge.js";
import { Text } from "./Text.js";
import { BellIcon } from "../../icons.js";

/** Wave 10: data. A lighter quality bar, no snapshots. */
const meta = {
  title: "Content/Badge",
  component: Badge,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj;

export const Badges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="relative inline-flex">
          <BellIcon size={20} className="text-fg-2" />
          <Badge overlay>5</Badge>
        </span>
        <span className="relative inline-flex">
          <BellIcon size={20} className="text-fg-2" />
          <Badge overlay dot />
        </span>
        <Badge tone="accent">12</Badge>
        <Badge tone="neutral">237</Badge>
        <Badge>{140}</Badge>
      </div>
      <Text size="sm" level={3}>
        Next to it — `StatusBadge`, which is about the state of an entity, not about a count:
      </Text>
      <div className="flex items-center gap-2">
        <StatusBadge tone="success" dot>
          Published
        </StatusBadge>
        <StatusBadge tone="neutral" dot>
          Draft
        </StatusBadge>
      </div>
    </div>
  ),
};
