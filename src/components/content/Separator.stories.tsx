import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./Separator.js";
import { Text } from "./Text.js";

const meta = {
  title: "Content/Separator",
  component: Separator,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj;

export const Separators: Story = {
  render: () => (
    <div className="flex max-w-[420px] flex-col">
      <Text level={2}>Scheduled publishing</Text>
      <Separator spacing="md" />
      <Text level={2}>Manual publishing</Text>
      <Separator spacing="md" />
      <div className="flex h-10 items-center gap-3">
        <Text level={2}>left</Text>
        <Separator orientation="vertical" />
        <Text level={2}>right</Text>
      </div>
    </div>
  ),
};
