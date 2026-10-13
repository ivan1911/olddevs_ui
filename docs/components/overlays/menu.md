---
component: Menu
exports: [Menu, MenuButton, MenuItem, MenuSection, MenuSeparator, MenuTrigger, SubmenuTrigger]
category: overlays
status: stable
source: src/components/overlays/Menu.tsx
story: src/components/overlays/Menu.stories.tsx
---

# Menu

## Кратко для AI

`Menu` — составное меню действий, открываемое `MenuTrigger`. Внутри `MenuTrigger`
используйте специальный `MenuButton`, а не обычный `Button`: только он читает
`ButtonContext` react-aria. Меню подходит для разнородных команд, разделов, выбранных режимов и
подменю; не для выбора значения поля. Вложенный `Menu` в `SubmenuTrigger` сам
раскрывается сбоку от пункта, на узком экране под ним: `placement` задавать не
нужно. «Прицел» (защита подменю от случайного закрытия при движении курсора к
нему) даёт react-aria, свой не пишите.

## Когда использовать

- Контекстные действия у сущности, overflow-кнопка, меню сортировки или вида.
- Нужны разделы, separator, shortcut, disabled/опасный пункт или подменю.
- Несколько выбранных режимов принадлежат одному `MenuSection`.

## Когда не использовать

- Для выбора значения в форме — `Select`, для пользовательского ввода со
  списком вариантов — `Combobox`.
- Для меню правой кнопкой — `ContextMenu`.
- Не используйте `Button` вместо `MenuButton`: меню не получит open/focus props.

## Минимальный пример

```tsx
<MenuTrigger>
  <MenuButton iconOnly aria-label="Действия" icon={<MoreIcon />} />
  <Menu>
    <MenuItem onAction={rename}>Переименовать</MenuItem>
    <MenuSeparator />
    <MenuItem tone="danger" onAction={remove}>
      Удалить
    </MenuItem>
  </Menu>
</MenuTrigger>
```

## Public API

`MenuTrigger` и `SubmenuTrigger` — реэкспорты react-aria. `MenuButton` принимает
button look props, `icon`, `children`, `disabled`, `aria-label` и `className`;
`aria-label` обязателен, если у кнопки нет подписи; с `iconOnly` её нет всегда.
`Menu` принимает обычные `AriaMenuProps`, плюс `offset` — отступ панели от кнопки
в пикселях (умолчание 6) и `placement` — сторона раскрытия (умолчание корневого
меню `bottom start`; ещё `bottom end`, `top start`, `top end`, `end top`,
`start top`, `right top`, `left top`; умолчание подменю — ниже). `end top` и
`start top` — сбоку по концу и по началу строки: при письме справа налево они
меняются местами. `right top` и `left top` от направления письма не зависят.

`MenuItem` принимает props `AriaMenuItem`, `icon`, `shortcut`, `tone`, `disabled`
и `className`; действие передавайте в `onAction`. `MenuSection` принимает
`label` и props react-aria selection. Для переключателей задавайте
`selectionMode`, `selectedKeys` и `onSelectionChange` на section, а не `checked`
на item. `MenuSeparator` разделяет группы.

Подменю — `Menu` внутри `SubmenuTrigger` — по умолчанию раскрывается справа от
своего пункта, верхним краем вровень с ним. Если справа не хватает места,
react-aria переворачивает подменю влево. При письме справа налево всё зеркально:
подменю раскрывается слева от пункта. На узком экране (до 639px шириной) места
сбоку нет ни справа, ни слева, и подменю встаёт под своим пунктом, поверх
родительского меню. Явный `placement` у вложенного `Menu` побеждает умолчание, в
том числе на телефоне; чтобы задать сторону самому и не сломать письмо справа
налево, берите `end top` или `start top`. Корневое меню раскрывается как прежде — `bottom start`.
То же правило у подменю Редактора.

Движение курсора к подменю по диагонали его не закрывает и не переключает на
соседний пункт: этот «Прицел» работает в `SubmenuTrigger` из react-aria. Кит его
не подменяет и своего не добавляет — не пишите поверх него свой.

Высоту панели меню задаёт react-aria по видимой области. Пункты, которые в неё
не влезли, прокручиваются внутри панели (`overflow-y: auto`, прокрутка не
уходит на страницу), а не рисуются за её краем поверх содержимого. На iOS
высоту, посчитанную react-aria, панель перебивает своей — 24rem или 60%
динамической высоты экрана, что меньше: в Safari на iOS 27 react-aria давал
панели высоту около нуля. То же у `ContextMenu`: вид панели у них общий.

На сенсорном экране без наведения (`hover: none` и `pointer: coarse`) пункты не
показывают `shortcut`: клавиатуры там нет. Сочетание нельзя
отключить пропом, и это не нужно — на десктопе и с трекпадом оно видно как раньше.

## Доступность и клавиатура

react-aria задаёт роли меню, управляет фокусом и клавиатурной навигацией. `Menu`
уже оборачивается в `Popover`. Пункт раздела с `selectionMode` получает корректную роль
и `aria-checked` от библиотеки. Внутри `Dialog` и `Drawer` первый Escape
закрывает menu, а следующий — окно; пункт выбирается и мышью, и с клавиатуры, а
окно от щелчка по пункту не закрывается. Этот межбиблиотечный контракт
проверяется в Storybook и browser test; правило в `@olddevs/ui/styles.css`
возвращает указатель панели внутри модального слоя Radix. См. [исходник Menu](../../../src/components/overlays/Menu.tsx).

## Хорошие примеры

- Раздел «Вид» с `selectionMode="multiple"`.
- `SubmenuTrigger` с `MenuItem` первым и вложенным `Menu` вторым ребёнком.
- `shortcut` как визуальное напоминание, при этом обработка сочетания остаётся
  задачей приложения.

## Антипаттерны

- Управлять selected state на `MenuItem` вручную.
- Использовать menu как навигацию между страницами или вкладками.
- Помещать интерактивные формы внутрь обычного menu item.

## Связанные исходники и Storybook

- `src/components/overlays/Menu.tsx`, `src/lib/menu.ts`
- `src/components/overlays/Menu.stories.tsx`
