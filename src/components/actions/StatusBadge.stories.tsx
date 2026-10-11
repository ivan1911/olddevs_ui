import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge.js";
import type { Tone } from "../../lib/variants.js";

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

const meta = {
  title: "Actions/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  args: { children: "In progress" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Один бейдж с живыми контролами — покрутить пропсы. */
export const Playground: Story = {
  args: { tone: "success", size: "sm", dot: true },
};

/**
 * Матрица тон × размер, с точкой и без. Смысл витрины именно в ней: одиночный
 * бейдж не покажет, что `warning` на приглушённой подложке в светлой теме
 * теряет контраст, а `neutral` без точки перестаёт читаться как статус.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Variant</span>
          </th>
          <th className="text-fg-2 font-mono text-xs font-semibold">sm + dot</th>
          <th className="text-fg-2 font-mono text-xs font-semibold">sm</th>
          <th className="text-fg-2 font-mono text-xs font-semibold">md + dot</th>
          <th className="text-fg-2 font-mono text-xs font-semibold">md</th>
        </tr>
      </thead>
      <tbody>
        {TONES.map((tone) => (
          <tr key={tone}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{tone}</td>
            <td>
              <StatusBadge tone={tone} size="sm">
                Status
              </StatusBadge>
            </td>
            <td>
              <StatusBadge tone={tone} size="sm" dot={false}>
                Status
              </StatusBadge>
            </td>
            <td>
              <StatusBadge tone={tone} size="md">
                Status
              </StatusBadge>
            </td>
            <td>
              <StatusBadge tone={tone} size="md" dot={false}>
                Status
              </StatusBadge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Длина подписи: бейдж не переносится (`whitespace-nowrap`) и тянется в ширину. */
export const LabelLength: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex max-w-xs flex-wrap items-center gap-3">
      <StatusBadge tone="success">OK</StatusBadge>
      <StatusBadge tone="accent">In progress</StatusBadge>
      <StatusBadge tone="danger" size="md">
        Rejected by a moderator
      </StatusBadge>
    </div>
  ),
};
