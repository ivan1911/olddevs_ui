import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DatePicker, type DatePickerProps } from "./DatePicker.js";

const meta = {
  title: "Date and time/DatePicker",
  component: DatePicker,
  parameters: { layout: "padded" },
  args: { onChange: () => {} },
} satisfies Meta<DatePickerProps>;

export default meta;
type Story = StoryObj<DatePickerProps>;

/** Живой выбор: раскрытый календарь живёт в портале и в матрицу не попадает. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>("2026-03-12");
    return (
      <div className="h-[380px]">
        <DatePicker {...args} value={value} onChange={setValue} />
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
            ["date picked", "2026-03-12", false],
            ["disabled", "2026-03-12", true],
          ] as const
        ).map(([label, value, disabled]) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <DatePicker {...args} value={value} disabled={disabled} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
