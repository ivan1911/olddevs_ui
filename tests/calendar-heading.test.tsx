import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { Calendar } from "../src/components/date-time/Calendar.js";
import { RangeCalendar } from "../src/components/date-time/RangeCalendar.js";

/*
  Заголовок календаря — `formatRange` из Intl внутри react-aria, а Intl у
  сервера и у браузера разный: ICU в Node ставит вокруг тире тонкие пробелы
  (U+2009), Chrome — обычные. Отрисованный на сервере `RangeCalendar` с двумя
  месяцами не проходил гидратацию (React #418, OLDSUI-171). Тест идёт в Node —
  там, где тонкие пробелы и появляются.
*/
const THIN_SPACES = /[\u2009\u202f]/;

/** Класс точки «сегодня» под числом. */
const TODAY_MARK = "after:size-[3px]";

function heading(html: string): string {
  return /<h2[^>]*aria-hidden="true"[^>]*>([^<]*)<\/h2>/.exec(html)?.[1] ?? "";
}

test("the two-month RangeCalendar heading uses plain spaces on the server", () => {
  const html = renderToString(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      months={2}
      defaultFocusedValue={parseDate("2026-03-01")}
    />
  );
  expect(heading(html)).toBe("March – April 2026");
  expect(heading(html)).not.toMatch(THIN_SPACES);
});

/*
  «Сегодня» на сервере неизвестно: статику собирают в другой день и в другом
  часовом поясе, и точка под числом в HTML стояла бы не на том дне, что у
  читателя. Точку ставит браузер после монтирования.
*/
test("the server HTML marks no day as today", () => {
  const month = today(getLocalTimeZone());
  for (const calendar of [
    <Calendar key="day" aria-label="Day" defaultFocusedValue={month} />,
    <RangeCalendar key="range" aria-label="Period" defaultFocusedValue={month} />,
  ])
    expect(renderToString(calendar)).not.toContain(TODAY_MARK);
});
