import { parseDate } from "@internationalized/date";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_PERIOD_PRESETS,
  formatPeriodLength,
  isRelativePeriod,
  periodLength,
  RELATIVE_PERIODS,
  resolvePeriod,
  type RelativePeriod,
} from "../src/lib/period.js";

/**
 * «Сегодня» задаётся явно во всех проверках расчёта.
 *
 * Без этого тест зависел бы от дня прогона: `lastMonth` в марте и в мае —
 * разные диапазоны, и падение в первый день месяца выглядело бы случайным.
 * Именно поэтому `resolvePeriod` принимает `now` третьим аргументом.
 */
const TODAY = parseDate("2026-03-15");

describe("resolvePeriod", () => {
  test.each([
    ["7d", "2026-03-09", "2026-03-15"],
    ["30d", "2026-02-14", "2026-03-15"],
    ["90d", "2025-12-16", "2026-03-15"],
    ["180d", "2025-09-17", "2026-03-15"],
    ["365d", "2025-03-16", "2026-03-15"],
    ["thisMonth", "2026-03-01", "2026-03-15"],
    ["lastMonth", "2026-02-01", "2026-02-28"],
    ["thisYear", "2026-01-01", "2026-03-15"],
  ] as const)("%s → %s..%s", (period, start, end) => {
    expect(resolvePeriod(period, undefined, TODAY)).toEqual({ start, end });
  });

  /**
   * Отсчёт включает сегодняшний день, поэтому «7 дней» — это ровно семь дат,
   * а не восемь. Ошибка на единицу здесь незаметна глазом и заметна в отчёте.
   */
  test("day periods contain exactly as many dates as they promise", () => {
    for (const [period, days] of [
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
      ["180d", 180],
      ["365d", 365],
    ] as const) {
      expect(periodLength(resolvePeriod(period, undefined, TODAY))).toBe(days);
    }
  });

  /** Длина февраля, високосный год и переход через границу года. */
  test.each([
    ["2026-03-15", "2026-02-01", "2026-02-28"],
    ["2024-03-15", "2024-02-01", "2024-02-29"],
    ["2026-05-31", "2026-04-01", "2026-04-30"],
    ["2026-01-10", "2025-12-01", "2025-12-31"],
  ])("lastMonth from %s → %s..%s", (today, start, end) => {
    expect(resolvePeriod("lastMonth", undefined, parseDate(today))).toEqual({ start, end });
  });

  test("an unknown period does not turn into a “filter without bounds”", () => {
    // Приведение повторяет то, что делает потребитель, забывший проверку:
    // ошибка на границе честнее, чем пустой результат тремя строками ниже.
    expect(() => resolvePeriod("30days" as RelativePeriod, undefined, TODAY)).toThrow(
      /Unknown period/
    );
  });
});

describe("isRelativePeriod", () => {
  test("lets every declared period through", () => {
    for (const period of RELATIVE_PERIODS) expect(isRelativePeriod(period)).toBe(true);
  });

  test.each([["30days"], ["30D"], [""], ["7d "], [null], [undefined], [30], [{}]])(
    "rejects %o",
    (value) => {
      expect(isRelativePeriod(value)).toBe(false);
    }
  );

  test("every default preset is a valid period", () => {
    for (const preset of DEFAULT_PERIOD_PRESETS) expect(isRelativePeriod(preset.period)).toBe(true);
  });
});

describe("periodLength", () => {
  test("both bounds are inclusive: one day is one day", () => {
    expect(periodLength({ start: "2026-03-12", end: "2026-03-12" })).toBe(1);
  });

  /**
   * Расчёт идёт в UTC, и это защита от перехода на летнее время: в местной
   * зоне сутки перевода длятся 23 или 25 часов, и деление на 86 400 000
   * давало бы 30.96 дня вместо 31.
   */
  test("a daylight-saving switch does not shift the length", () => {
    // В США перевод часов 8 марта 2026 года, в Европе — 29 марта.
    expect(periodLength({ start: "2026-03-01", end: "2026-03-31" })).toBe(31);
    expect(periodLength({ start: "2026-10-20", end: "2026-11-05" })).toBe(17);
  });

  test("an inverted range yields no negative length", () => {
    expect(periodLength({ start: "2026-03-20", end: "2026-03-12" })).toBe(1);
  });
});

/**
 * Границы `DateRange` — обычные строки, и приходят они из адреса наравне с
 * периодом. `isRelativePeriod` и ветка `default` в `resolvePeriod` заведены
 * именно поэтому; `periodLength` эту же защиту не имел и бросал `parseDate`
 * прямо в рендер подписи под календарём.
 */
describe("the length of a period does not throw on a hand-edited bound", () => {
  test.each([
    ["", ""],
    ["zzz", "2024-01-01"],
    ["2024-01-01", "2024-02-30"],
  ])("bounds %o / %o give nothing to show rather than an exception", (start, end) => {
    expect(() => periodLength({ start, end })).not.toThrow();
    expect(periodLength({ start, end })).toBe(0);
  });

  test("an unshowable length renders as an empty string, not as “1 day”", () => {
    // Пустая строка гасится `empty:hidden` у подписи; «1 день» под календарём с
    // мусором в границах был бы уверенным враньём.
    expect(formatPeriodLength({ start: "", end: "" })).toBe("");
  });
});
