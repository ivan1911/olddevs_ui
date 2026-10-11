"use client";

import type { DOMOutputSpec } from "@tiptap/pm/model";
import { mergeAttributes, type Extension, type Mark } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  CUSTOM_COLOR_PROPERTY,
  customColorFromStyle,
  customColorStyle,
  normalizeCustomColor,
} from "./customColor.js";
import {
  alignmentFromElement,
  DEFAULT_ALIGNMENT,
  EDITOR_ALIGNMENTS,
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  markerNameFromAttribute,
  type EditorAlignment,
} from "../../styles/palette.js";

/**
 * Цвет текста, маркер и выравнивание: расширения Tiptap, переписанные с
 * `style` на `data-*`.
 *
 * ПОЧЕМУ НЕ «ИЗ КОРОБКИ». `Color`, `Highlight` и `TextAlign` пишут
 * `style="color: …"` и читают любое значение CSS, которое пришло. Для кита это
 * два обещания, которые такой разбор нарушает: в сохранённом HTML нет `style`
 * (сервер потребителя может не разрешать его вовсе), и цвет — только из
 * палитры токенов, а не `#ff0000` из вставки из Word. Поэтому пакеты взяты ради
 * команд и разметки Схемы, а атрибуты, разбор и вывод заменены.
 *
 * ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ — ЦВЕТ АВТОРА (`customColor.ts`): `style="color:#rrggbb"`
 * на `span` и `style="background-color:#rrggbb"` на `mark`, и только в этой
 * строгой форме, никогда вместе с `data-color`. Остальной `style` по-прежнему не
 * разбирается.
 *
 * ЧТО НЕ ИЗ ПАЛИТРЫ — ОТБРАСЫВАЕТСЯ ВМЕСТЕ С ОБЁРТКОЙ, ТЕКСТ ОСТАЁТСЯ.
 * `<span data-color="hotpink">` разбирается без метки, `<span style="…">` не
 * разбирается вовсе: значение CSS из чужого HTML не переводится в ближайший
 * цвет палитры. Перевод угадывал бы за автора, а в тёмной теме угаданный цвет
 * мог бы оказаться нечитаемым.
 */

const textColorNames: ReadonlySet<string> = new Set(EDITOR_TEXT_COLOR_NAMES);
const markerNames: ReadonlySet<string> = new Set(EDITOR_MARKER_NAMES);

const knownAlignments: ReadonlySet<string> = new Set(EDITOR_ALIGNMENTS);

type ColorProperty = (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY];

/**
 * Что считать именем палитры на метке. Палитр две (`palette.ts`): `span`
 * берёт имена цвета текста, `mark` — имена маркера, и чужое имя на теге не
 * принимается. `named` — имя в том виде, в каком оно пишется в документ;
 * `parsed` — то же из чужого или сохранённого HTML: маркер там переводит
 * старое имя в новое (`LEGACY_MARKER_NAMES`), текст — нет.
 */
interface ColorKind {
  property: ColorProperty;
  named: (value: string | null) => string | null;
  parsed: (value: string | null) => string | null;
}

const TEXT_KIND: ColorKind = {
  property: CUSTOM_COLOR_PROPERTY.span,
  named: (value) => (value !== null && textColorNames.has(value) ? value : null),
  parsed: (value) => (value !== null && textColorNames.has(value) ? value : null),
};

const MARKER_KIND: ColorKind = {
  property: CUSTOM_COLOR_PROPERTY.mark,
  named: (value) => (value !== null && markerNames.has(value) ? value : null),
  parsed: markerNameFromAttribute,
};

/**
 * Значение цвета метки: имя её палитры или произвольный `#rrggbb` (регистр
 * приводится к нижнему). Метка хранит одну строку, и это же делает палитру и
 * произвольный цвет взаимоисключающими: второй не может «добавиться» к первому.
 */
const colorValue = (value: unknown, kind: ColorKind): string | null =>
  typeof value === "string" ? (kind.named(value) ?? normalizeCustomColor(value)) : null;

/** Атрибуты HTML для значения цвета метки: `data-color` ИЛИ `style`, не оба. */
const renderColor = (value: string | null | undefined, kind: ColorKind): Record<string, string> => {
  const color = colorValue(value, kind);
  if (color === null) return {};
  return kind.named(color) !== null
    ? { "data-color": color }
    : { style: customColorStyle(kind.property, color) };
};

/**
 * Разметка метки со `style`, которая сохраняет его ДОСЛОВНО.
 *
 * ПОЧЕМУ НЕ МАССИВ `["span", { style }, 0]`. ProseMirror пишет ключ `style`
 * через `element.style.cssText`, и браузер возвращает значение в своей записи:
 * `color:#ff0000` выходит как `color: rgb(255, 0, 0);`. Такой документ при
 * следующей загрузке не прошёл бы строгий разбор, а правило «в `style` только
 * `color:#rrggbb`» для очистки на сервере (`sanitizeRichText`) перестало бы быть правдой.
 * `setAttribute("style", …)` строку не трогает, поэтому элемент собирается
 * руками, а ProseMirror получает готовый узел и место для содержимого.
 */
const renderMark = (tag: "span" | "mark", attributes: Record<string, string>): DOMOutputSpec => {
  const { style, ...rest } = attributes;
  if (style === undefined || typeof document === "undefined") return [tag, attributes, 0];
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(rest)) element.setAttribute(name, value);
  element.setAttribute("style", style);
  return { dom: element, contentDOM: element };
};

/**
 * Цвет элемента из чужого HTML. Имя палитры метки в `data-color` — первым;
 * `style` читается, только когда `data-color` нет вовсе: элемент с чужим именем
 * и со `style` не получает ничего, а не «хотя бы style».
 */
const colorOf = (element: HTMLElement, kind: ColorKind): string | null => {
  const name = element.getAttribute("data-color");
  if (name !== null) return kind.parsed(name);
  return customColorFromStyle(element.getAttribute("style"), kind.property);
};

/**
 * Метка цвета текста: `<span data-color="danger">`.
 *
 * Метка движка называется `textStyle` — под этим именем её знает `Color`,
 * поэтому имя не меняется. Правило разбора берёт только `span` с именем из
 * палитры: пустая обёртка `<span>` (разметка пункта чек-листа) и `span` со
 * `style` метки не получают.
 */
const TextColorMark: Mark = TextStyle.extend({
  // Снаружи маркера (у него 1001): `span[data-color]` › `mark` › `sup`. Тёмный
  // текст маркера (`prose.ts`) стоит на `mark` и потому сильнее цвета автора
  // вокруг — на яркой подложке текст читается в любой теме.
  priority: 1002,
  renderHTML({ HTMLAttributes }) {
    return renderMark("span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes));
  },
  parseHTML() {
    return [
      {
        tag: "span[data-color],span[style]",
        getAttrs: (element) => (colorOf(element, TEXT_KIND) ? {} : false),
      },
    ];
  },
});

/** Значение метки цвета: имя палитры в `data-color` или `#rrggbb` в `style`. */
const TextColorValue: Extension = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => colorOf(element, TEXT_KIND),
            renderHTML: (attributes: { color?: string | null }) =>
              renderColor(attributes.color, TEXT_KIND),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      // Ни имя палитры, ни `#rrggbb` — не ставится: метка без значения вышла
      // бы пустым `<span>` в сохранённом HTML.
      setColor:
        (color) =>
        ({ chain }) => {
          const value = colorValue(color, TEXT_KIND);
          return value !== null && chain().setMark("textStyle", { color: value }).run();
        },
    } as ReturnType<NonNullable<typeof Color.config.addCommands>>;
  },
});

/** Инструмент `color`: метка и её значение вместе. */
export const TEXT_COLOR_EXTENSIONS = [TextColorMark, TextColorValue];

/**
 * Маркер: `<mark data-color="yellow">`. Маркер без цвета из палитры не
 * существует: голый `<mark>` браузер красит жёлтым с чёрным текстом, и в
 * тёмной теме это светящаяся плашка поверх всего документа. Поэтому разбор
 * берёт только `mark[data-color]` с известным именем, а команда без цвета
 * ничего не ставит.
 *
 * Выключены и всё, что ставило маркер без цвета: `Mod-Shift-H`, правило ввода
 * и вставки `==текст==`, разбор Markdown. Последнее ещё и закрывает утечку
 * между Редакторами: правила Markdown живут в общем `marked`, и маркер одного
 * Редактора разбирал бы `==` у другого — без инструмента.
 */
export const HighlightExtension: Mark = Highlight.configure({ multicolor: true }).extend({
  /*
    Маркер — САМАЯ ВНЕШНЯЯ Метка. Вложенность Меток в DOM задаёт порядок в
    Схеме, а его — приоритет расширения. С обычным приоритетом маркер ложился
    внутрь `<sup>`/`<sub>` и поднимался вместе с индексом: полоса прыгала
    вверх-вниз посреди строки. Снаружи его подложка остаётся на строке, а индекс
    поднимается внутри неё. Выше и ссылки (у `RichLink` приоритет 1000), чтобы
    помеченная ссылка тоже не рвала полосу.
  */
  priority: 1001,
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => colorOf(element, MARKER_KIND),
        renderHTML: (attributes: { color?: string | null }) =>
          renderColor(attributes.color, MARKER_KIND),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return renderMark("mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes));
  },
  parseHTML() {
    return [
      {
        tag: "mark[data-color],mark[style]",
        getAttrs: (element) => (colorOf(element, MARKER_KIND) ? {} : false),
      },
    ];
  },
  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent!,
      // Маркер без цвета (палитры или `#rrggbb`) не ставится: см. комментарий
      // к расширению.
      setHighlight:
        (attributes) =>
        ({ commands }) => {
          const color = colorValue(attributes?.color, MARKER_KIND);
          return color !== null && commands.setMark(this.name, { ...attributes, color });
        },
    };
  },
  addKeyboardShortcuts: () => ({}),
  addInputRules: () => [],
  addPasteRules: () => [],
  // Расширение-родитель держит свой токенайзер, а `undefined` в `extend`
  // родителя не заглушает, поэтому подменяется токенайзером, который не находит
  // ничего: `start` без совпадения не даёт разбору остановиться на `==`.
  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: () => -1,
    tokenize: () => undefined,
  },
  // Цвет при экспорте в Markdown теряется (спека, «Markdown»): остаётся текст.
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),
  parseMarkdown: (token, helpers) => helpers.parseInline(token.tokens ?? []),
});

/**
 * Выравнивание Блока: `<p data-align="center">`.
 *
 * `left` — умолчание, и в разметку не пишется: документ без выравнивания
 * остаётся прежним, а `setTextAlign("left")` снимает атрибут, а не ставит
 * «явно слева». Читается `left` из чужого HTML как отсутствие атрибута.
 *
 * Типы — абзац и заголовок. Заголовков Схема знает четыре уровня (первый — с `heading1`),
 * поэтому выравниваются `p` и `h1`–`h4`; абзац внутри списка или цитаты — тоже `p`.
 */
export const TextAlignExtension: Extension = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            // `data-align`, а из чужого HTML — `text-align` и `align` (`palette.ts`).
            parseHTML: (element: HTMLElement): EditorAlignment | null =>
              alignmentFromElement(element),
            renderHTML: (attributes: { textAlign?: string | null }) =>
              attributes.textAlign &&
              knownAlignments.has(attributes.textAlign) &&
              attributes.textAlign !== DEFAULT_ALIGNMENT
                ? { "data-align": attributes.textAlign }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent!,
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (alignment === DEFAULT_ALIGNMENT) return commands.unsetTextAlign();
          if (!knownAlignments.has(alignment)) return false;
          return this.options.types
            .map((type) => commands.updateAttributes(type, { textAlign: alignment }))
            .some(Boolean);
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-r": () => this.editor.commands.setTextAlign("right"),
    };
  },
}).configure({ types: ["paragraph", "heading"], alignments: [...EDITOR_ALIGNMENTS] });
