---
component: Combobox
exports: [Combobox]
category: inputs
status: stable
source: src/components/inputs/Combobox.tsx
story: src/components/inputs/Combobox.stories.tsx
---

# Combobox

## Кратко для AI

`Combobox` сочетает свободный текстовый ввод со списком вариантов. Выбор из списка помогает, но значение может не совпадать с `items`; это принципиально отличает его от `Select`.

## Когда использовать

- Пользователь может ввести новый тег, адрес, название или другой допустимый текст.
- Нужен список вариантов и фильтрация во время набора.

## Когда не использовать

- Нужен строго закрытый словарь — `Select`, в том числе с `searchable`.
- Нужен ввод нескольких тегов — `TagInput`.

## Минимальный пример

```tsx
<Combobox
  aria-label="Город"
  items={[{ id: "msk", label: "Москва" }]}
  inputValue={city}
  onInputChange={setCity}
  allowsCustomValue
/>
```

## Public API

- `items` — массив `{ id, label, meta? }`; `meta` выводится правой колонкой.
- Остальные поддерживаемые пропы наследуются от React Aria ComboBox: используйте controlled `inputValue`/`onInputChange`, `selectedKey`/`onSelectionChange`, только когда это нужно сценарию.
- `menuTrigger` по умолчанию `focus`, чтобы список вариантов был виден при входе в поле; `notFoundText` настраивает пустой список.
- `placeholder` относится к полю, `className` — к корню.

## Доступность и клавиатура

- **Пояснение и ошибка `FormField` объявляются вместе с полем.** Описание
  приходит контекстом, `aria-describedby` ставится на поле ввода; переданный
  потребителем `aria-describedby` не заменяется, а дополняется описанием формы.
  До версии кита 3.0.0 компоненты на react-aria описание формы не забирали — на экране оно было, скринридеру не доставалось
  (ADR-0031).
- Поведение combobox, фильтрацию и `aria-activedescendant` берёт на себя React Aria.
- **Внутри `Dialog` и `Drawer` вариант выбирается мышью.** Список живёт в
  портале react-aria под `<body>`, у которого модальный слой Radix отключает
  указатель; кит возвращает его оверлею правилом в `@olddevs/ui/styles.css`.
  До этой починки вариант выбирался только с клавиатуры.
- Передайте доступное имя через `aria-label` либо связанный label.
- См. `src/components/inputs/Combobox.tsx`, `src/components/inputs/Combobox.stories.tsx`, `tests/combobox.test.tsx`.
