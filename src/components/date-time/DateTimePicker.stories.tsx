import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DateTimePicker, type DateTimePickerProps } from "./DateTimePicker.js";

const meta = {
  title: "Date and time/DateTimePicker",
  component: DateTimePicker,
  parameters: { layout: "padded" },
  args: { onDateChange: () => {}, onTimeChange: () => {} },
} satisfies Meta<DateTimePickerProps>;

export default meta;
type Story = StoryObj<DateTimePickerProps>;

export const Playground: Story = {
  render: (args) => {
    const [date, setDate] = useState("2026-03-12");
    const [time, setTime] = useState("21:30");
    return (
      <div className="h-[380px]">
        <DateTimePicker
          {...args}
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          timeZoneLabel="MSK"
        />
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
            ["empty", null, "", undefined, false],
            ["date and time", "2026-03-12", "21:30", undefined, false],
            ["with a zone label", "2026-03-12", "21:30", "MSK", false],
            ["disabled", "2026-03-12", "21:30", "MSK", true],
          ] as const
        ).map(([label, date, time, zone, disabled]) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <DateTimePicker
                {...args}
                date={date}
                time={time}
                timeZoneLabel={zone}
                disabled={disabled}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
