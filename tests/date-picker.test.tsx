// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DatePicker } from "../src/components/date-time/DatePicker.js";

afterEach(cleanup);

/**
 * Значение поля живёт в адресе — так его и описывает докстрока компонента, — а
 * адрес правят руками. `parseDate` бросает и на мусоре, и на несуществующей
 * дате: `parseDate("2026-02-29")` — это `RangeError`, потому что 2026 год не
 * високосный.
 *
 * До волны 26 разбор стоял выражением в JSX-потомке, то есть выполнялся на
 * КАЖДОМ рендере независимо от того, открыт ли поповер, и одна кривая ссылка
 * роняла всё поддерево. Соседний `DateRangePicker` от этого защищён и в
 * комментарии утверждал, что `DatePicker` на том же вводе показывает
 * плейсхолдер, — утверждение было неверным.
 */
test.each(["2026-02-29", "2026-13-45", "not-a-date", "2026-09", ""])(
  "a hand-edited value %o shows the placeholder instead of bringing the tree down",
  (value) => {
    expect(() =>
      render(<DatePicker value={value} onChange={() => {}} placeholder="Choose a date" />)
    ).not.toThrow();

    expect(screen.getByRole("button").textContent).toContain("Choose a date");
  }
);

test("a valid value is still shown", () => {
  render(<DatePicker value="2026-09-11" onChange={() => {}} placeholder="Choose a date" />);

  expect(screen.getByRole("button").textContent).not.toContain("Choose a date");
});

/**
 * Годы меньше сотни.
 *
 * `parseDate` их принимает — `0026-03-05` законная ISO-строка, а из адреса
 * приходит и не такое. Сборка же шла через `new Date(y, m, d)`, где годы 0–99
 * отображаются в 1900+y по легаси-правилу: строгий разбор пропускал значение, а
 * показ всё равно врал.
 */
test.each([
  ["0026-03-05", "1926"],
  ["0099-12-31", "1999"],
])("the year %o is not silently shifted into the 20th century", (value, wrong) => {
  render(<DatePicker value={value} onChange={() => {}} placeholder="Choose a date" />);

  expect(screen.getByRole("button").textContent).not.toContain(wrong);
});
