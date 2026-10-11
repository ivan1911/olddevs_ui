---
component: Popover
exports: [Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger]
category: overlays
status: stable
source: src/components/overlays/Popover.tsx
story: src/components/overlays/Popover.stories.tsx
---

# Popover

## Кратко для AI

`Popover` — составной примитив для панели, привязанной к элементу. Он не знает
содержимого: вызывающий код задаёт trigger, контент и при необходимости anchor.
Используйте его как основание dropdown, календаря или компактной панели, а не
как самостоятельный диалог.

## Когда использовать

- Контент должен позиционироваться относительно кнопки или отдельного якоря.
- Нужны portal, закрытие по Escape и корректное позиционирование у края экрана.
- Внутри есть произвольная разметка, для которой нет готового `Select` или `Menu`.

## Когда не использовать

- Для семантического списка действий используйте `Menu`.
- Для текста при hover/focus — `Tooltip`; для превью с разметкой по наведению
  на ссылку или имя — `HoverCard`; для блокирующего окна — `Dialog`.
- Не используйте для контента, который обязан постоянно присутствовать в DOM
  страницы как часть layout.

## Минимальный пример

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button>Фильтры</Button>
  </PopoverTrigger>
  <PopoverContent>
    <FilterForm />
  </PopoverContent>
</Popover>
```

## Public API

`Popover` — Radix `Root`, принимает его controlled- и uncontrolled-пропсы.
`PopoverTrigger`, `PopoverAnchor` и `PopoverClose` — одноимённые примитивы Radix;
обычно trigger получает `asChild`, чтобы сохранить семантику `Button`. Контент
обязательно рендерьте через `PopoverContent`, а не голый Radix `Content`:
`PopoverContent` создаёт portal, имеет `align="start"` и `sideOffset={4}` по умолчанию, а также
принимает остальные props Radix (`side`, `align`, `onOpenAutoFocus` и др.).

## Доступность и клавиатура

Поведение фокуса, Escape и позиционирование делегированы Radix. Контент находится
в portal на слое выше модальных окон, поэтому не добавляйте локальные `z-index`
патчи без причины. Trigger должен быть доступным интерактивным элементом;
не превращайте произвольный `div` в trigger без роли, фокуса и имени.

## Хорошие примеры

- Кнопка фильтра + форма в `PopoverContent`.
- Отдельный `PopoverAnchor`, когда панель крепится не к trigger.
- `side="bottom" align="end"` для панели у правого края кнопки.

## Антипаттерны

- `<PopoverContent>` без `Popover`/триггера как постоянный слой.
- Дублировать `Portal` или оборачивать `Popover` в `ModalOverlay`.
- Список команд с неявной навигацией вместо `Menu`.

## Связанные исходники и Storybook

- `src/components/overlays/Popover.tsx`
- `src/components/overlays/Popover.stories.tsx`
