import type { Meta, StoryObj } from "@storybook/react-vite";
import { AspectRatio } from "./AspectRatio.js";

const meta = {
  title: "Content/AspectRatio",
  component: AspectRatio,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj;

export const Ratio: Story = {
  render: () => (
    <div className="flex w-[520px] gap-4">
      {[
        { ratio: 16 / 9, label: "16 / 9" },
        { ratio: 1, label: "1" },
        { ratio: 9 / 16, label: "9 / 16" },
      ].map(({ ratio, label }) => (
        <div key={label} className="flex-1">
          <AspectRatio ratio={ratio} className="bg-bg-2 border-line-soft rounded-control border">
            <div className="text-fg-2 text-caption flex h-full items-center justify-center">
              {label}
            </div>
          </AspectRatio>
        </div>
      ))}
    </div>
  ),
};
