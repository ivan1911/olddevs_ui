import type { Meta, StoryObj } from "@storybook/react-vite";
import { parseDate } from "@internationalized/date";
import { useState } from "react";
import type { DateRange, RelativePeriod } from "../../lib/period.js";
import { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker.js";

const RANGE: DateRange = { start: "2026-03-09", end: "2026-03-22" };

const meta = {
  title: "Date and time/DateRangePicker",
  component: DateRangePicker,
  parameters: { layout: "padded" },
  args: { onChange: () => {} },
} satisfies Meta<DateRangePickerProps>;

export default meta;
type Story = StoryObj<DateRangePickerProps>;

/**
 * Live example. The open panel shows the presets and the calendar; a preset expands
 * into concrete dates counted from "today", so this story gets into the snapshot only
 * in its collapsed state.
 */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<DateRange | null>(RANGE);
    const [period, setPeriod] = useState<RelativePeriod | null>(null);
    return (
      <div className="h-[420px] w-[320px]">
        <DateRangePicker
          {...args}
          value={value}
          period={period}
          onChange={(range, p) => {
            setValue(range);
            setPeriod(p);
          }}
        />
      </div>
    );
  },
};

/**
 * The expanded panel: a column of presets, a two-month calendar and the duration below.
 * The month is fixed, so the snapshot does not change from day to day.
 * No preset is selected here: the outline on the first preset ("7 days") is the keyboard
 * focus on open, not a selection; a selected preset would be highlighted only after a click.
 */
export const Open: Story = {
  render: (args) => (
    <div className="h-[520px] w-[320px]">
      <DateRangePicker {...args} value={RANGE} defaultFocusedValue={parseDate("2026-03-01")} open />
    </div>
  ),
};

/**
 * With a clear button. Without it, the range is removed only by the shared "Reset", which
 * also clears all the other filters at once: in review this was called a functional gap,
 * and rightly so.
 */
export const WithClear: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col gap-3">
      <DateRangePicker {...args} value={RANGE} onClear={() => {}} />
      <DateRangePicker {...args} value={RANGE} period="30d" onClear={() => {}} />
      <DateRangePicker {...args} value={null} onClear={() => {}} />
    </div>
  ),
};

export const Matrix: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col gap-4">
      <DateRangePicker {...args} value={null} />
      <DateRangePicker {...args} value={RANGE} />
      {/* A preset replaces the date label: "30 days" is more honest than a date range that will differ tomorrow. */}
      <DateRangePicker {...args} value={RANGE} period="30d" />
      <DateRangePicker {...args} value={RANGE} disabled />
    </div>
  ),
};

/**
 * Unavailable days and bounds as strings: in the calendar they are struck through and
 * cannot be selected; `minValue` and `maxValue` are ISO strings, so `@internationalized/date`
 * is not needed.
 */
export const UnavailableDays: Story = {
  render: (args) => (
    <div className="h-[520px] w-[320px]">
      <DateRangePicker
        {...args}
        value={RANGE}
        defaultFocusedValue="2026-03-01"
        minValue="2026-03-02"
        maxValue="2026-03-27"
        isDateUnavailable={(date) => ["2026-03-04", "2026-03-05"].includes(date.toString())}
        open
      />
    </div>
  ),
};
