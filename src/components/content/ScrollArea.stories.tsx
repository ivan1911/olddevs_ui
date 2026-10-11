import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./ScrollArea.js";
import { Text } from "./Text.js";

const meta = {
  title: "Content/ScrollArea",
  component: ScrollArea,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj;

export const Scrolling: Story = {
  render: () => (
    <div className="flex gap-6">
      <ScrollArea
        label="Categories"
        className="border-line-soft rounded-control h-[180px] w-[220px] border p-3"
      >
        <div className="flex flex-col gap-2">
          {Array.from({ length: 14 }, (_, i) => (
            <Text key={i} level={2} size="sm">
              Category #{i + 1}
            </Text>
          ))}
        </div>
      </ScrollArea>
      <ScrollArea
        orientation="horizontal"
        label="Photo feed"
        className="border-line-soft rounded-control h-[180px] w-[280px] border p-3"
      >
        <div className="flex w-max gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="bg-bg-2 h-[140px] w-[80px] shrink-0 rounded-sm" />
          ))}
        </div>
      </ScrollArea>
    </div>
  ),
};
