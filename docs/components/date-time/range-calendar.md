---
component: RangeCalendar
exports: [RangeCalendar]
category: date-time
status: stable
source: src/components/date-time/RangeCalendar.tsx
story: src/components/date-time/RangeCalendar.stories.tsx
---

# RangeCalendar

## Кратко для AI

`RangeCalendar` — building block для одного непрерывного диапазона React Aria `DateValue`. Его `onChange` срабатывает только для завершённого периода; он не заменяет готовый `DateRangePicker` с триггером и пресетами.

## Когда использовать

- Нужна нестандартная композиция календаря периода внутри собственной панели.
- Нужен один или два видимых месяца (`months={1 | 2}`) и все ограничения React Aria.

## Когда не использовать

- Для стандартного поля выбора периода с пресетами и очисткой используйте `DateRangePicker`.
- Для одной даты используйте `Calendar`/`DatePicker`.

## Минимальный пример

```tsx
<RangeCalendar value={range} onChange={setRange} months={2} locale="ru-RU" />
```

## Public API

- Наследует `RangeCalendarProps<DateValue>` React Aria: controlled `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, unavailable dates.
- Пустое controlled значение передаётся как `null`.
- **Период — объекты или ISO-строки.** `value` и `defaultValue` принимают `{ start, end }`, где границы — объекты `@internationalized/date` или строки `ГГГГ-ММ-ДД` (строки такие же, как `DateRange` у `DateRangePicker`). `minValue`, `maxValue` и `defaultFocusedValue` тоже принимают строку: `minValue="2026-03-09"`, импортировать `@internationalized/date` не нужно (сам пакет остаётся peer-зависимостью кита). Неразбираемая строка не бросает исключение: период с такой границей считается пустым (половина диапазона выбранной не бывает), граница — незаданной.
- `onChange(range, iso)` вызывается, когда выбраны обе границы. Первый аргумент — `{ start, end }` объектов календаря, как у React Aria (так было всегда), второй — тот же период парой ISO-строк, тот самый `DateRange`. Хранящему период строками достаточно `onChange={(_, iso) => setRange(iso)}`. Что получает `onChange`, не зависит от того, объектами или строками передан `value`: прежние вызовы с объектами работают без правок.
- `isDateUnavailable` получает объект календаря: `date.toString()` возвращает день строкой `ГГГГ-ММ-ДД`.
- `months` по умолчанию 1, допустимы 1 и 2; без `locale` локаль приходит сверху: от `UiProvider`, `I18nProvider` потребителя или браузера; `locale` перебивает её для этого календаря.
- Отрисованный на сервере календарь проходит гидратацию. Заголовок над сеткой («March – April 2026») одинаков на сервере и в браузере: `Intl` в Node ставит вокруг тире тонкие пробелы, и кит приводит их к обычным. Точку «сегодня» ставит браузер после монтирования: сервер не знает, какой день у читателя, поэтому первый кадр рисуется без точки.

## Доступность и клавиатура

- React Aria управляет диапазонным выбором, семантикой сетки и клавиатурой.
- Начало и конец диапазона отличаются от середины визуально; не заменяйте произвольными классами ячеек.
- См. `src/components/date-time/RangeCalendar.tsx`, `src/components/date-time/RangeCalendar.stories.tsx`, `tests/matrix.tsx`.
