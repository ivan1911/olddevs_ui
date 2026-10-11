---
component: Calendar
exports: [Calendar, NAV_BUTTON_CLASS, WEEKDAY_CELL_CLASS]
category: date-time
status: stable
source: src/components/date-time/Calendar.tsx
story: src/components/date-time/Calendar.stories.tsx
---

# Calendar

## Кратко для AI

`Calendar` — низкоуровневый controlled building block для выбора одной `DateValue` из React Aria. Для готового поля формы обычно используйте `DatePicker`; `Calendar` выбирайте только для собственной композиции.

## Когда использовать

- Нужна встроенная сетка календаря с React Aria props: `value`, `defaultValue`, `onChange`, недоступные даты и ограничения.
- Требуется собственный оверлей или раскладка вокруг календаря.

## Когда не использовать

- Для обычного компактного выбора даты используйте `DatePicker`.
- Для периода с двумя границами используйте `RangeCalendar` или `DateRangePicker`.
- Не храните календарную дату как `Date`: у него есть часовой пояс. Берите `DateValue` на границе `Calendar` или ISO-строку в готовом `DatePicker`.

## Минимальный пример

```tsx
<Calendar value={date} onChange={setDate} locale="ru-RU" minValue={today(getLocalTimeZone())} />
```

## Public API

- Наследует `CalendarProps<DateValue>` React Aria, включая controlled/uncontrolled value, `minValue`, `maxValue`, `isDateUnavailable`.
- **Дата — объект или ISO-строка.** `value`, `defaultValue`, `minValue`, `maxValue` и `defaultFocusedValue` принимают и объект `@internationalized/date`, и строку `ГГГГ-ММ-ДД`, как `DatePicker`. Импортировать `@internationalized/date` для этого не нужно (сам пакет остаётся peer-зависимостью кита): `minValue="2026-03-09"`. Неразбираемая строка (`2026-02-29`, мусор из адреса) не бросает исключение: значение считается пустым, граница — незаданной.
- `onChange(value, iso)`: первый аргумент — объект календаря, как у React Aria (так было всегда), второй — тот же день ISO-строкой. Хранящему дату строкой достаточно `onChange={(_, iso) => setDate(iso)}`. Что получает `onChange`, не зависит от того, объектом или строкой передан `value`: прежние вызовы с объектами работают без правок.
- `isDateUnavailable` получает объект календаря: `date.toString()` возвращает день строкой `ГГГГ-ММ-ДД`.
- Без `locale` локаль приходит сверху: от `UiProvider`, `I18nProvider` потребителя или браузера; `locale` перебивает её для этого календаря, влияет на подписи и первый день недели; `className` относится к корню.
- `NAV_BUTTON_CLASS` и `WEEKDAY_CELL_CLASS` — публичные константы стилей для согласованной пользовательской композиции, не отдельные компоненты.

## Доступность и клавиатура

- React Aria реализует `grid`, полные доступные имена дат и клавиатурную навигацию.
- Сегодня отмечается точкой, выбранная дата — заливкой; не делайте точку и заливку единственным признаком даты в собственной вёрстке вокруг календаря: имя ячейки (полная дата) даёт React Aria.
- См. `src/components/date-time/Calendar.tsx`, `src/components/date-time/Calendar.stories.tsx`, `tests/matrix.tsx`.
