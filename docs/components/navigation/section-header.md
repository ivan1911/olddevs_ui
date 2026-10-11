---
component: SectionHeader
exports: [SectionHeader]
category: navigation
status: stable
source: src/components/navigation/SectionHeader.tsx
story: src/components/navigation/SectionHeader.stories.tsx
---

# SectionHeader

## Кратко для AI

`SectionHeader` — heading внутри section или card: title слева, вспомогательный
узел `right` справа. Семантический `level` выбирайте по иерархии документа
независимо от визуального `size`.

## Когда использовать

- Заголовок блока внутри страницы или карточки, рядом со счётчиком, ссылкой,
  переключателем периода или небольшой кнопкой.
- Требуется настоящий h2/h3/h4, а не стилизованный div.

## Когда не использовать

- Для единственного `h1` страницы используйте `PageHeader`.
- Для шапки модального окна используйте `ModalHeader`.
- Не используйте `size` для исправления логической иерархии heading.

## Минимальный пример

```tsx
<SectionHeader title="Состав публикации" level={2} right={<Button size="sm">Добавить</Button>} />
```

## Public API

`title` обязателен и может быть ReactNode. `right` содержит готовый ReactNode
для action/status. `size` — `sm` или `md` (умолчание): это только кегль.
`level` — `2 | 3 | 4`, по умолчанию 3; он определяет фактический HTML heading.
Компонент также принимает native `div` props и ref; нативный `title` от `div` исключён.

## Доступность и клавиатура

Выберите `level` по предыдущему heading: сразу после `PageHeader` (`h1`) обычно
нужен `level={2}`; h3 по умолчанию подходит для section внутри другого раздела.
Не меняйте level ради меньшего текста: используйте `size`. У `right` нет
особой обработки клавиатуры — вложенные контролы обязаны быть доступны сами.
См. [исходник SectionHeader](../../../src/components/navigation/SectionHeader.tsx).

## Хорошие примеры

- `level={2}` под `PageHeader`, затем `level={3}` в карточке.
- `right` со ссылкой, маленьким `Button` или нейтральными метаданными.
- `title` с иконкой и текстом как ReactNode без вложенного heading.

## Антипаттерны

- Оставить h3 сразу под h1 только потому, что это default.
- Вложить `<h2>` в `title` и получить heading внутри heading.
- Использовать `SectionHeader` как компонент раскладки страницы.

## Связанные исходники и Storybook

- `src/components/navigation/SectionHeader.tsx`
- `src/components/navigation/SectionHeader.stories.tsx`
