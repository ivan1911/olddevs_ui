---
component: NumberInput
exports: [NumberInput]
category: inputs
status: stable
source: src/components/inputs/NumberInput.tsx
story: src/components/inputs/NumberInput.stories.tsx
---

# NumberInput

## Кратко для AI

`NumberInput` — управляемое числовое поле с кнопками шага. Пустое поле возвращает `null`, а не `0` и не `NaN`.

## Когда использовать

- Нужен числовой ввод с `min`, `max`, `step` или форматированием `Intl.NumberFormat`.
- В форме требуется поле с доступным именем и шагами «меньше/больше».

## Когда не использовать

- Для свободного текстового идентификатора или кода — `TextControl`; для телефона есть `PhoneInput`.
- Для непрерывного выбора на визуальной шкале — `Slider`/`RangeSlider`.

## Минимальный пример

```tsx
<NumberInput
  label="Лимит публикаций"
  value={limit}
  onChange={setLimit}
  min={0}
  max={100}
  step={1}
/>
```

## Public API

- `value` и `onChange` обязательны; значение `null` означает пустой input.
- `label` обязателен и связывает имя с внутренним React Aria input; обёртка `FormField` этого не заменяет.
- `formatOptions` передаётся в `Intl.NumberFormat`; `invalid` только показывает невалидное состояние, правило проверки остаётся у потребителя. Внутри `FormField` с `error` признак приходит из формы сам; явный `invalid={false}` его снимает.
- `shellClassName` относится к рамке, `className` — к корневому NumberField.

## Валюта — это `NumberInput`, а не отдельный компонент

`CurrencyInput` в ките **не существует**, и это решение
(ADR-0024), а не
пробел. Валютное поле — это `formatOptions`:

```tsx
<NumberInput
  label="Сумма"
  value={amount}
  onChange={setAmount}
  formatOptions={{ style: "currency", currency: "RUB" }}
/>
```

`Intl.NumberFormat` внутри react-aria форматирует валюту, разбирает ввод и
берёт разделители разрядов и десятичный знак **из локали**: в `ru-RU` это
`1 234,56 ₽`, в `en-US` — `$1,234.56`. Отдельный компонент был бы
обёрткой без собственной логики, вроде `ThemeSwitcher` над `Segmented`.

Проценты и единицы измерения тоже даёт `Intl.NumberFormat`:

```tsx
<NumberInput label="Скидка" formatOptions={{ style: "percent" }} />
<NumberInput label="Вес" formatOptions={{ style: "unit", unit: "kilogram" }} />
```

Маска здесь не помощник: `MaskedInput` зашил бы разделители намертво, и в
другой локали поле показывало бы формат другой локали.

## Доступность и форма

- Кнопки шага автоматически получают имена от `label`.
- Не превращайте пустоту в ноль: это меняет смысл данных.
- Источник: `src/components/inputs/NumberInput.tsx`; проверки — `tests/number-input.test.tsx`.
