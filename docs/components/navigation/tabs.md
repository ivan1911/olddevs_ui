---
component: Tabs
exports: [Tabs]
category: navigation
status: stable
source: src/components/navigation/Tabs.tsx
story: src/components/navigation/Tabs.stories.tsx
---

# Tabs

## Кратко для AI

`Tabs` — controlled-only лента вкладок; компонент рендерит только tablist, не
панели. Потребитель хранит `value`, применяет `onChange` и обязан отрендерить
активную панель с `id={`${value}-panel`}` и `role="tabpanel"`.

## Когда использовать

- Несколько равноправных мгновенно переключаемых представлений одного контекста.
- Вертикальная навигация settings/sidebar или горизонтальная лента со скроллом.
- Состояние активной вкладки уже принадлежит URL или компоненту-потребителю.

## Когда не использовать

- Для пошагового процесса используйте `Stepper`; для независимых сворачиваемых блоков —
  `Accordion`; для переключения форматных режимов — `Segmented`.
- Не используйте tabs, если содержимое всех секций должно быть видно одновременно.
- Не ожидайте uncontrolled `defaultValue`: его нет.

## Минимальный пример

```tsx
<Tabs items={items} value={tab} onChange={setTab} />
<div id={`${tab}-panel`} role="tabpanel">{panels[tab]}</div>
```

## Public API

`items` — массив `{ id, label, icon? }`; `value` и `onChange` обязательны.
`orientation` — `horizontal` (умолчание) или `vertical`, `className` настраивает
container. Чтобы ориентация менялась по ширине экрана, выбирайте `orientation` на
стороне потребителя. Item id формирует `aria-controls`, поэтому он должен быть пригоден
для HTML id и уникален в этой tablist.

## Доступность и клавиатура

У активной вкладки `tabIndex=0`, у остальных `-1`: Tab входит только в
активную, а roving focus использует стрелки. По горизонтальной ленте
перемещаются `←/→`, по вертикальной — `↑/↓`; Home/End идут к краям, края не зацикливаются.
Выбор следует за фокусом (automatic activation). `aria-controls` получает лишь
активная вкладка, потому что потребитель может не рендерить неактивные панели.
См. [исходник Tabs](../../../src/components/navigation/Tabs.tsx).

## Хорошие примеры

- Settings sidebar: `orientation="vertical"` и отдельный `tabpanel`.
- Горизонтальная лента с короткими подписями, допускающая overflow-x.
- Иконки только как дополнение к читаемым label.

## Антипаттерны

- Рендерить tablist без панели активной вкладки.
- Передавать в `value` id, отсутствующий в `items`.
- Добавлять отдельный Enter для активации: переключение уже происходит стрелкой.

## Связанные исходники и Storybook

- `src/components/navigation/Tabs.tsx`
- `src/components/navigation/Tabs.stories.tsx`
