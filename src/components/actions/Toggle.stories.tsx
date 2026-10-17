import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle, type ToggleProps } from "./Toggle.js";

/**
 * Toggle is controlled: it does not store its own state, and without external state it
 * does not respond to a click. So the stories wrap it in a local `useState`, and the
 * `checked` prop only sets the initial position.
 */
function ControlledToggle({
  checked = false,
  ...rest
}: Omit<ToggleProps, "checked" | "onCheckedChange"> & { checked?: boolean }) {
  const [on, setOn] = useState(checked);
  return <Toggle checked={on} onCheckedChange={setOn} {...rest} />;
}

const meta = {
  title: "Actions/Toggle",
  component: Toggle,
  parameters: { layout: "centered" },
  // `label` is required by the types, so it is set here. Otherwise Storybook
  // would require it in the args of every story, including those that render the matrix.
  args: { checked: false, onCheckedChange: () => {}, label: "Switch" },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live toggle: the `checked` control sets the starting position. */
export const Playground: Story = {
  args: { checked: false, disabled: false, label: "Auto-publishing" },
  render: (args) => (
    <ControlledToggle
      checked={args.checked}
      disabled={args.disabled}
      label={args.label ?? "Switch"}
    />
  ),
};

/**
 * State × availability matrix. A single toggle won't show that a `disabled` toggle in the
 * on position is dimmed by opacity, and in the light theme it is almost indistinguishable
 * from the off position. The matrix will.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-4">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Variant</span>
          </th>
          <th className="text-fg-2 font-mono text-xs font-semibold">plain</th>
          <th className="text-fg-2 font-mono text-xs font-semibold">disabled</th>
        </tr>
      </thead>
      <tbody>
        {[false, true].map((checked) => (
          <tr key={String(checked)}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">
              {checked ? "checked" : "unchecked"}
            </td>
            <td>
              <ControlledToggle checked={checked} label="Switch" />
            </td>
            <td>
              <ControlledToggle checked={checked} disabled label="Switch, disabled" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/**
 * The on-screen label is set through `children`. It is also the accessible name, and clicking
 * it toggles the switch. Without a label (`label`), the toggle stays a bare track.
 */
export const WithLabel: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[360px] flex-col gap-3">
      <ControlledToggle checked>Auto-publishing</ControlledToggle>
      <ControlledToggle>Notify about errors</ControlledToggle>
      <ControlledToggle disabled>Unavailable on the current plan</ControlledToggle>
    </div>
  ),
};

/**
 * Settings row: the title and the explanation on the left, the toggle on the right. The
 * description is linked to the toggle through `aria-describedby`, and a click on either
 * of the two texts toggles it.
 */
export const SettingRow: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="border-line-soft bg-bg-2 flex w-[420px] flex-col gap-4 rounded-lg border p-4">
      <ControlledToggle checked description="Everyone confirms a code on top of the password.">
        Require two-factor sign-in
      </ControlledToggle>
      <ControlledToggle description="Guests see only the projects they are added to.">
        Members can invite guests
      </ControlledToggle>
      <ControlledToggle disabled description="Available on the Business plan.">
        Single sign-on
      </ControlledToggle>
    </div>
  ),
};
