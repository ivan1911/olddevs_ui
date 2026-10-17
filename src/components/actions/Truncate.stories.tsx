import type { Meta, StoryObj } from "@storybook/react-vite";
import { TooltipProvider } from "../overlays/Tooltip.js";
import { Truncate, type TruncateProps } from "./Truncate.js";

const meta = {
  title: "Actions/Truncate",
  component: Truncate,
  parameters: { layout: "padded" },
  tags: ["periphery"],
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<TruncateProps>;

export default meta;
type Story = StoryObj<TruncateProps>;

const LONG_TEXT = "A very long file name that does not fit the table column and gets truncated";

/**
 * Hover over it or Tab to it: the tooltip appears only for **truncated** text. The multi-line
 * story doesn't need one, so there isn't one there.
 */
export const Playground: Story = {
  render: () => (
    <div className="flex w-[280px] flex-col gap-2">
      <div className="bg-bg-2 border-line-soft rounded border px-2 py-1.5 text-[13px]">
        <Truncate>{LONG_TEXT}</Truncate>
      </div>
      <div className="bg-bg-2 border-line-soft rounded border px-2 py-1.5 text-[13px]">
        <Truncate>Short name</Truncate>
      </div>
    </div>
  ),
};

/** Several lines: truncation by line count, not by width. */
export const MultipleLines: Story = {
  render: () => (
    <div className="bg-bg-2 border-line-soft w-[280px] rounded border px-2 py-1.5 text-[13px]">
      <Truncate lines={2}>{`${LONG_TEXT} ${LONG_TEXT}`}</Truncate>
    </div>
  ),
};

/** In a narrow column more gets truncated. The measurement repeats when the size changes. */
export const NarrowColumn: Story = {
  render: () => (
    <div className="flex items-start gap-3">
      {[120, 200, 320].map((w) => (
        <div
          key={w}
          className="bg-bg-2 border-line-soft rounded border px-2 py-1.5 text-[13px]"
          style={{ width: w }}
        >
          <Truncate>{LONG_TEXT}</Truncate>
        </div>
      ))}
    </div>
  ),
};
