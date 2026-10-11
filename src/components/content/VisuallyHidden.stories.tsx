import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading } from "./Heading.js";
import { Text } from "./Text.js";
import { VisuallyHidden } from "./VisuallyHidden.js";

const meta = {
  title: "Content/VisuallyHidden",
  component: VisuallyHidden,
  parameters: { layout: "padded" },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj;

/**
 * Скрытое содержимое видно только скринридеру — на снимке его нет, и это
 * ровно то, чего от него ждут.
 */
export const HiddenContent: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Heading level={3}>
        Drafts
        <VisuallyHidden> — eight of them, updated today</VisuallyHidden>
      </Heading>
      <Text level={3} size="sm">
        The heading above carries a label only a screen reader sees.
      </Text>
    </div>
  ),
};
