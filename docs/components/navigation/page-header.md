---
component: PageHeader
exports: [PageHeader]
category: navigation
status: stable
source: src/components/navigation/PageHeader.tsx
story: src/components/navigation/PageHeader.stories.tsx
---

# PageHeader

## Кратко для AI

`PageHeader` — единственная шапка страницы с `h1`, опциональным пояснением и
узлами действий. Используйте один раз на page; не выбирайте размер — у компонента
нет и не должно быть шкалы размеров.

## Когда использовать

- Верх страницы с главным заголовком.
- Рядом нужны основные действия: создать, загрузить, открыть фильтры.
- На mobile действия могут переноситься под заголовок автоматически.

## Когда не использовать

- Для заголовка внутри card/section используйте `SectionHeader`.
- Для title модального окна используйте `Dialog`/`ModalHeader`.
- Не используйте несколько `PageHeader` на одной семантической странице.

## Минимальный пример

```tsx
<PageHeader
  title="Библиотека"
  subtitle="3 527 фото"
  actions={<Button tone="accent">Загрузить</Button>}
/>
```

## Public API

`title` обязателен и принимает `ReactNode`; он рендерится в `h1`. `subtitle` и
`actions` также ReactNode. Компонент принимает остальные native `div` props,
включая `className` и `ref`; native `title` prop намеренно исключён, чтобы не
конфликтовать с обязательным heading. На desktop шапка располагает содержимое
по строке, в узкой раскладке — колонкой; actions могут переноситься.

## Доступность и клавиатура

Заголовок всегда `h1`, поэтому текст `title` должен быть названием текущей
страницы, а не глаголом действия. каждое действие в `actions` должно быть доступным
контролом само по себе; `PageHeader` не добавляет им aria-label или обработчики. См.
[исходник PageHeader](../../../src/components/navigation/PageHeader.tsx).

## Хорошие примеры

- `title` как текст или иконка с текстом в одном ReactNode.
- Основное действие в `actions`, вторичные действия рядом.
- `subtitle` с количеством или коротким пояснением страницы.

## Антипаттерны

- `title` с вложенным heading, хотя `PageHeader` уже создаёт `h1`.
- Подменять `PageHeader` title через DOM `title` attribute.
- Использовать actions как место для несвязанной глобальной навигации.

## Связанные исходники и Storybook

- `src/components/navigation/PageHeader.tsx`
- `src/components/navigation/PageHeader.stories.tsx`
