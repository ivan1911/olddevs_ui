import type { Meta, StoryObj } from "@storybook/react-vite";
import { parseDate } from "@internationalized/date";
import { useState } from "react";
import type { DateValue, RangeValue } from "react-aria-components";
import { RangeCalendar, type RangeCalendarProps } from "./RangeCalendar.js";

/** The month is fixed; the reason for this is explained in the `Calendar` stories. */
const MONTH = parseDate("2026-03-01");
const RANGE = { start: parseDate("2026-03-09"), end: parseDate("2026-03-22") };

const meta = {
  title: "Date and time/RangeCalendar",
  component: RangeCalendar,
  parameters: { layout: "padded" },
  args: { defaultFocusedValue: MONTH },
} satisfies Meta<RangeCalendarProps>;

export default meta;
type Story = StoryObj<RangeCalendarProps>;

export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<RangeValue<DateValue> | null>(RANGE);
    return <RangeCalendar {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Two months side by side are the working view for a range: a range that crosses a month
 * boundary would otherwise require paging back and forth and losing sight of the selected end.
 */
export const TwoMonths: Story = {
  render: (args) => (
    <RangeCalendar
      {...args}
      months={2}
      value={{ start: parseDate("2026-03-25"), end: parseDate("2026-04-07") }}
    />
  ),
};

export const Matrix: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-6">
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">empty</figcaption>
        <RangeCalendar {...args} />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">range selected</figcaption>
        <RangeCalendar {...args} value={RANGE} />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">single-day range</figcaption>
        <RangeCalendar
          {...args}
          value={{ start: parseDate("2026-03-12"), end: parseDate("2026-03-12") }}
        />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">min/max</figcaption>
        <RangeCalendar
          {...args}
          minValue={parseDate("2026-03-09")}
          maxValue={parseDate("2026-03-22")}
        />
      </figure>
    </div>
  ),
};

/**
 * Strings instead of objects: the range is `{ start, end }` of ISO strings `YYYY-MM-DD`,
 * like the `DateRange` of `DateRangePicker`; the bounds are strings too. The consumer
 * does not need `@internationalized/date`.
 */
export const StringApi: Story = {
  render: (args) => {
    const [value, setValue] = useState<{ start: string; end: string } | null>({
      start: "2026-03-09",
      end: "2026-03-13",
    });
    return (
      <div className="flex flex-col gap-2">
        <RangeCalendar
          {...args}
          value={value}
          onChange={(_, iso) => setValue(iso)}
          minValue="2026-03-02"
          maxValue="2026-03-27"
          isDateUnavailable={(date) => date.toString() === "2026-03-18"}
        />
        <p className="text-fg-3 text-[11px]">
          Value: {value ? `${value.start} — ${value.end}` : "empty"}
        </p>
      </div>
    );
  },
};
