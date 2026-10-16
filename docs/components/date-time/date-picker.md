---
component: DatePicker
exports: [DatePicker, formatDate]
category: date-time
status: stable
source: src/components/date-time/DatePicker.tsx
story: src/components/date-time/DatePicker.stories.tsx
---

# DatePicker

## Кратко для AI

`DatePicker` — готовый триггер + поповер для одной календарной даты. Значение, которое компонент принимает и отдаёт, — ISO `ГГГГ-ММ-ДД`, а не JS `Date`, поэтому часовой пояс не сдвигает дату.

## Когда использовать

- В форме нужен один день с компактным триггером и календарём.
- API, URL или состояние уже используют ISO-строки.

## Когда не использовать

- Для произвольного размещения сетки используйте `Calendar`.
- Для даты и времени вместе используйте `DateTimePicker`; для периода — `DateRangePicker`.

## Минимальный пример

```tsx
<DatePicker value={publishDate} onChange={setPublishDate} minValue="2026-03-09" />
```

## Public API

- `value?: string | null`; `onChange(date: string)` получает ISO-строку после выбора.
- `minValue`, `maxValue`, `isDateUnavailable` ограничивают выбор в календаре; это ограничение интерфейса, серверную валидацию не отменяет.
- `minValue` и `maxValue` — ISO-строки `ГГГГ-ММ-ДД`, как и `value`: `minValue="2026-03-09"`, импортировать `@internationalized/date` не нужно (сам пакет приезжает с китом). Объект `@internationalized/date` по-прежнему принимается. Неразбираемая строка считается незаданной границей. `isDateUnavailable` получает объект календаря: `date.toString()` возвращает день строкой `ГГГГ-ММ-ДД`.
- У `DateTimePicker` эти границы календарные, то есть дневные: подробности — в [DateTimePicker](date-time-picker.md#public-api).
- `placeholder`, `disabled`, `locale`, `triggerClassName` настраивают контрол.
- `formatDate(isoDate, locale?)` — публичная утилита для того же безопасного отображения календарной ISO-даты; не используйте `new Date("YYYY-MM-DD")`, если дата — не момент UTC.

## Доступность и клавиатура

- **Пояснение и ошибка `FormField` объявляются вместе с полем.** Описание
  приходит контекстом, `aria-describedby` ставится на триггер; значение
  `aria-describedby` потребителя не вытесняется, а сливается с ним. До версии 3.0.0 семьи react-aria
  описание формы не забирали — на экране оно было, скринридеру не доставалось
  (ADR-0031).
- Поповер использует `Calendar` с его контрактом сетки и клавиатуры; при выборе закрывается.
- Внешнюю подпись связывайте через `FormField` и `htmlFor`, только когда триггер к ней привязан в вашей композиции; не полагайтесь на плейсхолдер.
- См. `src/components/date-time/DatePicker.tsx`, `src/components/date-time/DatePicker.stories.tsx`, `tests/matrix.tsx`.
