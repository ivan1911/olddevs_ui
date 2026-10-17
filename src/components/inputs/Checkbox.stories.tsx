import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, type CheckboxProps } from "./Checkbox.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

/**
 * The checkbox is controlled, like `Toggle`: it holds no state of its own, and without
 * external state a click will not change it. `checked` in the stories sets only
 * the starting position.
 */
function ControlledCheckbox({
  checked = false,
  ...rest
}: Omit<CheckboxProps, "checked" | "onCheckedChange"> & { checked?: boolean }) {
  const [on, setOn] = useState(checked);
  return <Checkbox checked={on} onCheckedChange={setOn} {...rest} />;
}

const meta = {
  title: "Inputs/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  args: { children: "Show in the feed" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: "Show in the feed", disabled: false, invalid: false },
  render: (args) => (
    <ControlledCheckbox disabled={args.disabled} invalid={args.invalid}>
      {args.children}
    </ControlledCheckbox>
  ),
};

/** A hint under the label, for consents where one line is not enough. */
export const WithDescription: Story = {
  render: () => (
    <ControlledCheckbox checked description="Arrives by email within a day">
      Send a publishing report
    </ControlledCheckbox>
  ),
};

/**
 * Without a visible label: in a table header or a list row. In this case `label` is
 * required, and the compiler checks it.
 */
export const WithoutLabel: Story = {
  render: () => <ControlledCheckbox label="Select all rows" />,
};

/**
 * Matrix of state × tone × availability.
 *
 * A single checkbox would not show the two things the matrix exists for: that an UNchecked
 * checkbox is neutral in any tone (the tone colors only the consent, not the outline),
 * and that the indeterminate state visually covers the checked one instead of adding to it.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-4">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Tone</span>
          </th>
          {["unchecked", "checked", "indeterminate", "disabled", "invalid"].map((h) => (
            <th key={h} className="text-fg-2 font-mono text-xs font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
          <tr key={tone}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{tone}</td>
            <td>
              <Checkbox tone={tone} label={`${tone}, unchecked`} />
            </td>
            <td>
              <Checkbox tone={tone} checked label={`${tone}, checked`} />
            </td>
            <td>
              {/* Both cells: the dash for an unchecked checkbox and for a checked one. */}
              <div className="flex items-center gap-2">
                <Checkbox tone={tone} indeterminate label={`${tone}, indeterminate`} />
                <Checkbox
                  tone={tone}
                  checked
                  indeterminate
                  label={`${tone}, checked and indeterminate`}
                />
              </div>
            </td>
            <td>
              <Checkbox tone={tone} checked disabled label={`${tone}, disabled`} />
            </td>
            <td>
              <Checkbox tone={tone} invalid label={`${tone}, invalid`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Two sizes side by side: the label and the box must be center-aligned in both. */
export const Sizes: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-3">
      <ControlledCheckbox size="sm" checked>
        Small
      </ControlledCheckbox>
      <ControlledCheckbox size="md" checked>
        Medium
      </ControlledCheckbox>
    </div>
  ),
};
