import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ColorPicker } from "./ColorPicker.js";

const meta = {
  title: "Inputs/ColorPicker",
  component: ColorPicker,
  // Periphery under ADR-0038: a wrapper over the react-aria color components,
  // with no color math of its own.
  tags: ["periphery"],
  parameters: { layout: "centered" },
  args: { value: "#4f7df3", onChange: () => {}, label: "Brand colour" },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="flex items-center gap-3">
        <ColorPicker {...args} value={value} onChange={setValue} />
        <code className="text-fg-2 text-caption">{value}</code>
      </div>
    );
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The saturation area, the hue strip and the format field. */
export const Playground: Story = {};

/**
 * Presets. They have no default on purpose: a set of brand colors is the consumer's domain,
 * and whoever knows which of them apply to their entity should plug in the theme token values.
 */
export const WithPresets: Story = {
  args: {
    presets: ["#4f7df3", "#7c5cf5", "#16a34a", "#f59e0b", "#e11d48", "#0ea5e9"],
  },
};

/**
 * The format of the string that comes out. The input field stays hexadecimal, though:
 * `rgb` and `hsl` are three channel fields, that is, a different control rather than
 * a different format of the same one. Hence the prop name.
 */
export const RgbOutput: Story = {
  args: { outputFormat: "rgb" },
};

/** A disabled field does not expand. */
export const Disabled: Story = {
  args: { disabled: true },
};
