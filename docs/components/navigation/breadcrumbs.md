---
component: Breadcrumbs
exports: [Breadcrumbs]
category: navigation
status: stable
source: src/components/navigation/Breadcrumbs.tsx
story: src/components/navigation/Breadcrumbs.stories.tsx
---

# Breadcrumbs

## Кратко для AI

`Breadcrumbs` показывает путь до текущей страницы. Передайте цепочку `items`;
последний видимый crumb становится текущей страницей, а не ссылкой. Длинный
путь автоматически сворачивается в первый crumb, многоточие и последние два;
цепочка из трёх crumb и короче не сворачивается ни при каком `maxItems`.

## Когда использовать

- Глубокая иерархия, где пользователю полезно быстро вернуться к родителю.
- У каждого уровня пути уже есть свой URL.

## Когда не использовать

- Для линейного мастера используйте `Stepper`.
- Для короткой верхнеуровневой навигации используйте links или `Tabs`.
- Не используйте как единственное имя текущей страницы: нужен page heading.

## Минимальный пример

```tsx
<Breadcrumbs
  items={[
    { label: "Библиотека", href: "/library" },
    { label: "Коллекции", href: "/collections" },
    { label: "Закаты" },
  ]}
/>
```

## Public API

`items` обязателен: `Crumb` имеет `label` и опциональный `href`. Обычно у
последнего crumb нет `href`; даже если он передан, последний видимый crumb
всё равно рендерится не ссылкой. `maxItems` равен 4 по умолчанию; `className`
и `aria-label` передаются контейнеру. Без `aria-label` имя берётся из каталога
сообщений (`breadcrumbs.label`) — см. [i18n](../../i18n.md).

## Доступность и клавиатура

Компонент создаёт `nav` с упорядоченным списком; текущий crumb имеет
`aria-current="page"`. Многоточие — не ссылка и скрыто от скринридера.
Ссылки остаются обычными keyboard-focusable links. См.
[исходник Breadcrumbs](../../../src/components/navigation/Breadcrumbs.tsx).

## Хорошие примеры

- Каждому предку назначить `href`, а текущему crumb — только `label`.
- Уменьшить `maxItems`, когда в header мало места по ширине (цепочку из трёх crumb и короче это не сворачивает).
- Использовать короткие labels, которые остаются понятны при truncate.

## Антипаттерны

- Делать последний crumb ссылкой на текущий URL.
- Делать многоточие кнопкой, если скрытые уровни нельзя раскрыть.
- Передавать пустую цепочку вместо того, чтобы не выводить breadcrumbs.

## Связанные исходники и Storybook

- `src/components/navigation/Breadcrumbs.tsx`
- `src/components/navigation/Breadcrumbs.stories.tsx`
