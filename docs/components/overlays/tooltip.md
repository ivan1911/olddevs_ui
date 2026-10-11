---
component: Tooltip
exports: [Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger, HelpTooltip]
category: overlays
status: stable
source: src/components/overlays/Tooltip.tsx
story: src/components/overlays/Tooltip.stories.tsx
---

# Tooltip и HelpTooltip

## Кратко для AI

`Tooltip` добавляет краткое пояснение к одному элементу при hover и focus.
Он не заменяет видимую подпись, инструкцию или подтверждение. `TooltipProvider`
ставится один раз у корня приложения. Для обычного случая берите wrapper
`Tooltip`; primitives `TooltipRoot`, `TooltipTrigger`, `TooltipContent` нужны,
когда требуется составная разметка Radix. `HelpTooltip` — готовый поповер по клику на
иконку помощи.

## Когда использовать

- Подписать кнопку только с иконкой или расшифровать незнакомый термин.
- Дать короткое необязательное уточнение, которое не нужно для завершения задачи.
- `HelpTooltip` — для стандартной help-иконки рядом с полем или настройкой.

## Когда не использовать

- Не прячьте обязательную инструкцию, ошибку или единственное название действия:
  они должны быть видимы или программно связаны с контролом.
- Для сложного интерактивного содержимого — `Popover`; для сообщения о состоянии
  — `Alert`. Для превью с разметкой (аватар, заголовок, пара строк) по наведению
  на ссылку или имя — `HoverCard`.
- Не создавайте `TooltipProvider` у каждой кнопки.

## Минимальный пример

```tsx
<Tooltip content="Удалить выбранное">
  <Button iconOnly aria-label="Удалить" icon={<DeleteIcon />} />
</Tooltip>
```

## Public API

`Tooltip` принимает `content`, единственный `children: ReactElement`, а также
`side`, `align` и `delayDuration`. Пустой `content` возвращает ребёнка без
обёртки. Ребёнок обязан принимать `ref`, потому что он становится trigger.
`TooltipContent` принимает props Radix `Content`; его `sideOffset` по умолчанию
равен 6. `TooltipProvider`, `TooltipRoot` и `TooltipTrigger` экспортируют
примитивы Radix для составного API.

## Доступность и клавиатура

Подсказка открывается и при фокусе, а не только при наведении. У icon-only
trigger всё равно должен быть собственный `aria-label`: подсказка не является
надёжным доступным именем кнопки. Поставьте один provider на root, чтобы общая
задержка и переход между подсказками работали согласованно. См.
[исходник Tooltip](../../../src/components/overlays/Tooltip.tsx) и
[HelpTooltip](../../../src/components/overlays/HelpTooltip.tsx).

## Хорошие примеры

- Иконка удаления с `aria-label` и уточняющей подсказкой.
- `content={condition ? text : undefined}` без ручного ветвления DOM.
- `HelpTooltip` рядом с непонятным параметром, но не вместо его `label`.

## Антипаттерны

- Подсказка на нефокусируемом `span` как единственный способ прочитать действие.
- Многоабзацный текст, кнопки или форма внутри подсказки.
- Вложенный provider в библиотечном компоненте.

## Связанные исходники и Storybook

- `src/components/overlays/Tooltip.tsx`, `src/components/overlays/HelpTooltip.tsx`
- `src/components/overlays/Tooltip.stories.tsx`
