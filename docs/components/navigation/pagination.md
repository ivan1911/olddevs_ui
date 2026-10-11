---
component: Pagination
exports: [Pagination, pageRange]
category: navigation
status: stable
source: src/components/navigation/Pagination.tsx
story: src/components/navigation/Pagination.stories.tsx
---

# Pagination

## Кратко для AI

`Pagination` — controlled pagination для уже разбитой на страницы коллекции.
Она принимает 1-based `page`, вызывает `onChange` с 1-based номером и не
рендерится при `pageCount <= 1`. `pageRange` — чистый helper для того же
правила отображения номеров.

## Когда использовать

- Серверная или локальная выдача с известным числом страниц.
- Нужны переходы на соседнюю, первую и последнюю страницы и компактный диапазон номеров вокруг текущей.

## Когда не использовать

- Для бесконечной ленты или «Загрузить ещё».
- Для навигации по шагам формы используйте `Stepper`.
- Не показывайте pagination, когда pageCount неизвестен или всегда равен 1.

## Минимальный пример

```tsx
<Pagination page={page} pageCount={result.pageCount} onChange={setPage} />
```

## Public API

Нужны `page`, `pageCount`, `onChange`. `siblings` определяет количество соседей
слева и справа от current page и по умолчанию равен 1. `className` и `aria-label` доступны;
имя nav по умолчанию «Страницы». Если передан неверный `page`, компонент ограничивает
текущий номер диапазоном от 1 до `pageCount`, а `onChange` получает номер соседней
страницы, посчитанный от зажатого `page`.
`pageRange(page, pageCount, siblings)` возвращает массив `(number | "gap")[]`;
он всегда оставляет первую и последнюю страницы и не скрывает ровно одну страницу
за многоточием.

## Доступность и клавиатура

Это `nav` с обычными button: Tab проходит по каждому доступному действию.
Текущая страница имеет `aria-current="page"`; prev/next имеют доступные имена и
disabled на границах. Многоточие скрыто от скринридера и не кликабельно.
См. [исходник Pagination](../../../src/components/navigation/Pagination.tsx).

## Хорошие примеры

- Сбрасывать `page` в 1 при изменении фильтра на стороне приложения.
- Передать `siblings={2}` для длинного списка, где нужно показывать больше соседних страниц.
- Использовать `pageRange` лишь для собственного представления с теми же правилами.

## Антипаттерны

- 0-based `page` или `onChange`.
- Кликабельные многоточия, которые ничего не раскрывают.
- Выводить pagination для единственной страницы.

## Связанные исходники и Storybook

- `src/components/navigation/Pagination.tsx`
- `src/components/navigation/Pagination.stories.tsx`
