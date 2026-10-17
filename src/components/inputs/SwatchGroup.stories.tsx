import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { LABEL_HUES } from "../../lib/variants.js";
import { SwatchGroup, type SwatchGroupProps, type SwatchOption } from "./SwatchGroup.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "Inputs/SwatchGroup",
  component: SwatchGroup,
  parameters: { layout: "padded" },
} satisfies Meta<SwatchGroupProps>;

export default meta;
type Story = StoryObj<SwatchGroupProps>;

/** The hue name as a word: it is also the option's name for the screen reader. */
const NAMES: Record<(typeof LABEL_HUES)[number], string> = {
  blue: "Blue",
  violet: "Violet",
  teal: "Teal",
  green: "Green",
  amber: "Amber",
  red: "Red",
  pink: "Pink",
  steel: "Steel",
};

/** The consumer's nine options: eight hues and "no color". */
const OPTIONS: SwatchOption[] = [
  { value: "none", name: "No colour" },
  ...LABEL_HUES.map((hue) => ({ value: hue, hue, name: NAMES[hue] })),
];

/** Live example: the arrow keys move the selection across the grid and apply it at once. */
export const Playground: Story = {
  render: () => {
    const [value, setValue] = useState("teal");
    return (
      <SwatchGroup label="Project colour" value={value} onChange={setValue} options={OPTIONS} />
    );
  },
};

/**
 * Columns are set as a number, not `auto-fill`: the vertical arrow keys move by them,
 * so the set must know their count. On the left, six in a row; on the right, three.
 */
export const Columns: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup label="Six in a row" value="blue" onChange={() => {}} options={OPTIONS} />
      <SwatchGroup
        label="Three in a row"
        value="blue"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
      />
    </div>
  ),
};

/**
 * The selected state is a ring, not a second color: an accent ring around the blue sample
 * would not read at all, and the selected one cannot be told apart by saturation alone.
 */
export const Selected: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      {(["none", "blue", "amber", "steel"] as const).map((value) => (
        <SwatchGroup
          key={value}
          label={value}
          value={value}
          onChange={() => {}}
          options={OPTIONS}
          columns={3}
        />
      ))}
    </div>
  ),
};

/** A disabled set and a disabled option are different things. */
export const Disabled: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup
        label="The whole set"
        value="blue"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
        disabled
      />
      <SwatchGroup
        label="One option"
        value="blue"
        onChange={() => {}}
        columns={3}
        options={OPTIONS.map((option) =>
          option.value === "red" ? { ...option, disabled: true } : option
        )}
      />
    </div>
  ),
};

/**
 * The hue name as a tooltip: on hover and on focus from the keyboard.
 *
 * The word comes from the same `name` by which the option is announced to the screen reader,
 * and aloud it is still announced ONCE: the Radix description settles on the wrapper,
 * not on the radio button itself.
 *
 * The provider is set up here by the story. In an app there is one, at the root, and that
 * is a requirement on the consumer: without it Radix throws on the very first option, which is
 * exactly why the tooltip is off by default.
 */
export const Tooltips: Story = {
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup
        label="Hover or tab into it"
        value="teal"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
        tooltips
      />
      <SwatchGroup
        label="A disabled option is named too"
        value="teal"
        onChange={() => {}}
        columns={3}
        options={OPTIONS.map((option) =>
          option.value === "red" ? { ...option, disabled: true } : option
        )}
        tooltips
      />
    </div>
  ),
};
