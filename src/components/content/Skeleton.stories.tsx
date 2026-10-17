import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton.js";

const meta = {
  title: "Content/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered" },
  args: { width: 240, height: 16 },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single bar with live controls. */
export const Playground: Story = {};

/**
 * Matrix of shapes. A skeleton has neither tones nor variants: its axis is the shape,
 * so the matrix shows not `variant × tone` but what the skeleton actually stands in for:
 * a line of text, an avatar, a preview, a button.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <tbody>
        {(
          [
            ["a line of text", { width: 240, height: 12, borderRadius: 4 }],
            ["a heading", { width: 160, height: 20, borderRadius: 6 }],
            ["an avatar", { width: 40, height: 40, borderRadius: "50%" }],
            ["a button", { width: 96, height: 32, borderRadius: 10 }],
            ["a photo preview", { width: 120, height: 200 }],
          ] as const
        ).map(([label, props]) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <Skeleton {...props} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
