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

/** A single badge with live controls. Tweak the props. */
export const Playground: Story = {
  args: { tone: "success", size: "sm", dot: true },
};

/**
 * Tone × size matrix, with and without a dot. This is the point of the showcase: a single
 * badge won't show that `warning` on a muted background loses contrast in the light theme,
 * and that a `neutral` without a dot stops reading as a status.
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

/** Label length: the badge does not wrap (`whitespace-nowrap`) and stretches to fit its width. */
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
