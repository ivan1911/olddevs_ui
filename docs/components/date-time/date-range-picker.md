---
component: DateRangePicker
exports: [DateRangePicker]
category: date-time
status: stable
source: src/components/date-time/DateRangePicker.tsx
story: src/components/date-time/DateRangePicker.stories.tsx
---

# DateRangePicker

## Кратко для AI

`DateRangePicker` — готовый выбор периода: триггер, `RangeCalendar`, относительные пресеты и отдельная очистка. `onChange` вызывается только после выбора обеих границ.

## Когда использовать

- В фильтре или отчёте выбирают даты «с/по» и часто используют «7 дней», «30 дней» и другие пресеты.
- Потребитель может хранить и развёрнутый `DateRange`, и исходный `RelativePeriod`.

## Когда не использовать

- Для произвольной раскладки периода используйте `RangeCalendar`.
- Для одной даты используйте `DatePicker`.
- Не используйте для выбора только начала периода: компонент отдаёт только полный диапазон.

## Минимальный пример

```tsx
<DateRangePicker
  value={range}
  period={period}
  onChange={(nextRange, nextPeriod) => {
    setRange(nextRange);
    setPeriod(nextPeriod);
  }}
  onClear={() => {
    setRange(null);
    setPeriod(null);
  }}
/>
```

## Public API

- `value?: DateRange | null`, где границы — ISO-строки; `period?: RelativePeriod | null` связывает выбранный пресет с диапазоном.
- `onChange(range, period)` получает `period=null` при ручном выборе; `onClear` обязателен для появления кнопки очистки, потому что очистка должна сбросить оба значения: `value` и `period`.
- `presets`, `timeZone`, `minValue`, `maxValue`, `defaultFocusedValue`, `locale` задают допустимые и относительные периоды.
- `minValue`, `maxValue` и `defaultFocusedValue` — ISO-строки `ГГГГ-ММ-ДД`, как `value`: `minValue="2026-03-09"`, импортировать `@internationalized/date` не нужно (сам пакет приезжает с китом). Объект по-прежнему принимается; неразбираемая строка считается незаданной границей.
- `isDateUnavailable(date)` отмечает конкретные дни недоступными — занятые даты, праздники: в календаре они зачёркнуты и не выбираются. Функция получает объект календаря: `date.toString()` возвращает день строкой `ГГГГ-ММ-ДД`. Такое же свойство есть у `RangeCalendar` и `DatePicker`. Пресеты правило не учитывают: они подрезаются только по `minValue` и `maxValue`, а пресет, захвативший недоступный день, выбирается как есть — если так нельзя, не оставляйте такой пресет в `presets`.
- `open`/`onOpenChange` позволяют управлять открытием поповера, иначе используется внутреннее состояние.

## Доступность и клавиатура

- Очистка — отдельная кнопка рядом с триггером, а не интерактивный элемент внутри кнопки.
- Два месяца показываются при ширине экрана от 640 пикселей; не полагайтесь на незавершённый выбор для сетевого запроса.
- Источники: `src/components/date-time/DateRangePicker.tsx`, `src/components/date-time/DateRangePicker.stories.tsx`.
