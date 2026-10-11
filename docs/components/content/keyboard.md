---
component: KeyboardAccessibility
exports: [Keyboard, VisuallyHidden]
category: content
status: stable
source: src/components/content/Keyboard.tsx, src/components/content/VisuallyHidden.tsx
story: src/components/content/Keyboard.stories.tsx, src/components/content/VisuallyHidden.stories.tsx
---

# Keyboard и VisuallyHidden

## Кратко для AI

`Keyboard` — контролируемая экранная клавиатура для уже существующего
текстового поля: она редактирует строку и выделение через обработчики, а не
получает DOM-ref поля. `VisuallyHidden` оставляет текст в дереве доступности,
но не показывает его визуально. Это не способ скрыть содержимое от всех.

## Когда использовать

- `Keyboard` — когда экран должен дать редактирование текста указателем или
  касанием и владелец может хранить `value`, `selection` и текущую раскладку.
  `SearchControl` уже умеет интегрировать её через свой keyboard API.
- `VisuallyHidden` — чтобы дополнить понятное видимое название деталями для
  скринридера, например количеством рядом с заголовком.

## Когда не использовать

- `Keyboard` — это экранная клавиатура, а не способ показать сочетание клавиш.
  «Ctrl+K» рисуется `Kbd`, а свод сочетаний — `ShortcutsHelp`
  ([страница](../overlays/shortcuts-help.md)).
- Не используйте `Keyboard` как единственный способ ввода: это дополнение к
  настоящему текстовому контролу, не его замена.
- Не пытайтесь редактировать поле через ref или искусственный DOM-event:
  передавайте состояние и обновляйте его через `onChange` и
  `onSelectionChange`.
- Не применяйте `VisuallyHidden` для удаления текста из доступности:
  `display: none`, `visibility: hidden` и элемент, скрытый от вспомогательных
  технологий, имеют другую семантику.
- Не скрывайте единственную доступную подпись интерактивного контрола:
  пользователь без скринридера тоже должен видеть, что делает контрол.

## Минимальный пример

```tsx
import { Keyboard, type KeyboardSelection } from "@olddevs/ui";

const [value, setValue] = useState("");
const [selection, setSelection] = useState<KeyboardSelection>({ start: 0, end: 0 });
const [layout, setLayout] = useState<"ru" | "en">("ru");

<Keyboard
  value={value}
  selection={selection}
  onChange={setValue}
  onSelectionChange={setSelection}
  layout={layout}
  onLayoutChange={setLayout}
  onSubmit={submitSearch}
  onRequestClose={closeKeyboard}
/>;
```

```tsx
<Heading level={2}>
  Черновики<VisuallyHidden elementType="span"> — восемь штук</VisuallyHidden>
</Heading>
```

`elementType="span"` внутри строки **обязателен**: по умолчанию компонент рисует
`<div>`, и в заголовке или абзаце это невалидная вложенность — React сообщает об
ошибке гидрации, а браузер разрывает абзац. Для скрываемого поддерева, стоящего
отдельным блоком, умолчание подходит.

## Public API

### `Keyboard`

| Prop                            | Назначение и ограничения                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                         | Текущая контролируемая строка.                                                                                                                                                                        |
| `selection`                     | Текущий диапазон позиций UTF-16 `{ start, end }` в `value`; обязан обновляться вместе со значением.                                                                                                   |
| `onChange`, `onSelectionChange` | Обязательные обработчики. Нажатие клавиши вставляет её символ на место выделения, заменяя выделенный текст; Backspace удаляет предыдущий Unicode code point.                                          |
| `layout`, `onLayoutChange`      | Обязательная раскладка `ru` или `en` и контролируемое переключение.                                                                                                                                   |
| `onSubmit`                      | Необязательное подтверждение; вызывается без создания искусственного DOM-события submit.                                                                                                              |
| `disabled`                      | Отключает все клавиши, ручку перемещения и кнопку закрытия.                                                                                                                                           |
| `preserveFocus`                 | При работе указателем не уводит фокус с внешнего текстового поля; это выбор интеграции.                                                                                                               |
| `label`                         | Доступное имя панели; по умолчанию из каталога сообщений (`keyboard.label`): «Русская клавиатура» / «Английская клавиатура» в `locales/ru`, без провайдера — «Russian keyboard» / «English keyboard». |
| `closeLabel`, `onRequestClose`  | Доступное имя и обработчик кнопки закрытия. Без обработчика кнопка закрытия не рендерится.                                                                                                            |

Экспортируемые типы: `KeyboardLayout` (`"en" | "ru"`), `KeyboardSelection`,
`KeyboardProps`.

### `VisuallyHidden`

`VisuallyHidden` реэкспортируется из `react-aria-components` вместе с типом
`VisuallyHiddenProps`. Оберните скрываемое поддерево в компонент; он не меняет
его текстовую семантику, а только делает его визуально скрытым.

## Поведение и доступность

- Панель имеет доступное имя, кнопки — доступные названия, а Shift и режим
  символов отражают состояние через `aria-pressed`.
- Стрелки, Home и End переводят фокус между клавишами панели; экранная клавиша Enter
  на панели вызывает `onSubmit`, если обработчик передан.
- Панель видна от ширины `md`; на узком экране её нет.
- Ручка перемещения двигает панель мышью и стрелками.
- Shift, режим символов и Caps Lock — внутреннее состояние панели. Содержимое
  поля и раскладка остаются у владельца; переключение раскладки панель только
  запрашивает через `onLayoutChange`.
- `VisuallyHidden` остаётся в дереве доступности. В отличие от `display: none`,
  текст будет прочитан скринридером.

## Антипаттерны

```tsx
// Плохо: новое значение сохраняется, но позиция курсора остаётся старой.
<Keyboard value={value} selection={selection} onChange={setValue} onSelectionChange={() => {}} … />

// Хорошо: оба значения принадлежат одному владельцу состояния.
<Keyboard value={value} selection={selection} onChange={setValue} onSelectionChange={setSelection} … />
```

## Связанные исходники и Storybook

- Исходники: `src/components/content/Keyboard.tsx`, `src/components/content/VisuallyHidden.tsx`.
- Stories: `src/components/content/Keyboard.stories.tsx`, `src/components/content/VisuallyHidden.stories.tsx`.
- Редактирование, навигация и доступные названия проверяет
  `tests/keyboard.test.tsx`; скрытый текст — `tests/wave7-layout.test.tsx`.
