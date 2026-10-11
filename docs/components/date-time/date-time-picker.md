---
component: DateTimePicker
exports: [DateTimePicker, maskTime, normalizeTime]
category: date-time
status: stable
source: src/components/date-time/DateTimePicker.tsx
story: src/components/date-time/DateTimePicker.stories.tsx
---

# DateTimePicker

## Кратко для AI

`DateTimePicker` собран из `DatePicker` и `TimePicker`. Потребитель хранит дату и время отдельно: ISO-дата без часового пояса и строка времени `HH:MM`.

## Когда использовать

- Нужен пользовательский ввод даты и времени публикации/события как два независимых значения.
- Нужны единые ограничения календарной даты и выключенное состояние.

## Когда не использовать

- Для одного дня без времени используйте `DatePicker`.
- Для произвольной раскладки календаря составьте `Calendar` и `TimePicker` самостоятельно.
- Не трактуйте результат как готовый UTC timestamp: часовой пояс и серверная конвертация принадлежат домену.

## Минимальный пример

```tsx
<DateTimePicker date={date} onDateChange={setDate} time={time} onTimeChange={setTime} />
```

## Public API

- Контракт состоит из `date`, `onDateChange`, `time`, `onTimeChange`; также `minValue`, `maxValue` (календарные, дневные границы), `disabled`, `hourCycle` (`12` или `24`, как у `TimePicker`), `locale` и `timeZoneLabel` (подпись зоны справа от времени).
- Границы `minValue` и `maxValue` **календарные, то есть дневные**: ячейки календаря — даты без времени, и сравнение идёт по дню. `minValue={…T14:00}` в смысле «не раньше чем через час» не сработает — тот же день с девятью утра пройдёт. Границ времени компонент не принимает: «не раньше чем через час» зависит от часового пояса, которого кит не знает, и от момента отправки, а не отрисовки. Это правило потребителя.
- `maskTime(value)` — public helper, приводящий ввод к виду `HH:MM`; `normalizeTime(value, fallback)` нормализует допустимое время. Это helpers, не компоненты.
- Используйте строгие API даты и времени, а не соединяйте их в `Date` на UI-границе.

## Доступность и клавиатура

- Дочерние поля сохраняют своё доступное имя и клавиатурное поведение.
- См. `src/components/date-time/DateTimePicker.tsx`, `src/components/date-time/DateTimePicker.stories.tsx`, `tests/matrix.tsx`.
