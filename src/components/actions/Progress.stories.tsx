import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "./Progress.js";
import { Skeleton } from "../content/Skeleton.js";
import { Spinner } from "./Spinner.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

const meta = {
  title: "Actions/Progress",
  component: Progress,
  parameters: { layout: "padded" },
  args: { value: 60, label: "File upload" },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Progress {...args} showValue />
    </div>
  ),
};

/**
 * Matrix of tones and sizes, plus an indeterminate progress bar.
 *
 * An indeterminate bar has no `aria-valuenow`, rather than a value of zero: this is how
 * ARIA tells "a bar at zero" apart from "in progress for an unknown amount of time".
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex w-[420px] flex-col gap-4">
      {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
        <div key={tone} className="flex flex-col gap-2">
          <Progress tone={tone} size="sm" value={40} label={`${tone}, thin`} />
          <Progress tone={tone} size="md" value={70} label={`${tone}`} showValue />
        </div>
      ))}
      <Progress value={null} label="Unknown amount" showValue />
    </div>
  ),
};

/**
 * Three indicators side by side, showing where the boundary between them lies.
 *
 * A skeleton is for places where the shape of the future content is known: it holds
 * the layout, so the content does not jump when it appears. A bar is for places where
 * the share of work done is known. A spinner is for places where neither is known.
 */
export const VersusNeighbours: Story = {
  render: () => (
    <div className="flex w-[420px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-fg-2 text-[11px]">Skeleton — the shape is known</span>
        <Skeleton width="100%" height={12} />
        <Skeleton width="70%" height={12} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-fg-2 text-[11px]">Progress — the share is known</span>
        <Progress value={45} label="File upload" showValue />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-fg-2 text-[11px]">Spinner — nothing is known</span>
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </div>
    </div>
  ),
};
