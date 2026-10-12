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
 * Живой выбор. Открытая панель показывает пресеты и календарь; пресет
 * разворачивается в конкретные даты от «сегодня», поэтому в снимок эта
 * история попадает только свёрнутой.
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
 * Раскрытая панель: колонка пресетов, календарь на два месяца и длительность
 * снизу. Месяц зафиксирован, поэтому снимок не меняется от суток к суткам.
 * Выбранного пресета здесь нет: рамка на первом пресете («7 days») — фокус
 * клавиатуры при открытии, а не выбор; выбранный пресет подсвечивался бы только
 * после клика.
 */
export const Open: Story = {
  render: (args) => (
    <div className="h-[520px] w-[320px]">
      <DateRangePicker {...args} value={RANGE} defaultFocusedValue={parseDate("2026-03-01")} open />
    </div>
  ),
};

/**
 * С крестиком очистки. Без него период снимается только общим «Сбросить»,
 * который сносит и все остальные фильтры разом, — на ревью это назвали
 * функциональным пробелом, и справедливо.
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
      {/* Пресет вытесняет подпись из дат: «30 дней» честнее пары дат, которая завтра станет другой. */}
      <DateRangePicker {...args} value={RANGE} period="30d" />
      <DateRangePicker {...args} value={RANGE} disabled />
    </div>
  ),
};

/**
 * Занятые дни и границы строками: в календаре они зачёркнуты и не выбираются;
 * `minValue` и `maxValue` — ISO-строки, `@internationalized/date` не нужен.
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
