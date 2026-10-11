---
component: Chip
exports: [Chip]
category: actions
status: stable
source: src/components/actions/Chip.tsx
story: src/components/actions/Chip.stories.tsx
---

# Chip

## Кратко для AI

`Chip` — компактная кнопка-фильтр. Его `selected` — управляемое состояние, оно объявляется через `aria-pressed`; компонент не хранит выбор сам.

## Когда использовать

- Нужен короткий фильтр, тег действия или переключаемая категория.
- Нужен необязательный счётчик рядом с короткой подписью.

## Когда не использовать

- Для статуса сущности используйте `StatusBadge`; для простого числового маркера — `Badge`.
- Для нескольких согласованных вариантов используйте `ToggleGroup` или `Segmented`.
- Для декоративного тега без действия не используйте `Chip`: это кнопка.

## Минимальный пример

```tsx
<Chip selected={filters.includes("ready")} onClick={() => toggleFilter("ready")} count={12}>
  Готово
</Chip>
```

## Public API

- `selected` по умолчанию `false`; `tone` окрашивает только выбранный chip.
- `size`: `sm` или `md`; `count={0}` показывается, `null` и `undefined` — нет.
- `iconOnly` скрывает видимую подпись, но оставляет её для скринридера; `mobileIconOnly` скрывает подпись только на экранах меньше 640 пикселей (брейкпоинт `sm`).
- По умолчанию `type="button"`; нативные атрибуты `button` передаются элементу.

## Доступность и семантика

- Всегда передавайте `children` для icon-only и mobile-only вариантов: это имя кнопки.
- Не используйте цвет как единственный сигнал — состояние сообщается `aria-pressed`.
- См. `src/components/actions/Chip.tsx`, `src/components/actions/Chip.stories.tsx`.
