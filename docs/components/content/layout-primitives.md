---
component: LayoutPrimitives
exports: [Separator, ScrollArea, AspectRatio, Kbd]
category: content
status: stable
source: src/components/content/Separator.tsx, src/components/content/ScrollArea.tsx, src/components/content/AspectRatio.tsx, src/components/content/Kbd.tsx
story: src/components/content/Separator.stories.tsx, src/components/content/ScrollArea.stories.tsx, src/components/content/AspectRatio.stories.tsx, src/components/content/Kbd.stories.tsx
---

# Layout primitives: `Separator`, `ScrollArea`, `AspectRatio`, `Kbd`

## Кратко для AI

Это низкоуровневые строительные блоки, а не полноценная система раскладки.
Сетку равных колонок даёт [`Grid`](grid.md); `Stack` и `Inline` пакет
по-прежнему не экспортирует — стопку и строку с зазором задаёт контекст экрана.
Используйте здесь только смысловую границу, прокрутку, фиксированное отношение
сторон и обозначение клавиш.

## Когда использовать

- `Separator` — для смысловой границы между группами; горизонтальной или
  вертикальной.
- `ScrollArea` — для самостоятельного фрагмента с нативной
  прокруткой, например списка фильтров.
- `AspectRatio` — для контейнера превью с отношением вроде `16 / 9`, `1` или
  `9 / 16`.
- `Kbd` — для текстового обозначения пользовательской клавиши или сочетания.

## Когда не использовать

- Не ставьте `Separator` ради украшения: он объявляет роль `separator`, и
  скринридер сообщит о границе группы. Для украшения скройте черту от дерева
  доступности.
- Не давайте `ScrollArea` роль региона без имени: передайте `label` только
  самостоятельному разделу, который нужно назвать.
- Не передавайте `AspectRatio ratio="16:9"`: API принимает число `16 / 9`.
- Не рисуйте сочетание клавиш обычным `span`; для него есть семантический `Kbd`.
- Свод всех сочетаний экрана — не россыпь `Kbd` в произвольной разметке, а
  `ShortcutsHelp` ([страница](../overlays/shortcuts-help.md)).

## Минимальный пример

```tsx
import { AspectRatio, Kbd, ScrollArea, Separator } from "@olddevs/ui";

<ScrollArea label="Разделы" className="h-48">
  <SectionList />
</ScrollArea>
<Separator spacing="md" />
<AspectRatio ratio={16 / 9}><DocumentPreview /></AspectRatio>
<span>Открыть поиск <Kbd>⌘</Kbd><Kbd>K</Kbd></span>
```

## Public API

### `Separator`

| Prop          | По умолчанию | Значение                                                                                                 |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `orientation` | `horizontal` | Горизонтальная либо вертикальная черта. Внутри `Toolbar` без своего значения ложится поперёк оси панели. |
| `spacing`     | `none`       | Внешние отступы `none`, `sm`, `md`; если расстояние задаёт родительская раскладка, оставьте `none`.      |

### `ScrollArea`

| Prop           | По умолчанию | Значение                                                                                                              |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `orientation`  | `vertical`   | `vertical` включает вертикальную, `horizontal` — горизонтальную нативную прокрутку.                                   |
| `label`        | —            | Доступное имя самостоятельной области. При наличии компонент задаёт `role="region"`.                                  |
| атрибуты `div` | —            | В частности, ограничьте высоту/ширину через `className`; компонент не делает область прокручиваемой без переполнения. |

### `AspectRatio`

| Prop    | По умолчанию | Значение                                                             |
| ------- | ------------ | -------------------------------------------------------------------- |
| `ratio` | `16 / 9`     | Числовое CSS `aspect-ratio`; вычисляйте дробь JavaScript-выражением. |

### `Kbd`

| Prop   | По умолчанию | Значение                                                    |
| ------ | ------------ | ----------------------------------------------------------- |
| `size` | `sm`         | `sm` — внутри меню, `md` — в отдельной шпаргалке сочетаний. |

`Kbd` рисует знаки модификаторов Apple (`⌘ ⌥ ⇧ ⌃`) в строковой подписи
пропорциональным шрифтом, остальное — моноширинным. В моноширинном стеке кита
знака `⇧` нет: запасной глиф выходил тонким рядом с `⌘` и буквой. Текст подписи
от этого не меняется; подпись, переданная разметкой, а не строкой, остаётся как есть. Сочетание
у пунктов `Menu` и `ContextMenu` рисует эти знаки так же.

## Доступность

- `Separator` использует семантический react-aria separator; вертикальная
  версия получает `aria-orientation="vertical"`.
- `ScrollArea` всегда доступна с клавиатуры (`tabIndex=0`): иначе без мыши до
  прокручиваемого содержимого не добраться.
- `Kbd` рендерит HTML-тег `kbd`, поэтому обозначает пользовательский ввод, а не
  просто моноширинный текст.

## Связанные исходники и Storybook

- Исходники: `src/components/content/Separator.tsx`, `src/components/content/ScrollArea.tsx`,
  `src/components/content/AspectRatio.tsx`, `src/components/content/Kbd.tsx`.
- Stories: `src/components/content/Separator.stories.tsx`, `src/components/content/ScrollArea.stories.tsx`, `src/components/content/AspectRatio.stories.tsx`, `src/components/content/Kbd.stories.tsx`.
- Семантика и фокус прокрутки проверяются в `tests/wave7-layout.test.tsx`.
