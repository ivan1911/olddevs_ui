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
 * Матрица тонов и размеров, плюс неизвестный прогресс.
 *
 * У неизвестного `aria-valuenow` отсутствует, а не равен нулю: так ARIA
 * отличает «полоса на нуле» от «идёт неизвестно сколько».
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
 * Три индикатора рядом — граница между ними.
 *
 * Скелетон там, где форма будущего содержимого известна: он удерживает
 * раскладку, и содержимое не прыгает при появлении. Полоса — где известна доля
 * работы. Спиннер — где не известно ни то, ни другое.
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
