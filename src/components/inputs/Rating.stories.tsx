import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Rating } from "./Rating.js";

const meta = {
  title: "Inputs/Rating",
  component: Rating,
  parameters: { layout: "centered" },
  args: { value: 3, "aria-label": "Quality" },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live rating: the arrow keys change the value, and the whole group is one tab stop. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Rating {...args} value={value} onChange={setValue} />;
  },
};

/** All values in a row, including zero: clearing the rating is a legitimate action. */
export const Values: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {[0, 1, 3, 5].map((value) => (
        <Rating {...args} key={value} value={value} onChange={() => {}} />
      ))}
    </div>
  ),
};

/**
 * Showing and blocking are different states. `readOnly` shows the data and does not dim
 * it: dimming the displayed value would hide what is shown on purpose.
 * `disabled` dims the control, because the action is unavailable right now.
 */
export const ReadOnlyAndDisabled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Rating {...args} value={4} readOnly caption="4,2 · 128 ratings" />
      <Rating {...args} value={2} disabled onChange={() => {}} />
    </div>
  ),
};

/** A small size: for a table row and a card. */
export const Small: Story = {
  args: { size: "sm", value: 4 },
  render: (args) => <Rating {...args} onChange={() => {}} />,
};
