// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { parseDate } from "@internationalized/date";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { DateRangePicker } from "../src/components/date-time/DateRangePicker.js";

/*
  `matchMedia` в jsdom нет, а `DateRangePicker` спрашивает его, чтобы решить,
  показывать один месяц или два. Заглушка отвечает «узко» — один месяц: так
  разметка теста не зависит от ширины окна.
*/
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(cleanup);

/**
 * Перевёрнутый диапазон из адреса — не значение.
 *
 * Календарём его не выбрать, но собрать руками можно. Обе даты разбирались,
 * триггер показывал «10 мар 2026 — 01 мар 2026», календарь не подсвечивал
 * ничего, а подпись снизу через `periodLength` уверенно сообщала «1 день».
 */
test("an inverted range from the address shows the placeholder", () => {
  render(
    <DateRangePicker
      value={{ start: "2026-03-10", end: "2026-03-01" }}
      onChange={() => {}}
      placeholder="Pick a period"
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Pick a period");
});

test("a correct range is still shown", () => {
  render(
    <DateRangePicker
      value={{ start: "2026-03-01", end: "2026-03-10" }}
      onChange={() => {}}
      placeholder="Pick a period"
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).not.toContain("Pick a period");
});

/**
 * Пресет подрезается по границам поля.
 *
 * `resolvePeriod` считает от «сегодня» и отдавал результат в `onChange` без
 * сверки: ограничения применялись только к календарю, и «365 дней» уезжали за
 * `minValue` — наружу шёл диапазон, который в календаре выбрать нельзя вовсе.
 */
test("a preset is clamped to minValue", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <DateRangePicker
      value={null}
      onChange={onChange}
      placeholder="Pick a period"
      minValue={parseDate("2026-01-01")}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  await user.click(screen.getByRole("button", { name: "Year" }));

  const [range] = onChange.mock.calls.at(-1) ?? [];
  expect((range as { start: string }).start >= "2026-01-01").toBe(true);
});

/**
 * Пресет, целиком выпавший за границы, не выдаёт перевёрнутый диапазон.
 *
 * `clampRange` двигал концы независимо: при `minValue` первого числа текущего
 * месяца «прошлый месяц» уезжал наружу как `{start: "2026-09-01", end:
 * "2026-08-31"}` — заведомо невозможное значение, которое потребитель писал в
 * адрес и в запрос. Триггер при этом показывал подпись пресета, календарь не
 * подсвечивал ничего, а подпись длины гасилась `empty:hidden`: наружу ушло
 * невозможное, а на экране всё выглядело выбранным.
 */
test("a preset entirely outside the bounds is not reported at all", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  // Данные доступны только с первого числа текущего месяца.
  const firstOfThisMonth = `${new Date().toISOString().slice(0, 7)}-01`;

  render(
    <DateRangePicker
      value={null}
      onChange={onChange}
      placeholder="Pick a period"
      minValue={parseDate(firstOfThisMonth)}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  await user.click(screen.getByRole("button", { name: "Last month" }));

  for (const [range] of onChange.mock.calls) {
    const { start, end } = range as { start: string; end: string };
    expect(start <= end).toBe(true);
  }
});
