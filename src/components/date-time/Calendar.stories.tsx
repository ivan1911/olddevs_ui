import type { Meta, StoryObj } from "@storybook/react-vite";
import { parseDate } from "@internationalized/date";
import { useState } from "react";
import type { DateValue } from "react-aria-components";
import { Calendar, type CalendarProps } from "./Calendar.js";

/**
 * Месяц зафиксирован намеренно.
 *
 * Календарь по умолчанию открывается на текущем месяце и помечает сегодняшний
 * день точкой — то есть его снимок менялся бы каждые сутки, и визуальный
 * бейзлайн краснел бы сам по себе, без единой правки кода. Истории показывают
 * март 2026 и никогда не совпадут с «сегодня».
 */
const MONTH = parseDate("2026-03-01");

const meta = {
  title: "Date and time/Calendar",
  component: Calendar,
  parameters: { layout: "padded" },
  args: { defaultFocusedValue: MONTH },
} satisfies Meta<CalendarProps>;

export default meta;
type Story = StoryObj<CalendarProps>;

/** Живой выбор даты. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<DateValue>(parseDate("2026-03-12"));
    return <Calendar {...args} value={value} onChange={setValue} />;
  },
};

export const Matrix: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-6">
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">nothing selected</figcaption>
        <Calendar {...args} />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">selected</figcaption>
        <Calendar {...args} value={parseDate("2026-03-12")} />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">
          min/max: second week only
        </figcaption>
        <Calendar {...args} minValue={parseDate("2026-03-09")} maxValue={parseDate("2026-03-15")} />
      </figure>
      <figure>
        <figcaption className="text-fg-2 mb-1 font-mono text-xs">weekends unavailable</figcaption>
        <Calendar
          {...args}
          isDateUnavailable={(date) => {
            const day = date.toDate("UTC").getUTCDay();
            return day === 0 || day === 6;
          }}
        />
      </figure>
    </div>
  ),
};

/**
 * Строки вместо объектов: границы, значение и ответ — ISO `ГГГГ-ММ-ДД`, как у
 * `DatePicker`. `@internationalized/date` потребителю не нужен.
 */
export const StringApi: Story = {
  render: (args) => {
    const [value, setValue] = useState("2026-03-12");
    return (
      <div className="flex flex-col gap-2">
        <Calendar
          {...args}
          value={value}
          onChange={(_, iso) => setValue(iso)}
          minValue="2026-03-09"
          maxValue="2026-03-22"
        />
        <p className="text-fg-3 text-[11px]">Value: {value}</p>
      </div>
    );
  },
};
