---
component: Dialog
exports: [Dialog, ModalHeader, ModalOverlay]
category: overlays
status: stable
source: src/components/overlays/Dialog.tsx
story: src/components/overlays/Dialog.stories.tsx
---

# Dialog, ModalHeader и ModalOverlay

## Кратко для AI

Используйте `Dialog` для модального окна с известным заголовком: он создаёт
модальность, доступное имя, ловушку фокуса, портал и возврат фокуса. `ModalHeader`
— только готовая шапка. `ModalOverlay` — только затемнённая подложка; он не делает
содержимое диалогом и не должен быть заменой `Dialog` для форм или подтверждений.

## Когда использовать

- `Dialog` — форма, просмотр или другое блокирующее окно с `open` и `onClose`.
- `ModalHeader` — шапка для нестандартного оверлея, который уже самостоятельно
  задаёт роль, имя и управление фокусом.
- `ModalOverlay` — подложка для содержимого, которое не объявляется диалогом и
  само отвечает за доступность; передавайте `onClose` и при необходимости
  `escape={false}`.

## Когда не использовать

- Для вопроса, требующего явного решения, используйте `ConfirmDialog`, а не
  `Dialog` с двумя вручную собранными кнопками.
- Для выезжающей панели используйте `Drawer`.
- Для привязанной к триггеру небольшой панели — `Popover`; для пояснения — `Tooltip`.
- Не оборачивайте `Dialog` в `ModalOverlay` и не добавляйте `useScrollLock`: Radix
  уже управляет модальностью и прокруткой.

## Минимальный пример

```tsx
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Новая коллекция"
  className="w-full max-w-[420px]"
>
  <form>{/* поля и действия */}</form>
</Dialog>
```

## Public API

`Dialog` требует `open`, `onClose` и `title`. `title` может быть `ReactNode` и
становится доступным именем. `subtitle`, `icon`, `closeLabel` (доступное имя крестика, умолчание «Закрыть»), `className`, `overlayClassName`,
`overlayStyle`, `contentStyle`, `zIndex` и `align` настраивают представление.
`header={false}` оставляет скрытый `Dialog.Title`, поэтому `title` всё равно
обязателен. `role` принимает `dialog` (умолчание) или `alertdialog`.

`describedBy` — `id` узла, который служит окну описанием: текстом, который
скринридер читает следом за именем. Это не `subtitle` — тот виден глазами и
живёт в шапке. Для `role="alertdialog"` описание обязательно по ARIA Authoring Practices Guide (APG):
подтверждение, объявившее только имя и кнопку, вынуждает подтверждать вслепую.
`ConfirmDialog` ссылается на свой `message` сам.

**Идентификатор, а не текст: так вышло после разбора дефекта.** До 3.7.0 проп
назывался `description`, принимал `ReactNode` и рисовал его скрытой копией,
поэтому текст оказывался в документе дважды: ссылка внутри него давала невидимый
лишний табстоп, а компонент со своим `id` — дубль идентификатора. Описание
обязано указывать на тот же узел, который видит глаз. Если текст нужен только
для озвучки, положите его в `children` под `sr-only` и сошлитесь сюда.

`loading` — единое состояние отправки: крестик исчезает, а Escape и клик вне
окна его не закрывают. `initialFocusRef` задаёт начальный фокус; используйте его,
например, для безопасного поля формы, не вызывая `focus()` эффектом снаружи.
`onEscapeKeyDown` — дополнительная реакция для внутреннего состояния окна; она не
заменяет `onClose`.

`ModalHeader` принимает `title`, опциональные `subtitle`, `icon`, `onClose`,
`closeLabel`, `titleId`, `titleComponent` и `className`. Кнопка закрытия существует
только при `onClose`. `ModalOverlay` принимает `onClose`, `zIndex`, `align`,
`backdrop`, `blur`, `escape`, `className` и `children`; он закрывается по клику на
подложку и, по умолчанию, по Escape.

## Доступность и клавиатура

`Dialog` основан на Radix: фокус остаётся в модальном слое, при закрытии
возвращается открывшему элементу, а вложенные окна Radix закрываются по одному
на каждое нажатие Escape. При открытом меню или списке react-aria первое нажатие
Escape обрабатывает это меню или список, а не родительское окно. Мышью такое меню
или список внутри окна тоже работает: Radix отключает указатель у `<body>`, и кит возвращает его
оверлею react-aria правилом в `@olddevs/ui/styles.css` — раньше пункт
выбирался только с клавиатуры. `ModalHeader` получает доступное имя
кнопки закрытия из `closeLabel` (по умолчанию «Закрыть»).

`ModalOverlay` не даёт `role="dialog"`, `aria-modal`, focus trap или scroll lock.
Если его всё же применяют для интерактивного окна, потребитель обязан добавить
эти свойства сам. См. [исходник Dialog](../../../src/components/overlays/Dialog.tsx),
[ModalHeader](../../../src/components/overlays/ModalHeader.tsx) и
[ModalOverlay](../../../src/components/overlays/ModalOverlay.tsx).

## Хорошие примеры

- Окно формы: `Dialog` с `title`, `FormField` и footer в `children`.
- Нестандартная геометрия: `Dialog header={false}` с собственным содержимым, но
  не с самодельной ролью.
- Обычная подложка предпросмотра: `ModalOverlay`, если preview не объявляется
  пользователю модальным диалогом.

## Антипаттерны

- `role="dialog"` на `ModalOverlay` без имени и focus trap.
- Три раздельных флага для запрета крестика, Escape и click-away вместо `loading`.
- Класть в `title` блочную разметку вроде футера или оставлять окно без смыслового названия.

## Связанные исходники и Storybook

- `src/components/overlays/Dialog.tsx`, `src/components/overlays/ModalHeader.tsx`, `src/components/overlays/ModalOverlay.tsx`
- `src/components/overlays/Dialog.stories.tsx`
