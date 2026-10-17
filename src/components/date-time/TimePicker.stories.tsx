import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "../inputs/FormField.js";
import { TimePicker, type TimePickerProps } from "./TimePicker.js";

const meta = {
  title: "Date and time/TimePicker",
  component: TimePicker,
  parameters: { layout: "padded" },
  args: { onChange: () => {} },
} satisfies Meta<TimePickerProps>;

export default meta;
type Story = StoryObj<TimePickerProps>;

export const Playground: Story = {
  render: (args) => {
    const [time, setTime] = useState("10:00");
    return (
      <div className="h-[320px]">
        <TimePicker {...args} value={time} onChange={setTime} />
      </div>
    );
  },
};

export const FifteenMinuteStep: Story = {
  render: (args) => {
    const [time, setTime] = useState("10:00");
    return (
      <div className="h-[320px]">
        <TimePicker {...args} step={15} value={time} onChange={setTime} />
      </div>
    );
  },
};

/** The 12-hour hour cycle: the field and the list show `2:30 PM`, while `value` stays `HH:MM`. */
export const TwelveHour: Story = {
  render: (args) => {
    const [time, setTime] = useState("14:30");
    return (
      <div className="h-[320px]">
        <TimePicker {...args} hourCycle={12} value={time} onChange={setTime} />
        <p className="text-fg-3 mt-2 text-[13px]">value: {time}</p>
      </div>
    );
  },
};

export const Matrix: Story = {
  render: (args) => (
    <table className="border-separate border-spacing-3">
      <tbody>
        {(
          [
            ["empty", null, false],
            ["with a value", "21:30", false],
            ["disabled", "21:30", true],
          ] as const
        ).map(([label, value, disabled]) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <TimePicker {...args} value={value} disabled={disabled} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Error: the underline under the time is red, and the field has `aria-invalid`. */
export const Invalid: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <TimePicker {...args} value="23:30" invalid aria-label="Time, invalid" />
      <FormField label="Check-in time" error="Check-in is possible until 22:00">
        <TimePicker {...args} value="23:30" aria-label="Check-in time" />
      </FormField>
    </div>
  ),
};
