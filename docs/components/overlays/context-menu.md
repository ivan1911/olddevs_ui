---
component: ContextMenu
exports:
  [
    ContextMenu,
    ContextMenuCheckboxItem,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuRadioGroup,
    ContextMenuRadioItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
  ]
category: overlays
status: stable
source: src/components/overlays/ContextMenu.tsx
story: src/components/overlays/ContextMenu.stories.tsx
---

# ContextMenu

## Кратко для AI

`ContextMenu` — меню действий для правого клика и клавиши контекстного меню.
Оно использует Radix, но выглядит как `Menu`. Для обычного click-trigger меню
выбирайте `Menu`; не имитируйте правый клик вручную.

## Когда использовать

- Быстрые действия над карточкой, строкой таблицы, canvas-элементом или файлом.
- Нужно подменю либо независимый пункт-флажок.
- У trigger есть понятная цель, над которой выполняются действия.

## Когда не использовать

- Для основной видимой панели действий — `Menu` или обычные `Button`.
- Для выбора формы — `Select`/`Combobox`.
- Не открывайте контекстное меню без цели действий только ради визуального меню.

## Минимальный пример

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <Card>Файл</Card>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onSelect={edit}>Переименовать</ContextMenuItem>
    <ContextMenuItem tone="danger" onSelect={remove}>
      Удалить
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## Public API

`ContextMenu`, `ContextMenuTrigger`, `ContextMenuSub` — реэкспорты Radix
(`Root`, `Trigger`, `Sub`). `ContextMenuContent` создаёт portal и принимает `children`/
`className`. `ContextMenuItem` принимает `children`, `icon`, `shortcut`,
`tone`, `disabled`, `onSelect`, `className`. `ContextMenuCheckboxItem` добавляет
controlled `checked` и `onCheckedChange` прямо на пункте — в отличие от `Menu`.

`ContextMenuRadioGroup` и `ContextMenuRadioItem` — одиночный выбор: значение
задано на группе (`value`, `onValueChange`), пункт несёт только свой `value`.
Выбор живёт на группе именно потому, что «выбран ровно один» — свойство
группы: пункт, который не знает группу, не может проставить
`aria-checked="false"` остальным пунктам. Своей иконки у пункта выбора нет — слот занят отметкой.

`ContextMenuLabel` и `ContextMenuSeparator` оформляют структуру. Для подменю
оберните `ContextMenuSubTrigger` и `ContextMenuSubContent` в `ContextMenuSub`.
Sub-trigger принимает `children`, `icon`, `className`; sub-content — `children`
и `className`.

## Доступность и клавиатура

Radix предоставляет role, управление фокусом, выбор флажка и клавиатурный
доступ к контекстному меню. Не подменяйте `ContextMenuCheckboxItem` обычным
item с нарисованной галочкой: тогда потеряются `menuitemcheckbox` и
`aria-checked`.

То же и с одиночным выбором: список с одним отмеченным пунктом — это
`ContextMenuRadioGroup`, а не набор обычных пунктов с галочкой у текущего и не
флажки. Флажок вдобавок обещает множественный выбор, которого нет.

`shortcut` только отображается; обработка команды остаётся в
приложении. См. [исходник ContextMenu](../../../src/components/overlays/ContextMenu.tsx).

## Хорошие примеры

- Правый клик на карточке с `ContextMenuLabel`, действиями и separator.
- Управляемый флажок «Плотная сетка» через `checked`/`onCheckedChange`.
- Вложенное «Переместить в…» через `ContextMenuSub`.
- Выбор одного значения из списка — `ContextMenuRadioGroup` внутри подменю.

## Антипаттерны

- Смешивать `MenuSection` API с `ContextMenuCheckboxItem`.
- Показывать одиночный выбор флажками или обычными пунктами с галочкой.
- Полагаться на `shortcut` как на настоящий keybinding.
- Прятать единственный способ выполнить ключевую операцию в правом клике.
- Оборачивать в `ContextMenu` содержимое ячейки `VirtualGrid`: Shift+F10 меню не
  откроет, а клик по пункту выберет ячейку. Для ячеек есть поле `contextMenu`
  ([VirtualGrid](../content/virtual-grid.md)).

## Связанные исходники и Storybook

- `src/components/overlays/ContextMenu.tsx`, `src/lib/menu.ts`
- `src/components/overlays/ContextMenu.stories.tsx`
