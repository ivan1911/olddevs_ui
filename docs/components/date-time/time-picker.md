---
component: TimePicker
exports: [TimePicker, upcomingSlots]
category: date-time
status: stable
source: src/components/date-time/TimePicker.tsx
story: src/components/date-time/TimePicker.stories.tsx
---

# TimePicker

## Кратко для AI

`TimePicker` — поле времени с маской и списком ближайших слотов. Значение, которое компонент принимает и отдаёт, — строка `HH:MM`; ввод нормализуется на blur или подтверждение. Пустое поле пустым и остаётся: с 3.6.0 уход фокуса из него не подставляет `00:00`.

## Когда использовать

- Пользователь может быстро напечатать точное время или выбрать удобный слот.
- Время хранится отдельно от календарной даты, например в `DateTimePicker`.

## Когда не использовать

- Для полного момента времени с датой используйте `DateTimePicker`.
- Для свободной строки, не обязательно времени, используйте `TextControl`.

## Минимальный пример

```tsx
<TimePicker value={time} onChange={setTime} step={30} aria-label="Время публикации" />
```

## Public API

- `value?: string | null`; `onChange(time: string)` обязателен; `step` по умолчанию 30 минут.
- `hourCycle?: 12 | 24` — часы поля и списка; по умолчанию `24` (`14:30`). При `12` поле и слоты
  показывают `2:30 PM`, печатать можно `230p` или `2:30 PM`, а набранное 24-часовое время
  (`14:30`) тоже принимается. Это только показ и ввод: `value` и `onChange` остаются `HH:MM`.
  Подписи `AM` и `PM` и маска `h:mm AM` берутся из каталога (`timePicker.am`, `timePicker.pm`,
  `timePicker.placeholder12`). Если период не набран, берётся период прежнего значения, а у
  пустого поля — `AM`.
- `placeholder` и `aria-label` берутся из каталога сообщений (`timePicker.placeholder`,
  `timePicker.label`): без провайдера это `HH:MM` и «Time», с `@olddevs/ui/locales/ru` —
  `ЧЧ:ММ` и «Время». Проп переопределяет каталог точечно. `disabled`, `className` доступны.
- `invalid` показывает поле в состоянии ошибки: линия под временем краснеет (и в фокусе тоже), на поле ставится `aria-invalid`. Правило проверки остаётся у потребителя. Внутри `FormField` с `error` проп не нужен: признак приходит из формы, как у `TextControl` и `NumberInput`, а явный `invalid={false}` его снимает. Пояснение и ошибка формы ещё и объявляются с полем — их `id` уходит в `aria-describedby`.
- `upcomingSlots(step, now)` — публичная утилита, которая возвращает полный суточный список, начиная с ближайшего будущего слота. Она полезна для представления, но это не UI-компонент.

## Доступность и клавиатура

- Поле ввода имеет семантику combobox; фокус остаётся в поле, а список сообщает активный слот через `aria-activedescendant`.
- Стрелки вниз и вверх ходят по слотам, Enter выбирает слот или подтверждает введённый текст, Escape закрывает список и продолжает всплытие к родительскому оверлею.
- Источники: `src/components/date-time/TimePicker.tsx`, `src/components/date-time/TimePicker.stories.tsx`, `tests/timepicker.test.tsx`.
