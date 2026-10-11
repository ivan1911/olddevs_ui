---
component: Accordion
exports: [Accordion, AccordionItem]
category: navigation
status: stable
source: src/components/navigation/Accordion.tsx
story: src/components/navigation/Accordion.stories.tsx
---

# Accordion

## Кратко для AI

`Accordion` — набор раскрываемых секций на react-aria. Состояние и keys
наследуются из `DisclosureGroupProps`; `multiple={false}` по умолчанию оставляет
открытой одну секцию. Создавайте каждую секцию через `AccordionItem` с
уникальным `id`.

## Когда использовать

- Длинная страница с самостоятельными разделами, которые читают по очереди.
- FAQ, настройки или подробности, когда закрытые блоки экономят вертикальное место.
- Сравнение нескольких секций одновременно — с `multiple`.

## Когда не использовать

- Для навигации между панелями одного контекста используйте `Tabs`.
- Для обязательных этапов процесса используйте `Stepper`.
- Не используйте для одной постоянной секции: обычный heading яснее.

## Минимальный пример

```tsx
<Accordion expandedKeys={expanded} onExpandedChange={setExpanded}>
  <AccordionItem id="delivery" title="Доставка">
    Условия доставки
  </AccordionItem>
  <AccordionItem id="payment" title="Оплата">
    Способы оплаты
  </AccordionItem>
</Accordion>
```

## Public API

`Accordion` принимает `multiple`, `className`, `children` и остальные
`DisclosureGroupProps` react-aria, включая controlled/uncontrolled keys. Не
передавайте `allowsMultipleExpanded`: публичный prop компонента — `multiple`.
`AccordionItem` требует `id` и `title`; также принимает `disabled`, `className`,
`children`. `id` участвует в `expandedKeys`, поэтому должен быть стабилен при ререндере.

## Доступность и клавиатура

React Aria создаёт кнопку trigger, `aria-expanded`, связь с панелью и скрывает
свёрнутый контент от скринридера. Trigger находится внутри heading, поэтому
скринридер находит секцию при навигации по заголовкам. Не рендерите второй интерактивный контрол
в `title`; поместите его в panel. См.
[исходник Accordion](../../../src/components/navigation/Accordion.tsx).

## Хорошие примеры

- Умолчание `multiple={false}` для последовательного чтения.
- `multiple` для сравнения характеристик.
- Disabled item вместо секции, удалённой без объяснения: так видно, что секция недоступна.

## Антипаттерны

- Передавать обычный `div` вместо `AccordionItem`.
- Использовать нестабильный индекс массива как `id` при изменяемом списке.
- Раскрывать все секции по умолчанию, если они не сравниваются.

## Связанные исходники и Storybook

- `src/components/navigation/Accordion.tsx`
- `src/components/navigation/Accordion.stories.tsx`
