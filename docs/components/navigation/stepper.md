---
component: Stepper
exports: [Stepper]
category: navigation
status: stable
source: src/components/navigation/Stepper.tsx
story: src/components/navigation/Stepper.stories.tsx
---

# Stepper

## Кратко для AI

`Stepper` показывает порядок шагов мастера; текущий индекс задаёт родитель (controlled). Он не
управляет переходом вперёд, валидацией или показом панелей с формами. Если передать
`onStepClick`, только уже пройденные шаги станут кнопками возврата.

## Когда использовать

- Линейный мастер, импорт, checkout или onboarding с понятным количеством шагов.
- Нужно показать текущую позицию и дать вернуться к пройденному шагу.
- На небольшом экране нужен `orientation="vertical"`.

## Когда не использовать

- Для равноправных разделов без порядка используйте `Tabs`.
- Для сворачиваемых деталей используйте `Accordion`.
- Не используйте вместо pagination: шаг не равен странице выдачи.

## Минимальный пример

```tsx
<Stepper
  steps={[
    { id: "source", label: "Источник" },
    { id: "review", label: "Проверка" },
  ]}
  current={currentStep}
  onStepClick={setCurrentStep}
/>
```

## Public API

`steps` — массив `{ id, label, hint? }`, `current` — 0-based индекс. Опциональный
`onStepClick(index)` разрешает возврат только на `index < current`; будущие и
текущий шаг не становятся кликабельными. Без callback не кликабелен ни один
шаг. `orientation` — `horizontal` (умолчание) или `vertical`; есть `className`
и `aria-label` (умолчание «Шаги»).

## Доступность и клавиатура

Компонент использует `nav` и упорядоченный список, поэтому скринридер знает
порядок и число шагов. Текущий item имеет `aria-current="step"`; пройденный
шаг с callback — настоящий button и доступен Tab. Кружок с номером или
галочкой скрыт от вспомогательных технологий; смысл передают список и два
механизма. У текущего шага это `aria-current="step"`. У пройденных и ещё не
начатых шагов есть скрытый текст из каталога сообщений (`stepper.state`):
«пройден» и «не начат» в русском каталоге.
См. [исходник Stepper](../../../src/components/navigation/Stepper.tsx).

## Хорошие примеры

- Не передавать `onStepClick` для необратимой оплаты или импорта.
- Передать короткий `hint` для дополнительного контекста под label.
- Синхронизировать `current` с отображаемой формой в родителе.

## Антипаттерны

- Передавать 1-based current.
- Считать `onStepClick` разрешением перейти в будущую незаполненную форму.
- Использовать меняющийся индекс массива вместо стабильного `Step.id`.

## Связанные исходники и Storybook

- `src/components/navigation/Stepper.tsx`
- `src/components/navigation/Stepper.stories.tsx`
