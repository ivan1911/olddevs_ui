---
component: SearchControl
exports: [SearchControl]
category: inputs
status: stable
source: src/components/inputs/SearchControl.tsx
story: src/components/inputs/SearchControl.stories.tsx
---

# SearchControl

## Кратко для AI

`SearchControl` — управляемое поле поиска поверх `TextControl`: лупа, доступное имя, очистка и необязательная экранная клавиатура. Он не откладывает запросы (debounce) и не перехватывает Escape.

## Когда использовать

- Поиск по списку, библиотеке или API с единым визуальным контрактом.
- Нужна кнопка очистки, возвращающая фокус в поле.
- На широком экране (от `md`) нужна экранная клавиатура `Keyboard` через проп `keyboard`.

## Когда не использовать

- Для обычного текста — `TextControl`.
- Для выбора из списка вариантов — `Combobox`; для фильтрации закрытого списка — searchable `Select`.
- Общую debounce-политику задавайте в потребителе, а не здесь.

## Минимальный пример

```tsx
<SearchControl
  label="Поиск коллекций"
  value={query}
  onChange={setQuery}
  placeholder="Найти коллекцию…"
/>
```

## Public API

- `value`, `onChange(string)`, `label` обязательны. `placeholder` не заменяет `label`.
- `clearable` по умолчанию true; `clearLabel`, `shellClassName` и native input props доступны.
- `keyboard` требует `layout` и `onLayoutChange`; `defaultOpen` действует только на первоначальное раскрытие, `onSubmit` вызывается экранной клавиатурой.

## Ступень высоты

`size` пробрасывается в `TextControl`: `md` — 42 пикселя (умолчание), `sm` — 36,
как высота `Button size="md"` и пилюли `Select` в той же строке панели.

Ступень живёт у `TextControl`, а не здесь. Поиск намеренно стоит на нём, и своя
высота у поиска означала бы второй способ считать её внутри самого пакета —
ровно то расхождение, ради которого `SearchControl` и заведён.

## Доступность и клавиатура

- Escape намеренно проходит к родительскому оверлею; добавьте свой `onKeyDown`, чтобы очищать запрос.
- Кнопка экранной клавиатуры скрыта до `md`; щелчок мышью по панели клавиатуры возвращает каретку в поле.
- Источник: `src/components/inputs/SearchControl.tsx`; проверки — `tests/search-control.test.tsx`.
