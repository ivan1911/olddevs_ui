"use client";

// Происхождение: minimal-tiptap, `minimal-tiptap.tsx` и `hooks/use-minimal-tiptap.ts`
// (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap). Оставлены
// обёртка над `useEditor` и `EditorContent`, рамка поля и плейсхолдер; Панель —
// в `EditorToolbar.tsx`. Лицензия — NOTICE в корне пакета.

import { createDocument } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useDescribedBy, useFieldInvalid, useFieldLabelId } from "../hooks/useFieldDescription.js";
import { useMessages } from "../i18n/useMessages.js";
import { cn } from "../lib/cn.js";
import { FIELD_SHELL_CLASS } from "../lib/field.js";
import { BlockHandle } from "./ui/BlockHandle.js";
import { expandTools } from "./features/builtins.js";
import {
  createHandleMethods,
  clearToolSignals,
  publishToolSignals,
  type RichTextEditorHandleMethods,
} from "./core/handle.js";
import { EditorToolbar, ToolbarSkeleton } from "./ui/EditorToolbar.js";
import { searchState } from "./features/search/searchPlugin.js";
import { isDocumentEmpty } from "./core/emptiness.js";
import { FieldNoticeView, StatusLine } from "./ui/FieldStatus.js";
import type { FieldNotice } from "./core/fieldNotice.js";
import { FLOATING_TOOLBAR_KEY, FloatingToolbar } from "./ui/FloatingToolbar.js";
import { createEditorExtensions } from "./core/extensions.js";
import type { ToolEntry } from "./core/customTool.js";
import { customToolsError, FALLBACK_EXTENSIONS } from "./core/customToolEngine.js";
import { startLoad, type ToolLoad } from "./core/toolLoader.js";
import { skeletonHtml } from "./core/skeleton.js";
import { Button } from "../components/actions/Button.js";
import { devError, devWarn } from "../lib/dev-warn.js";
import { describeImageNotice } from "./features/image/imageNotice.js";
import { insertItemsFor } from "./core/insertItems.js";
import type { CustomColorKind } from "./features/color/customColor.js";
import { isImageSelection } from "./features/image/image.js";
import { ImagePopover } from "./features/image/ImagePopover.js";
import { ImageToolbar } from "./features/image/ImageToolbar.js";
import { textCardsOf, toolOptions, triggersOf, type ToolBridge } from "./core/toolDescriptor.js";
import type { ToolPopoverRequest } from "./core/toolButtons.js";
import type { TextCardControl } from "./ui/TextCard.js";
import { SelectionPopover } from "./ui/ToolButtonView.js";
import { tableChunk } from "./features/table/tableTool.js";
import { stickyOffset } from "./features/toc/stickyOffset.js";
import { replaceWithMarkdown } from "./core/markdown.js";
import {
  documentFromJSON,
  documentToJSON,
  replaceWithJSON,
  type RichTextDocument,
} from "./core/jsonDocument.js";
import { markdownOf } from "./core/atomText.js";
import { countCharacters, EXTERNAL_CHANGE } from "./core/maxLength.js";
import { PAPER_SHEET_CLASS, proseClass } from "./styles/prose.js";
import { SELECTION_BUBBLE_KEY, SelectionBubble } from "./ui/SelectionBubble.js";
import { useSlashMenu } from "./ui/SlashMenu.js";
import { useTriggerMenu } from "./ui/TriggerMenu.js";
import { FIELD_MIN_HEIGHT, FieldResizer } from "./ui/FieldResizer.js";
import { formatSourceHtml } from "./core/sourceFormat.js";
import { surfaceAttributes, type RichTextSurface } from "./styles/surface.js";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "./styles/tokens.js";
import type { RichTextEditorPreset } from "./core/tools.js";
import { useChangeThrottle } from "./hooks/useChangeThrottle.js";
import { useCoarsePointer } from "./hooks/useCoarsePointer.js";
import { useFieldsetDisabled } from "./hooks/useFieldsetDisabled.js";

/**
 * Поповер произвольного цвета грузится при первом «Свой цвет…»: он тянет
 * `ColorPicker` и цветовую подсистему `react-aria-components` (61 кБ gzip,
 * ADR-0038), а нужен немногим. Статический импорт поднял бы вход
 * `@olddevs/ui/editor` вдвое для всех.
 */
const CustomColorPopover = lazy(() =>
  import("./features/color/CustomColorPopover.js").then((module) => ({
    default: module.CustomColorPopover,
  }))
);

/**
 * Карточка у текста грузится, когда у набора `tools` есть хотя бы одна
 * Карточка: рамка, пересчёт диапазонов и живой регион нужны только тому,
 * кто описал Карточку, а статический импорт лёг бы на всех потребителей.
 */
const TextCard = lazy(() =>
  import("./ui/TextCard.js").then((module) => ({ default: module.TextCard }))
);

/**
 * Панель «Поиск и замена» грузится при первом открытии: поля,
 * флажки и переключатель нужны только тому, кто ищет, а `search` есть и в
 * `basic`, который меряется бюджетом «старта». Плагин подсветки и сочетания
 * маленькие и стоят в движке сразу.
 */
/*
  Ядро Оглавления (Инструмент `toc`) — ленивым чанком: его включают единицы, а
  полоса со списком и `HoverCard` стоили бы каждому Редактору ~5 kB gzip на
  старте. Чанк приходит, только когда Инструмент включён и движок готов.
*/
const TocCore = lazy(() =>
  import("./features/toc/RichTextToc.js").then((module) => ({ default: module.TocCore }))
);

const SearchPanel = lazy(() =>
  import("./features/search/SearchPanel.js").then((module) => ({ default: module.SearchPanel }))
);

/** Место панели поиска: под правым краем Панели, на телефоне — во всю ширину поля. */
const SEARCH_PANEL_PLACE_CLASS = "absolute top-full right-2 left-2 z-[2] mt-2 sm:left-auto sm:w-80";
/** Место панели поиска без фиксированной Панели — верхний угол поля. */
const SEARCH_PANEL_CORNER_CLASS = "absolute top-2 right-2 left-2 sm:left-auto sm:w-80";

export interface RichTextEditorProps {
  /**
   * Документ — HTML-строка, ограниченная Схемой. Пустой документ — `""`.
   *
   * Всё, чего нет в Схеме (теги, атрибуты, `style`, обработчики, `javascript:`),
   * отбрасывается при загрузке. Единственный `style`, который Схема знает, —
   * цвет автора в строгой форме `color:#rrggbb` на `span` и
   * `background-color:#rrggbb` на `mark` (`customColor.ts`). Это НЕ санитизация: HTML от пользователя
   * чистит сервер потребителя, клиентская очистка от XSS не защищает.
   */
  value?: string;
  /**
   * Начальный документ неуправляемого режима: HTML-строка или JSON-конверт
   * (`getJSON()`). Конверт проходит Схему, как `setJSON()`;
   * отвергнутый — пустой документ и ошибка в консоли разработки. До Готовности
   * Скелет при конверте — рамка без Документа: HTML конверта знает только движок.
   * `onChange` и скрытое поле формы получают HTML, как всегда.
   */
  defaultValue?: string | RichTextDocument;
  /**
   * Новый HTML — не чаще раза в `changeDelay` мс, а также сразу на `blur`,
   * перед отправкой формы и на применение правки HTML-режима. Замена документа
   * новым `value` сюда не приходит.
   */
  onChange?: (html: string) => void;
  /**
   * Редактор готов: движок создан, методы Хэндла (`ref`) уже действуют — например,
   * вставить шаблон. Без аргументов, один раз за монтаж, в том числе при
   * `readOnly` и `disabled`; перерисовка и смена колбэка повторного вызова не
   * дают. Ждёт загрузчики Extensions своих Инструментов. Серверный
   * рендер, ошибка набора `tools` и упавший загрузчик (движка нет) его не вызывают.
   */
  onReady?: () => void;
  /**
   * Фокус вошёл в поле. Поле — целиком: Документ, Панель, поповеры кита и поле
   * HTML; переход между ними фокус поля не теряет и `onFocus` не повторяет.
   * Без аргументов: DOM-событие не пробрасывается.
   */
  onFocus?: () => void;
  /**
   * Фокус ушёл из поля (см. `onFocus`). Перед вызовом отложенный `onChange`
   * выталкивается, поэтому автосохранение по `onBlur` получает свежий HTML.
   * Вызов отложен на такт: за это время фокус может вернуться в поле — из
   * Документа в Панель или поповер и обратно `onBlur` не даёт.
   */
  onBlur?: () => void;
  /**
   * Задержка `onChange`, мс. По умолчанию 300.
   *
   * Сериализация в HTML — проход по всему документу, и на документе в десятки
   * тысяч символов она на каждую букву тормозила бы ввод. `0` — отдавать каждую
   * правку сразу.
   */
  changeDelay?: number;
  /** Имя поля формы: рендерит `<input type="hidden">` с текущим HTML. */
  name?: string;
  /**
   * `id` редактируемой области — для внешних ссылок и тестов. Имя от подписи
   * `FormField` от него не зависит: оно приходит контекстом.
   */
  id?: string;
  /** Плейсхолдер пустого документа; по умолчанию — из каталога. */
  placeholder?: string;
  /**
   * Предел символов. Счётчик остатка появляется у 80 % предела, ввод сверх
   * него блокируется, вставка обрезается до предела. Длинный `value` грузится
   * целиком: его можно сокращать, но не удлинять.
   */
  maxLength?: number;
  /** Только чтение: текст выделяется и уходит в форму, но не правится. */
  readOnly?: boolean;
  /** Выключено, как у прочих полей: не правится, приглушено, не уходит в форму. */
  disabled?: boolean;
  /**
   * Обязательное поле: `aria-required`, а в обычной `<form>` ещё и блокировка
   * отправки, пока Документ пуст (нет ни текста, ни Атома, ни таблицы).
   * Браузер покажет сообщение из каталога (`editor.required`) и вернёт фокус
   * в Редактор. `readOnly` и `disabled` не проверяются — как у нативных полей.
   * В `Form` из кита (`noValidate`) браузерной проверки нет — ошибку показывает
   * потребитель.
   */
  required?: boolean;
  /** Имя поля, когда подписи `FormField` нет. */
  "aria-label"?: string;
  /** Имя поля ссылкой на уже нарисованную подпись. Сильнее `aria-label`. */
  "aria-labelledby"?: string;
  /** Своё описание. Сливается с подсказкой и ошибкой `FormField`. */
  "aria-describedby"?: string;
  /** Невалидность. Без пропа берётся у `FormField` с `error`. */
  "aria-invalid"?: boolean;
  /**
   * Панель форматирования. `"fixed"` (по умолчанию) — над полем, липнет при
   * прокрутке под шапкой приложения (`--topbar-h`, ADR-0016); `"floating"` —
   * над непустым выделением, а на сенсорном экране (`pointer: coarse`) —
   * фиксированная: системное меню выделения iOS и Android она не перекрывает;
   * `"bubble"` — Меню выделения вместо Панели: компактная плашка на инверсной
   * поверхности над непустым выделением («¶», жирный, курсив, зачёркнутый,
   * «…», ссылка, эмодзи), на сенсорном экране — так же фиксированная Панель;
   * `"none"` — без Панели: форматирование остаётся за клавиатурой. В режиме
   * `readOnly` Панели нет в любом случае. `Alt+F10` из Документа переводит
   * фокус в Панель или Меню выделения.
   */
  toolbar?: "fixed" | "floating" | "bubble" | "none";
  /**
   * Меню выделения поверх фиксированной Панели. По умолчанию `true`: при
   * `toolbar="fixed"` над непустым выделением появляется то же Меню
   * выделения, что в режиме `"bubble"` (решение владельца: Панель
   * сверху — для всего, Меню выделения — чтобы не уводить мышь от текста).
   * `false` оставляет одну Панель. Остальные режимы проп не меняет: у
   * `"bubble"` Меню выделения и так есть, у `"floating"` над выделением уже
   * стоит Панель. На сенсорном экране Меню выделения кита нет — системное
   * меню выделения iOS и Android занимает то же место.
   */
  selectionMenu?: boolean;
  /**
   * Пресет — готовый набор встроенных Инструментов: `"full"` (по умолчанию) —
   * всё; `"basic"` — для комментариев: жирный, курсив, зачёркнутый, строчный
   * код, ссылка, два вида списков, цитата, отмена и повтор. Игнорируется, если
   * передан `tools`.
   */
  preset?: RichTextEditorPreset;
  /**
   * Точный список Инструментов; сильнее `preset`. Выключенный Инструмент
   * убирает и кнопку, и Блок или Метку из Схемы: их не получить ни сочетанием
   * клавиш, ни markdown-шорткатом, ни вставкой.
   *
   * Вперемешку с именами кита — описания своих Инструментов (`CustomTool`):
   * `[...RICH_TEXT_PRESETS.full, mergeTagTool]`. Встроенный Инструмент с
   * Опциями (`search`, `toc`) настраивается записью `tool()`:
   * `[...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3] })]` — запись
   * включает Инструмент и без имени, а имя из пресета уступает ей; две записи
   * `tool()` с одним именем — ошибка поля. Неизвестное имя отбрасывается
   * молча; описание с ошибкой (имя без Префикса потребителя, совпадение имён,
   * Extensions мимо правил Схемы) — ошибка поля: движок не создаётся,
   * значение формы остаётся входящим, причина — в консоли разработчика.
   *
   * `preset` и `tools`, а с ними и Опции Инструментов, читаются при создании
   * движка: Схема ProseMirror после этого не меняется. Чтобы сменить набор у
   * живого поля, перемонтируйте его (`key`) — история правок при этом теряется.
   */
  tools?: readonly ToolEntry[];
  /**
   * Загрузка картинки: получает файл, отдаёт абсолютный `http(s)`-адрес, по
   * которому картинка будет жить, или отклоняет обещание.
   *
   * С ним картинку можно вставить из буфера, перетащить в поле и выбрать
   * файлом в поповере картинки. Пока обещание не решено, на месте картинки
   * плейсхолдер, а в Документе её нет; при отказе Документ не меняется, под
   * полем — сообщение. Без него файлы не принимаются — только вставка по
   * адресу. `data:` и `blob:` в Документ не пишутся никогда: адрес вне
   * политики считается отказом. Читается в момент вставки — менять можно на
   * лету.
   */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * Поверхность Документа: `"theme"` (по умолчанию) — в теме приложения;
   * `"paper"` — светлый Лист в любой теме, для писем, печати и PDF. Лист —
   * только редактируемая область: Панель, поповеры, меню и рамка фокуса поля
   * остаются в теме приложения.
   */
  surface?: RichTextSurface;
  /**
   * Строка статуса: React-узел внутри рамки поля, в строке счётчика
   * `maxLength` — своё содержимое у начала, счётчик кита в конце (число слов,
   * «Сохранено», соавтор). Видна и при `readOnly`, и при `disabled`.
   *
   * Кит её не озвучивает: контейнер без `role`, и число слов не зачитывается на
   * каждую правку. Чтобы «Сохранено» прозвучало, оберните его в
   * `role="status"` сами. Данные берите из своего состояния: Строка статуса —
   * пропс экрана, у Инструментов к ней доступа нет.
   */
  status?: ReactNode;
  /**
   * Предел высоты области Документа (ADR-0059): число — пиксели, строка —
   * любая CSS-длина (`"32rem"`, `"60vh"`). До предела поле растёт вместе с
   * Документом, дальше Документ прокручивается внутри рамки; Панель над ним и
   * Строка статуса под ним остаются на месте. Без пропа своей прокрутки у поля
   * нет. Предела в строках, как `maxRows` у `TextControl`, здесь нет: у Блоков
   * разная высота.
   */
  maxHeight?: number | string;
  /**
   * Ручка высоты в углу области Документа: высоту тянут по вертикали. С
   * `maxHeight` она задаёт стартовую высоту, а не предел — две системы,
   * одновременно распоряжающиеся высотой, дают прыгающее поле (тот же довод у
   * `autosize` в `TextControl`). Без `maxHeight` старт — высота Документа.
   */
  resizable?: boolean;
  /** Классы на корень: ширина, отступы снаружи. */
  className?: string;
}

/**
 * Императивный доступ к Редактору. Вставка, чтение текста, фокус с позицией и
 * история — `RichTextEditorHandleMethods` (`handle.ts`).
 */
export interface RichTextEditorHandle extends RichTextEditorHandleMethods {
  /**
   * Текущий HTML — сейчас, без ожидания `changeDelay`. Пустой документ — `""`.
   * В HTML-режиме сначала применяет правку поля HTML (через Схему, с
   * `onChange`, если Документ изменился).
   */
  getHTML(): string;
  /** Очистить документ. Владелец значения узнаёт об этом через `onChange("")`. */
  clear(): void;
  /**
   * Документ как Markdown — сейчас, без ожидания `changeDelay`. Пустой документ
   * и вызов до монтажа (в серверном рендере движка нет) — `""`.
   *
   * Цвет, выравнивание, подчёркивание и размер картинки в Markdown не
   * выражаются и при выгрузке теряются. В HTML-режиме — как `getHTML()`:
   * сначала применяется правка поля HTML.
   */
  getMarkdown(): string;
  /**
   * Заменить документ разобранным Markdown. Как `clear()`, это замена снаружи:
   * владелец значения узнаёт о ней через `onChange` сразу, предел `maxLength`
   * её не режет. Всё, чего нет в Схеме, отбрасывается. До монтажа — ничего.
   */
  setMarkdown(markdown: string): void;
  /**
   * Документ как JSON-конверт — сейчас, без ожидания `changeDelay`.
   * В отличие от Markdown, ничего не теряет. До монтажа и в серверном рендере —
   * `null`. В HTML-режиме — как `getHTML()`: сначала применяется правка поля HTML.
   */
  getJSON(): RichTextDocument | null;
  /**
   * Заменить документ JSON-конвертом. Параметр — `unknown`: главный источник —
   * `JSON.parse` файла, и форму проверяет Редактор. `true` — заменён, `false` —
   * конверт отвергнут (не тот формат или версия, кривое дерево) или движка ещё
   * нет; тогда Документ не тронут. Замена — снаружи, как `setMarkdown()`:
   * `onChange` сразу, `maxLength` её не режет, всё, чего нет в Схеме,
   * отбрасывается по тем же правилам, что у HTML.
   */
  setJSON(document: unknown): boolean;
  /**
   * Открыть панель «Поиск и замена» из кода экрана — то же, что
   * кнопка «Поиск» и `Mod+F`; `replace` — фокус в поле замены. Без Инструмента
   * `search`, в HTML-режиме и до монтажа — ничего.
   *
   * @deprecated Работает как `handle.tool("search")?.open(options)`; в разработке
   * один раз предупреждает об этом в консоли. Будет удалён в 5.0.
   */
  openSearch(options?: { replace?: boolean }): void;
  /**
   * Сырой движок Tiptap: честный выход для команд Меток, Блоков и своих
   * Инструментов (`editor.chain().focus()…run()`). Его API следует мажору Tiptap,
   * а не контракту кита. До монтажа и в серверном рендере — `null`.
   */
  editor: Editor | null;
}

/** Пустой документ — пустая строка, а не `<p></p>`: так его видит форма. */
// Снимок «мы в браузере после гидратации» для `useSyncExternalStore`: не меняется.
const subscribeNever = () => () => {};
const isBrowser = () => true;
const isServer = () => false;

/** Длина `maxHeight`: число — пиксели, строка — CSS-длина как есть. */
const cssLength = (value: number | string) => (typeof value === "number" ? `${value}px` : value);

function serialize(editor: Editor): string {
  return isDocumentEmpty(editor.state.doc) ? "" : editor.getHTML();
}

/*
  Плейсхолдер — псевдоэлементом на первом пустом абзаце; текст кладёт
  расширение в `data-placeholder`. Скринридеру он объявлен `aria-placeholder`
  на самом поле: содержимое `::before` читается не везде.
*/
const PLACEHOLDER_CLASS =
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none " +
  "[&_p.is-editor-empty:first-child]:before:float-left " +
  "[&_p.is-editor-empty:first-child]:before:h-0 " +
  "[&_p.is-editor-empty:first-child]:before:text-(--rte-muted-foreground) " +
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";

/*
  Картинка в правке — то, чего нет в сохранённом HTML и `RichTextView`:
  контур выделенной картинки, ручки ширины у неё (только в редактируемом
  поле), подсказка пустой подписи и пустая подпись, спрятанная в поле только
  для чтения. Классы `rte-caption-empty` и `rte-resize-handle` ставит
  `image.ts` — декорацией и в представлении узла, в Документ они не уходят.
*/
const IMAGE_EDITING_CLASS =
  "[&_figure.ProseMirror-selectednode_img]:outline-2 " +
  "[&_figure.ProseMirror-selectednode_img]:outline-offset-2 " +
  "[&_figure.ProseMirror-selectednode_img]:outline-(--rte-primary) " +
  "[&[contenteditable=true]_figure.ProseMirror-selectednode_.rte-resize-handle]:block " +
  "[&_figcaption.rte-caption-empty]:before:pointer-events-none " +
  "[&_figcaption.rte-caption-empty]:before:float-left " +
  "[&_figcaption.rte-caption-empty]:before:h-0 " +
  "[&_figcaption.rte-caption-empty]:before:w-full " +
  "[&_figcaption.rte-caption-empty]:before:text-(--rte-muted-foreground) " +
  "[&_figcaption.rte-caption-empty]:before:content-[attr(data-placeholder)] " +
  "[&[contenteditable=false]_figcaption.rte-caption-empty]:hidden";

/*
  Подсветка совпадений поиска: классы ставит плагин поиска
  декорацией, в Документ они не уходят. Все совпадения — мягкой заливкой
  тона `warning`, как маркер текстовыделителя, текущее — плотнее и с рамкой
  того же тона: его видно и среди соседних, и на жёлтом маркере. Текст не
  перекрашивается: заливка полупрозрачная, и цвет Метки под ней читается.
*/
const SEARCH_HIGHLIGHT_CLASS =
  "[&_.rte-search-match]:rounded-[2px] " +
  "[&_.rte-search-match]:bg-[color-mix(in_srgb,var(--warning)_30%,transparent)] " +
  "[&_.rte-search-current]:bg-[color-mix(in_srgb,var(--warning)_60%,transparent)] " +
  "[&_.rte-search-current]:shadow-[0_0_0_1px_var(--warning)]";

// Рамка фиксированной Панели — у неё и у её Скелета (почему такая — у разметки ниже).
const TOOLBAR_SHELL_CLASS =
  "bg-bg-2 border-line-soft rounded-t-control sticky top-[var(--topbar-h,0px)] z-[1] " +
  "-mx-3 border-b px-1.5 py-1";

/*
  Поле HTML-режима и его зеркало — одна типографика: высоту поля задаёт
  невидимый близнец в той же ячейке грида, как у `TextControl` с ростом
  (там же — почему не `scrollHeight`). Поверхность всегда тёмная, цветом кита
  (`--rte-source-*` в `styles.css`): в тёмных темах — подложка темы, в светлой
  и на листе — значения тёмной темы. Скругление — как у кода, шрифт —
  моноширинный 13 px, как у `CodeView`. Режим читается как «код», а не как ещё
  одно текстовое поле.
*/
const SOURCE_BOX_CLASS =
  "col-start-1 row-start-1 w-full rounded-(--rte-radius) border px-3 py-2 " +
  "font-mono text-[13px] leading-5 break-words whitespace-pre-wrap";
const SOURCE_FIELD_CLASS =
  "border-(--rte-source-border) bg-(--rte-source-background) text-(--rte-source-foreground) " +
  "caret-(--rte-source-foreground) " +
  // Выделение — тоже тёмной темы: глобальный `::selection` в
  // светлой теме — светлая заливка с тёмным текстом, на тёмном поле нечитаемо.
  "selection:bg-(--rte-source-selection) selection:text-(--rte-source-foreground) " +
  "resize-y outline-none disabled:cursor-not-allowed";

/**
 * Поле форматированного текста на Tiptap v3 — отдельный вход
 * `@olddevs/ui/editor` (ADR-0050).
 *
 * ЗНАЧЕНИЕ И КУРСОР. Последний HTML, о котором знает владелец значения,
 * хранится рядом с движком. Входящий `value`, равный ему, — эхо нашей же
 * правки: документ не пересоздаётся, курсор остаётся на месте. Иначе
 * управляемый режим сбрасывал бы курсор в начало на каждой букве.
 *
 * ФОРМА. Скрытое поле и `onChange` получают HTML по одному и тому же таймеру;
 * отправка формы и `new FormData(form)` сбрасывают его досрочно, поэтому в
 * отправке значение свежее даже посреди задержки.
 *
 * SSR И СКЕЛЕТ. Движок создаётся только в браузере (`immediatelyRender:
 * false`) и после загрузчиков Инструментов: до того — на сервере, после
 * гидратации, при сбое загрузчика — рисуется Скелет: рамка, место Панели и
 * Документ статичным HTML с классом Документа, без ввода и без прыжка высоты.
 * Документ Скелета — `value`, очищенный Схемой (`skeleton.ts`), и только в
 * браузере после монтирования: на сервере Скелет — рамка и место Панели.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      defaultValue,
      onChange,
      onReady,
      onFocus,
      onBlur,
      changeDelay = 300,
      name,
      id,
      placeholder,
      maxLength,
      readOnly = false,
      disabled: disabledProp = false,
      required = false,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      toolbar = "fixed",
      selectionMenu = true,
      preset = "full",
      tools,
      onUploadImage,
      status,
      surface = "theme",
      maxHeight,
      resizable = false,
      className,
    },
    ref
  ) {
    const messages = useMessages();
    /*
      Набор инструментов замораживается при монтаже: из него собрана Схема, а
      Схему у живого движка не поменять. Панель читает тот же замороженный
      набор — иначе новый `tools` показал бы кнопку, которой Схема не знает.
      Набор — список описаний Инструментов (`features/builtins.ts`), поверхности
      читают его проекцию.
    */
    const [enabledTools] = useState(() => expandTools(preset, tools));
    /*
      Загрузчики Extensions (ADR-0058, п. 11.3–11.6). Загрузка стартует
      в рендере, а не в эффекте: с первого рендера в браузере, ещё до монтажа;
      на сервере — никогда. Промис кэширован на загрузчике (`toolLoader.ts`):
      повторный рендер и второй Редактор его не зовут. Набор движка собирается,
      только когда отработали все (`ready`): Схема фиксируется при создании, и
      Блоки из `value` без Extensions потерялись бы при разборе.
    */
    const loaders = enabledTools.descriptors.flatMap((descriptor) => descriptor.load ?? []);
    const loads = loaders.map((loader) =>
      typeof window === "undefined" ? ({} as ToolLoad) : startLoad(loader)
    );
    const loading = loads.some((load) => !load.done && !load.failed);
    const ready = loads.every((load) => load.done);
    const [, setLoadRound] = useState(0);
    useEffect(() => {
      if (!loading) return;
      let live = true;
      void Promise.all(loads.map((load) => load.promise)).then(
        () => live && setLoadRound((round) => round + 1)
      );
      return () => void (live = false);
    }, [loading]);
    // «Повторить» зовёт заново только упавшие загрузчики: удачные — в кэше.
    // Сбой виден после первого эффекта (`engine` ниже): строка, которой не было
    // на сервере, сломала бы гидратацию.
    const retryLoads = () => {
      for (const loader of loaders) startLoad(loader, true);
      setLoadRound((round) => round + 1);
    };
    const editorRef = useRef<Editor | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    // Выключенный `<fieldset>` выключает и редактор, как нативное поле: так
    // же ведёт себя `Form pending`, а чужой `fieldset` покрывается тем же
    // правилом.
    const inDisabledFieldset = useFieldsetDisabled(rootRef);
    const disabled = disabledProp || inDisabledFieldset;
    const hiddenRef = useRef<HTMLInputElement>(null);
    const proxyRef = useRef<HTMLInputElement>(null);
    /*
      Начальный конверт: HTML из него собирает только движок по своей Схеме,
      поэтому до него значение — пустая строка, а Документ встаёт при появлении
      движка (эффект ниже). `value` главнее, как и HTML-строки в `defaultValue`.
    */
    const initialDocument =
      value === undefined && typeof defaultValue === "object" ? defaultValue : undefined;
    const initialDocumentRef = useRef(initialDocument);
    initialDocumentRef.current = initialDocument;
    const initial = value ?? (typeof defaultValue === "string" ? defaultValue : "");
    /*
      Последний HTML, о котором владелец значения знает: отданный в `onChange`
      или полученный в `value`. Входящий `value`, равный ему, — эхо нашей же
      правки, и пересоздавать по нему документ нельзя.
    */
    const knownRef = useRef(initial);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Колбэки событий — тоже через ref: они читаются позже рендера (эффект
    // готовности, таймер ухода фокуса), а новый колбэк события не повторяет.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;
    /*
      Предел и плейсхолдер расширения читают через ref: набор расширений живёт
      столько же, сколько движок, а пересоздавать движок ради нового числа или
      смены локали значило бы терять историю правок и курсор.
    */
    const limitRef = useRef(maxLength);
    limitRef.current = maxLength;
    const placeholderText = placeholder ?? messages.editor.placeholder;
    const placeholderRef = useRef(placeholderText);
    placeholderRef.current = placeholderText;
    const taskCheckboxRef = useRef(messages.editor.taskCheckbox);
    taskCheckboxRef.current = messages.editor.taskCheckbox;
    const detailsToggleRef = useRef(messages.editor.detailsToggle);
    detailsToggleRef.current = messages.editor.detailsToggle;
    // Кавычки `typography` читаются в момент ввода: смена каталога движок не пересоздаёт.
    const quoteSetRef = useRef(messages.editor.typographyQuotes);
    quoteSetRef.current = messages.editor.typographyQuotes;
    // Загрузчик и строки картинки — тоже через ref: расширение их читает в
    // момент вставки файла и при перерисовке подписи, а не при создании движка.
    const uploadRef = useRef(onUploadImage);
    uploadRef.current = onUploadImage;
    const imageMessagesRef = useRef(messages.editor);
    imageMessagesRef.current = messages.editor;

    /*
      Число символов держится состоянием только при `maxLength`: без предела
      счётчика нет, и пересчитывать документ на каждую букву незачем. Функции
      ниже читают только ref и сеттер состояния, поэтому в зависимостях
      эффектов им делать нечего.
    */
    const [count, setCount] = useState(0);
    /**
     * Поповер записи описания у выделения или у Блока (`ToolButtonView.tsx`):
     * его открывают сочетание кнопки, кнопка ссылки, пункт вставки и Действие
     * над Блоком — командой движка. После закрытия запрос остаётся
     * (`open: false`), чтобы рамка закрылась штатно.
     */
    const [toolPopover, setToolPopover] = useState<{
      request: ToolPopoverRequest;
      open: boolean;
    } | null>(null);
    // Поповер произвольного цвета: `null` — не открывали; после закрытия остаётся
    // смонтированным (`open: false`), чтобы не грузить модуль заново.
    const [customColor, setCustomColor] = useState<{
      kind: CustomColorKind;
      open: boolean;
    } | null>(null);
    const openCustomColor = (kind: CustomColorKind) => setCustomColor({ kind, open: true });
    /** Открыт ли поповер картинки: кнопка Панели, пункт Меню вставки, панель картинки. */
    const [imageOpen, setImageOpen] = useState(false);
    // Окно «Вставить таблицу» — у Редактора, а не у меню: см. `TableInsertDialog`.
    // Окно — из ленивого чанка таблицы (`tableTool.ts`): движок с таблицей
    // создаётся после него, а без движка окна нет.
    const TableInsertDialog = tableChunk()?.TableInsertDialog;
    const [tableDialogOpen, setTableDialogOpen] = useState(false);
    /**
     * Сообщение поля (`showNotice`, `fieldNotice.ts`): одно, последнее. `status`
     * — для живого региона, `error` — видимая строка под полем; правка
     * Документа снимает `error`.
     */
    const [notice, setNotice] = useState<FieldNotice | null>(null);
    /*
      HTML-режим: `null` — визуальный, иначе текст поля HTML и
      высота Документа при входе — ниже неё поле не бывает, и страница не
      прыгает. Режим — состояние Редактора, а не проп: движок остаётся
      смонтированным и скрытым, история правок живёт.

      Текст и база сравнения дублируются в ref: применение зовут обработчики
      формы и `ref`-хэндл, у которых нет свежего замыкания. База — текст на
      входе или после последнего применения: неизменённый текст не порождает
      ни транзакции, ни шага истории, ни `onChange`.
    */
    const [source, setSource] = useState<{ text: string; minHeight: number } | null>(null);
    const sourceOpen = source !== null;
    /**
     * Панель поиска: `token` растёт с каждым открытием — повторный
     * `Mod+F` при открытой панели заново ставит фокус в поле поиска; `query` —
     * текст, выделенный в Документе в момент открытия.
     */
    const [searchPanel, setSearchPanel] = useState<{
      token: number;
      replace: boolean;
      query: string;
    } | null>(null);
    /** Переход ядра Оглавления (`TocCore`): есть, пока оно смонтировано. */
    const tocJumpRef = useRef<((index: number) => boolean) | null>(null);
    const sourceFieldRef = useRef<HTMLTextAreaElement>(null);
    const sourceTextRef = useRef<string | null>(null);
    const sourceBaseRef = useRef("");
    /** Куда поставить фокус после смены режима: вход — в поле, выход кнопкой — в Документ. */
    const switchFocusRef = useRef<"source" | "document" | null>(null);
    // Расширение живёт столько же, сколько движок, а режим Панели меняется на
    // лету (`pointer: coarse`): обработчик `Alt+F10` читается через ref.
    const focusToolbarRef = useRef<() => boolean>(() => false);
    // `Mod+/` — меню ручки Блока; обработчик кладёт сама ручка (`BlockHandle`).
    const openBlockMenuRef = useRef<() => boolean>(() => false);
    // `Alt+F10` ведёт в открытую Карточку у текста раньше, чем в Панель (`TextCard`).
    const textCardRef = useRef<TextCardControl | null>(null);
    const recount = (current: Editor) => {
      if (limitRef.current !== undefined) setCount(countCharacters(current.state.doc));
    };
    const emit = (html: string) => {
      knownRef.current = html;
      if (hiddenRef.current) hiddenRef.current.value = html;
      onChangeRef.current?.(html);
    };

    /*
      Проверка обязательности. Пустым документ считается по правилу кита
      (`emptiness.ts`): атом (`hr`, картинка, свой атом) и таблица, даже с
      пустыми ячейками, — содержимое, документ из одного такого блока форму не
      блокирует. Эта же проверка решает, что в скрытое поле уходит `""`.

      Вызывается на каждую правку, а не по таймеру `onChange`: отправка может
      случиться через 50 мс после первой буквы, и запоздавшая валидность
      заблокировала бы форму с текстом.

      В HTML-режиме с неприменённой правкой пустоту решает текст поля, а не
      Документ: браузер проверяет ограничения ДО события `submit`, а правку
      применяет его захват — `form.requestSubmit()` с фокусом в поле иначе
      заблокировал бы форму с текстом в поле как пустую (и пропустил бы
      очищенное поле). Текст разбирается тем же `createDocument` Tiptap со Схемой, что
      и при применении, а пустота — то же правило кита, что у Документа.
      Разбор — только когда проверка включена: без `required` он ни к чему.
    */
    const validatableRef = useRef(false);
    const requiredMessageRef = useRef(messages.editor.required);
    requiredMessageRef.current = messages.editor.required;
    const fieldEmpty = (current: Editor) => {
      const text = sourceTextRef.current;
      return text !== null && text !== sourceBaseRef.current
        ? isDocumentEmpty(createDocument(text, current.schema))
        : isDocumentEmpty(current.state.doc);
    };
    const syncValidity = (current: Editor) => {
      proxyRef.current?.setCustomValidity(
        validatableRef.current && fieldEmpty(current) ? requiredMessageRef.current : ""
      );
    };

    const throttle = useChangeThrottle(() => {
      const current = editorRef.current;
      if (current && !current.isDestroyed) emit(serialize(current));
    }, changeDelay);

    /*
      Применение HTML-режима: текст поля проходит тем же разбором Схемой, что
      входящий `value`, и заменяет Документ одной транзакцией — одним шагом
      истории, который `Ctrl/⌘+Z` в Документе откатывает целиком. Зовётся на
      выход из режима, `blur` поля, отправку формы, `formdata`, `getHTML()`,
      `getMarkdown()` и переход в `readOnly`.

      Неизменённый текст и текст, разбор которого дал тот же Документ (только
      пробелы между Блоками), ничего не меняют: «открыл — посмотрел — закрыл»
      не пачкает отмену и не зовёт `onChange`.

      Замена — снаружи для предела (`EXTERNAL_CHANGE`): как `setMarkdown`, она
      не режется, а счётчик показывает превышение. `onChange` — сразу, как на
      `blur`, без `changeDelay`; ожидающий таймер снимается после замены, иначе
      он отдал бы то же значение вторично. `closeHistory` с обеих сторон:
      применение не сливается ни с правкой до входа, ни с первой правкой после.
    */
    const applySource = () => {
      const current = editorRef.current;
      const text = sourceTextRef.current;
      if (!current || current.isDestroyed || text === null || text === sourceBaseRef.current) {
        return;
      }
      sourceBaseRef.current = text;
      const next = createDocument(text, current.schema);
      if (next.eq(current.state.doc)) return;
      current
        .chain()
        .setMeta(EXTERNAL_CHANGE, true)
        .command(({ tr }) => {
          closeHistory(tr);
          return true;
        })
        .setContent(next, { emitUpdate: false })
        .run();
      current.view.dispatch(closeHistory(current.state.tr));
      throttle.cancel();
      recount(current);
      syncValidity(current);
      emit(serialize(current));
    };
    const applySourceRef = useRef(applySource);
    applySourceRef.current = applySource;
    /*
      Размонтирование применяет правку, как `blur`: Escape в поле HTML внутри
      `Dialog` закрывает окно, и Редактор уходит из дерева без `blur` поля —
      правка пропала бы молча. Движок к этому моменту жив: `useEditor` Tiptap
      уничтожает его таймером после своей очистки, а очистки эффектов идут
      одним проходом раньше таймера. Отданный `onChange` — тот же, что на
      `blur`; без правки (`sourceBaseRef`) ничего не зовётся.
    */
    useEffect(() => () => applySourceRef.current(), []);

    /** Текст поля HTML — форматированием Документа как есть: вход и замены снаружи. */
    const writeSource = (current: Editor) => {
      const text = formatSourceHtml(serialize(current));
      sourceTextRef.current = text;
      sourceBaseRef.current = text;
      return text;
    };
    /*
      Документ заменён снаружи в режиме (`value`, `setMarkdown`, `clear`):
      текст поля перезаписывается новым Документом — владелец значения главнее
      несохранённой правки, как и в визуальном режиме.
    */
    const rewriteSource = (current: Editor) => {
      if (sourceTextRef.current === null) return;
      const text = writeSource(current);
      setSource((previous) => previous && { ...previous, text });
    };
    const openSource = () => {
      const current = editorRef.current;
      if (!current) return;
      // Документа на экране не будет — искать в нём негде. Подсветка бывает и без
      // панели (команда `setQuery`): `next()` в скрытом Документе вышла бы удачной.
      if (enabledTools.has("search")) closeSearch(false);
      const text = writeSource(current);
      switchFocusRef.current = "source";
      setSource({ text, minHeight: current.view.dom.getBoundingClientRect().height });
    };
    const closeSource = (focusDocument: boolean) => {
      applySource();
      sourceTextRef.current = null;
      switchFocusRef.current = focusDocument ? "document" : null;
      setSource(null);
    };
    /** Фокус в поле: в HTML-режиме — поле HTML, иначе Документ. */
    const focusField = () => {
      if (sourceTextRef.current !== null) sourceFieldRef.current?.focus();
      else editorRef.current?.commands.focus();
    };
    const focusFieldRef = useRef(focusField);
    focusFieldRef.current = focusField;

    /*
      Открыть панель поиска: кнопка Панели, `Mod+F`/`Mod+Alt+F` из движка и
      команда `open` Инструмента. Выделенный текст одного Блока становится запросом,
      как в редакторах кода; выделение через Блоки — нет: запрос не переходит
      границу Блока, и такой текст не нашёлся бы. Явный `query` команды главнее
      выделения. В HTML-режиме Документа на экране нет — искать негде, и `Mod+F`
      остаётся браузеру.
    */
    const openSearch = (replace: boolean, query?: string): boolean => {
      const current = editorRef.current;
      if (!current || !enabledTools.has("search") || sourceTextRef.current !== null) return false;
      const { $from, $to, empty } = current.state.selection;
      const selected =
        !empty && $from.sameParent($to) ? current.state.doc.textBetween($from.pos, $to.pos) : "";
      setSearchPanel((previous) => ({
        token: (previous?.token ?? 0) + 1,
        replace,
        query: query ?? selected,
      }));
      // Подсветка и переходы — сразу, не дожидаясь ленивой панели.
      if (query !== undefined) current.commands.setSearch(query);
      return true;
    };
    const openSearchRef = useRef(openSearch);
    openSearchRef.current = openSearch;
    /*
      Закрыть панель поиска: Escape, «Закрыть», повторная кнопка «Поиск».
      Каретка — на текущем совпадении, фокус — в Документе: автор продолжает с
      того места, где искал. При входе в HTML-режим — без фокуса: он уходит в
      поле HTML.
    */
    const closeSearch = (focusDocument: boolean) => {
      const current = editorRef.current;
      if (current && !current.isDestroyed) {
        const state = searchState(current.state);
        const match = state?.matches[state.current];
        const chain = current.chain();
        if (focusDocument) chain.focus();
        if (focusDocument && match) chain.setTextSelection({ from: match.from, to: match.to });
        chain.clearSearch().run();
      }
      setSearchPanel(null);
      return true;
    };

    // Пункты Меню вставки — из того же замороженного набора, что и Схема.
    const insertItems = useMemo(() => insertItemsFor(enabledTools), [enabledTools]);
    const textCardEntries = useMemo(() => textCardsOf(enabledTools), [enabledTools]);
    const slash = useSlashMenu(insertItems, editorRef);
    const slashBridge = slash.bridge;
    const triggerRecords = useMemo(() => triggersOf(enabledTools), [enabledTools]);
    const triggerMenu = useTriggerMenu(triggerRecords, editorRef);
    const triggerBindings = triggerMenu.bindings;

    const extensions = useMemo(
      () =>
        ready &&
        createEditorExtensions({
          tools: enabledTools,
          placeholder: () => placeholderRef.current,
          limit: () => limitRef.current,
          taskCheckbox: (text) => taskCheckboxRef.current({ text }),
          detailsToggle: (text) => detailsToggleRef.current({ text }),
          quoteSet: () => quoteSetRef.current,
          slash: slashBridge,
          triggers: triggerBindings,
          openPopover: (request) => setToolPopover({ request, open: true }),
          focusToolbar: () => focusToolbarRef.current(),
          openBlockMenu: () => openBlockMenuRef.current(),
          onNotice: setNotice,
          openSearch: (replace) => openSearchRef.current(replace),
          image: {
            /*
              Поповер открывается кадром позже. Пункт Меню вставки зовёт
              команду в цепочке после `focus()`, а Tiptap возвращает фокус в
              документ в следующем кадре: открытый сразу поповер получил бы
              фокус в поле адреса и тут же потерял его — и закрылся как
              «фокус ушёл наружу».
            */
            onOpenEditor: () => requestAnimationFrame(() => setImageOpen(true)),
            captionPlaceholder: () => imageMessagesRef.current.imageCaption,
            uploadingLabel: (name) => imageMessagesRef.current.imageUploading({ name }),
            upload: () => uploadRef.current,
            describeNotice: (event) => describeImageNotice(event, imageMessagesRef.current),
          },
        }),
      [enabledTools, slashBridge, triggerBindings, ready]
    );
    /*
      Ошибка сборки набора своих Инструментов (ADR-0058, п. 1.5, 2.4) — ошибка
      поля: Схема с таким набором потеряла бы чужие Блоки уже при разборе
      `value`. Движок тогда собирается из запасного набора и пустым, а наружу
      не выходит (`editor` ниже — `null`, как до монтажа): Хэндл тихий,
      скрытое поле несёт входящее значение, `onChange` молчит. Набор с
      загрузчиками проверяется, когда они отработали: Extensions — их итог.
    */
    const toolsError = useMemo(
      () => extensions && customToolsError(enabledTools, extensions),
      [enabledTools, extensions]
    );
    useEffect(() => {
      if (toolsError) devError(`RichTextEditor: ${toolsError.message}`, toolsError.cause);
    }, [toolsError]);

    /*
      Имя подписи `FormField`. `<label for>` браузер связывает только с
      «labelable»-элементами — `input`, `textarea`, `select`, — а
      `contenteditable` к ним не относится: подпись была бы видна, но поле
      оставалось бы безымянным.

      Поэтому имя идёт ссылкой: `FormField` публикует `id` своей подписи
      контекстом, и поле ставит его в `aria-labelledby`. Явные `aria-label` и
      `aria-labelledby` сильнее: потребитель знает про своё поле больше.

      Щелчок по подписи нативно сюда не доходит по той же причине, поэтому
      слушатель вешается на сам узел подписи — только на чтение: `FormField`
      остаётся как есть, а правило «подпись фокусирует поле» живёт у поля.
      Подпись, у которой `for` указывает на настоящий нативный control, не
      трогаем: её фокус уже решён браузером.
    */
    const fieldLabelId = useFieldLabelId();
    useEffect(() => {
      const label = fieldLabelId
        ? rootRef.current?.ownerDocument.getElementById(fieldLabelId)
        : null;
      if (!(label instanceof HTMLLabelElement) || label.control) return;
      const focus = () => focusFieldRef.current();
      label.addEventListener("click", focus);
      return () => label.removeEventListener("click", focus);
    }, [fieldLabelId]);

    /*
      Счётчик появляется у 80 % предела и до того не занимает места. Пока он
      виден, он входит в описание поля: скринридер называет остаток при входе
      в поле, но не объявляет каждую букву — живой регион на счётчике говорил
      бы поверх набора.
    */
    const counterId = useId();
    const counter =
      maxLength !== undefined && count >= maxLength * 0.8
        ? count > maxLength
          ? messages.editor.overLimit({ count: count - maxLength })
          : messages.editor.remaining({ count: maxLength - count })
        : null;

    const describedBy = useDescribedBy(
      [ariaDescribedBy, counter != null ? counterId : undefined].filter(Boolean).join(" ") ||
        undefined
    );
    // Явный проп сильнее раскладки формы — тот же порядок, что у `TextControl`.
    const fieldInvalid = useFieldInvalid();
    const invalid = ariaInvalid ?? fieldInvalid;
    const labelledBy = ariaLabelledBy ?? (ariaLabel ? undefined : fieldLabelId);
    const editable = !readOnly && !disabled;
    /*
      Плавающая Панель и меню выделения на сенсорном экране спорят с системным
      меню выделения («Копировать / Вставить») за одно место над текстом и
      проигрывают ему: там вместо них фиксированная Панель (спека, «Панель и
      Меню вставки»; то же для плашки).
    */
    const coarsePointer = useCoarsePointer();
    const toolbarMode =
      (toolbar === "floating" || toolbar === "bubble") && coarsePointer ? "fixed" : toolbar;
    // Плашка выделения: своим режимом или поверх фиксированной Панели (но не
    // поверх той, что заменила плавающую на сенсорном экране).
    const bubbleShown =
      toolbarMode === "bubble" || (toolbar === "fixed" && selectionMenu && !coarsePointer);
    /*
      HTML-режим — только у фиксированной Панели: у плавающей и меню
      выделения кнопки нет (они живут над выделением в Документе), при `none` и
      в `readOnly` Панели нет. Пропала кнопка при открытом режиме — режим
      закрывается с применением: входа без выхода не бывает.
    */
    const sourceAvailable = enabledTools.has("source") && toolbarMode === "fixed" && !readOnly;

    /*
      Область Документа (ADR-0059): Документ, его Скелет, поле HTML-режима и
      ручка Блока. С `maxHeight` или `resizable` она прокручивает их сама —
      Панель над ней и Строка статуса под ней остаются на месте. `relative`
      делает её началом координат ручки Блока, и ручка едет вместе с текстом;
      плашки над выделением слушают её прокрутку (`scrollTarget`). Без пропов
      это простой блок без стилей: поле растёт с Документом, как раньше.

      Поля `-mx-3 px-3` — под горизонтальный отступ оболочки, как у Панели:
      полоса прокрутки встаёт у рамки, а ручка Блока слева не срезается.
    */
    const scrolls = maxHeight != null || resizable;
    const [scrollArea, setScrollArea] = useState<HTMLDivElement | null>(null);
    const scrollTarget = scrolls ? (scrollArea ?? undefined) : undefined;
    const areaLength = maxHeight == null ? undefined : cssLength(maxHeight);
    /** Высота, натянутая ручкой (`FieldResizer`); `null` — стартовая. */
    const [areaHeight, setAreaHeight] = useState<number | null>(null);
    const areaStyle: CSSProperties | undefined = !scrolls
      ? undefined
      : resizable
        ? {
            height: areaHeight != null ? `${areaHeight}px` : areaLength,
            minHeight: FIELD_MIN_HEIGHT,
          }
        : { maxHeight: areaLength };

    /*
      Оглавление в левом поле (Инструмент `toc`, ADR-0068). Полоса липнет под
      фиксированной Панелью: её высота меряется, потому что Панель переносит
      ряд кнопок на узком поле. В прокручиваемом поле край — верх области.
    */
    const tocOptions = toolOptions(enabledTools, "toc");
    const tocOn = enabledTools.has("toc") && tocOptions !== undefined;
    const tocOffsetVar = tocOptions?.offsetVar ?? "--topbar-h";
    const [toolbarShell, setToolbarShell] = useState<HTMLDivElement | null>(null);
    const [toolbarHeight, setToolbarHeight] = useState(0);
    useEffect(() => {
      if (!toolbarShell || typeof ResizeObserver === "undefined") {
        setToolbarHeight(toolbarShell?.offsetHeight ?? 0);
        return;
      }
      const observer = new ResizeObserver(() => setToolbarHeight(toolbarShell.offsetHeight));
      observer.observe(toolbarShell);
      return () => observer.disconnect();
    }, [toolbarShell]);
    /*
      Нижний край липкого верха поля: шапка приложения и Панель над Документом.
      Не `null` никогда, даже без шапки: иначе переход ушёл бы в `scrollIntoView`,
      а тот двигает и страницу вокруг поля с `maxHeight`. В прокручиваемом поле
      подсветка и переход считают от верха области и этот край не используют.
    */
    const tocStickyTop = useCallback(
      () => (stickyOffset(tocOffsetVar) ?? 0) + toolbarHeight,
      [tocOffsetVar, toolbarHeight]
    );
    /*
      Переход в правке ставит каретку в конец заголовка, как структура документа
      в Google Docs: с ним можно сразу писать. Прокрутку делает Оглавление, а
      движок не прокручивает, чтобы не спорить с ним.
      В `readOnly` каретки нет — фокус на заголовок ставит само Оглавление.
    */
    const tocFocusHeading = useCallback((heading: HTMLElement) => {
      const current = editorRef.current;
      if (!current || current.isDestroyed || !current.isEditable) return false;
      const inside = current.view.posAtDOM(heading, 0);
      const end = inside + current.state.doc.resolve(inside).parent.content.size;
      current.commands.setTextSelection(end);
      // `view.focus()`, а не команда `focus`: та ставит фокус кадром позже, и
      // пункт списка, отпускающий фокус после клика, отдал бы его странице.
      // ProseMirror фокусирует без прокрутки — прокрутку делает Оглавление.
      current.view.focus();
      return true;
    }, []);

    /*
      `Alt+F10` — фокус на первое доступное действие Панели. Плавающую Панель
      клавиша показывает сама, не дожидаясь задержки показа: человек с
      клавиатуры выделил текст и сразу просит Панель. На пустом выделении
      плавающей Панели нет — клавиша уходит дальше, как без Панели вовсе. Меню
      выделения (`bubble`) — ровно так же, своим ключом плагина.
    */
    focusToolbarRef.current = () => {
      const current = editorRef.current;
      const root = rootRef.current;
      if (!current || !root) return false;
      // Открытая Карточка у текста ближе Панели; спрятанная клавишу не берёт.
      if (textCardRef.current?.focus()) return true;
      if (readOnly) return false;
      /*
        HTML-режим (из поля HTML, `onKeyDown` ниже): Документа нет, остальные
        действия Панели — `aria-disabled`. Фокус — на первое, которое
        сработает, то есть на саму «HTML»: Enter на ней возвращает визуальный
        режим, а стрелки ведут по Панели дальше, как обычно.
      */
      if (sourceTextRef.current !== null) {
        const action = root
          .querySelector('[role="toolbar"]')
          ?.querySelector<HTMLElement>('button:not([disabled]):not([aria-disabled="true"])');
        if (!action) return false;
        action.focus();
        return true;
      }
      // Выделена картинка — `Alt+F10` ведёт в её панель: действия над
      // выделенным ближе, чем Панель форматирования, которой картинке нечего дать.
      if (isImageSelection(current.state.selection)) {
        const action = root.querySelector<HTMLElement>(
          '[data-image-toolbar] [role="toolbar"] button:not([disabled])'
        );
        if (action) {
          action.focus();
          return true;
        }
      }
      if (toolbarMode === "floating" || toolbarMode === "bubble") {
        if (current.state.selection.empty) return false;
        const key = toolbarMode === "floating" ? FLOATING_TOOLBAR_KEY : SELECTION_BUBBLE_KEY;
        current.view.dispatch(current.state.tr.setMeta(key, "show"));
        /*
          Плагин на `show` сначала считает позицию, потом показывает, а счёт
          у спрятанного меню — пустой ход. Без второй команды меню, спрятанное
          до нажатия, встало бы без координат под полем, куда плагин кладёт
          свой узел, и доехало бы до выделения только с его таймером (250 мс).
        */
        current.view.dispatch(current.state.tr.setMeta(key, "updatePosition"));
      }
      const action = root
        .querySelector('[role="toolbar"]')
        ?.querySelector<HTMLElement>("button:not([disabled])");
      if (!action) return false;
      action.focus();
      return true;
    };
    // Нативный `required` не проверяется у `readonly` и выключенных полей —
    // здесь то же правило.
    const validatable = required && editable;
    validatableRef.current = validatable;
    const requiredMessage = messages.editor.required;

    /*
      Атрибуты редактируемой области. Объект пересобирается только при смене
      значений: `useEditor` сверяет опции по ссылке и иначе переустанавливал бы
      их движку на каждом рендере.
    */
    const slashAttributes = slash.attributes;
    const triggerAttributes = triggerMenu.attributes;
    // Класс Документа — общий у движка и Скелета: ритм и отступы одни, и высота не прыгает.
    const documentClass = cn(
      proseClass(surface),
      PLACEHOLDER_CLASS,
      IMAGE_EDITING_CLASS,
      SEARCH_HIGHLIGHT_CLASS,
      // Лист отступает от рамки поля: край листа виден на подложке поля.
      surface === "paper" ? "my-3 min-h-24 outline-none" : "min-h-24 py-2.5 outline-none",
      // Левое поле под ручку Блока (`BlockHandle`): ручка стоит в нём и
      // текст не перекрывает. Только там, где ручка бывает, — не в
      // `readOnly`; у выключенного поля остаётся, чтобы текст не прыгал.
      !readOnly && (surface === "paper" ? "pl-10" : "pl-6")
    );
    const editorProps = useMemo(() => {
      const attributes: Record<string, string> = {
        role: "textbox",
        "aria-multiline": "true",
        "aria-placeholder": placeholderText,
        // Глобальный контур `:focus-visible` здесь лишний — фокус показывает
        // рамка поля, как у `TextControl`.
        "data-disable-focus-ring": "true",
        class: documentClass,
        ...surfaceAttributes(surface),
      };
      if (id) attributes.id = id;
      if (labelledBy) attributes["aria-labelledby"] = labelledBy;
      else attributes["aria-label"] = ariaLabel ?? messages.editor.label;
      if (describedBy) attributes["aria-describedby"] = describedBy;
      if (invalid) attributes["aria-invalid"] = "true";
      if (required) attributes["aria-required"] = "true";
      if (readOnly) attributes["aria-readonly"] = "true";
      if (disabled) attributes["aria-disabled"] = "true";
      // Меню вставки открывается только в правке: полю только для чтения
      // обещать список нечего.
      if (editable) Object.assign(attributes, slashAttributes, triggerAttributes);
      return { attributes };
    }, [
      editable,
      slashAttributes,
      triggerAttributes,
      id,
      labelledBy,
      ariaLabel,
      messages.editor.label,
      describedBy,
      invalid,
      required,
      readOnly,
      disabled,
      placeholderText,
      surface,
      documentClass,
    ]);

    /*
      Пока загрузчики работают или набор с ошибкой, движок `useEditor` собран
      из запасного набора и наружу не выходит. Набор сменился — запасной
      уничтожается: живому движку Tiptap только переставляет опции, Схему не
      пересобирает, а уничтоженный создаёт заново с новым набором. Эффект стоит
      РАНЬШЕ `useEditor`: эффекты идут в порядке объявления, и его — первым.
    */
    const engineSet = extensions && !toolsError ? extensions : FALLBACK_EXTENSIONS;
    const engineRef = useRef<Editor | null>(null);
    useEffect(() => {
      if (engineRef.current?.options.extensions !== engineSet) engineRef.current?.destroy();
    }, [engineSet]);
    const engine = useEditor({
      immediatelyRender: false,
      extensions: engineSet,
      content: engineSet === extensions ? initial : "",
      editable,
      editorProps,
      onUpdate: ({ editor: updated }) => {
        // Правка снимает ошибку: она про прошлое действие.
        setNotice((current) => (current?.tone === "error" ? null : current));
        recount(updated);
        syncValidity(updated);
        throttle.schedule();
      },
      onBlur: () => throttle.flush(),
    });
    engineRef.current = engine;
    const loadFailed = !!engine && !loading && !ready;
    const editor = engine?.options.extensions === extensions ? engine : null;
    editorRef.current = editor;
    /*
      Документ Скелета — только в браузере после монтирования: разбор Схемой
      идёт в DOM браузера, а сервер и гидратация видят пустой Скелет, иначе
      разметка разошлась бы. Клиентский рендер без SSR получает Документ с
      первого кадра (`useSyncExternalStore` отдаёт серверный снимок только при
      гидратации). Пересчёт — на новый `value` и на каждый отработавший
      загрузчик: их число только растёт (повтор зовёт лишь упавшие).
    */
    const mounted = useSyncExternalStore(subscribeNever, isBrowser, isServer);
    const settledLoads = loads.filter((load) => load.done).length;
    const skeleton = useMemo(
      () =>
        mounted && !editor
          ? skeletonHtml(
              initial,
              enabledTools,
              loaders.filter((_, index) => !loads[index]?.done)
            )
          : "",
      [mounted, !editor, initial, enabledTools, settledLoads]
    );

    /*
      Начальный конверт встаёт сразу при появлении движка — в фазе компоновки,
      до первой отрисовки: пустой Документ на экране не мелькает. Это начальное
      значение, а не правка: ни `onChange`, ни шага истории; предел символов его
      не режет. Скрытое поле и счётчик сверяются ниже, как для HTML.
    */
    useLayoutEffect(() => {
      const envelope = initialDocumentRef.current;
      if (!editor || !envelope) return;
      const next = documentFromJSON(editor, envelope);
      if (!next) {
        devError("RichTextEditor: defaultValue is not a rich text document; it is ignored");
        return;
      }
      editor
        .chain()
        .setMeta(EXTERNAL_CHANGE, true)
        .setMeta("addToHistory", false)
        .setContent(next, { emitUpdate: false })
        .run();
      knownRef.current = serialize(editor);
    }, [editor]);

    /*
      Движок появился — скрытое поле и счётчик сверяются с разобранным
      документом. Не в `onCreate`: Tiptap шлёт его таймером уже после монтажа, и
      до того счётчик показывал бы ноль при длинном `value`. Скрытое поле до
      этого момента несёт входящую строку как есть — так её получает и
      серверный рендер, где движка нет вовсе.
    */
    useEffect(() => {
      if (!editor) return;
      if (hiddenRef.current) hiddenRef.current.value = serialize(editor);
      // Предел мог появиться позже движка — счётчику нужен свежий пересчёт.
      if (maxLength !== undefined) setCount(countCharacters(editor.state.doc));
    }, [editor, maxLength]);

    // Прокси появляется и пропадает вместе с `required`, а текст сообщения —
    // с локалью: валидность сверяется с документом и при этом, не только на
    // правке.
    useEffect(() => {
      if (editor) syncValidity(editor);
    }, [editor, validatable, requiredMessage]);

    // Плейсхолдер расширение перерисовывает только на транзакции: смена
    // локали без правки документа оставила бы на экране прежнюю строку.
    useEffect(() => {
      if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
    }, [editor, placeholderText]);

    useEffect(() => {
      if (!editor || value === undefined || value === knownRef.current) return;
      // Документ заменён снаружи — ожидающая правка относится к прежнему и
      // отдавать её нечего. Замена не правка автора: `onChange` молчит, а
      // предел символов её не режет (`EXTERNAL_CHANGE`).
      throttle.cancel();
      knownRef.current = value;
      editor.chain().setMeta(EXTERNAL_CHANGE, true).setContent(value, { emitUpdate: false }).run();
      recount(editor);
      syncValidity(editor);
      if (hiddenRef.current) hiddenRef.current.value = serialize(editor);
      rewriteSource(editor);
    }, [editor, value, throttle]);

    // `useEditor` переносит в движок все опции, кроме `editable`: её он
    // намеренно сохраняет у живого движка. Поэтому режим — отдельным вызовом,
    // и без события `update`: смена режима не правка.
    useEffect(() => {
      if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
    }, [editor, editable]);

    // Кнопка «HTML» пропала (`readOnly`, смена `toolbar`, сенсорный экран
    // стал плавающим режимом) — режим закрывается с применением правки.
    useEffect(() => {
      if (!sourceAvailable && sourceTextRef.current !== null) closeSource(false);
    }, [sourceAvailable]);

    /*
      Фокус при смене режима — после рендера: на входе поля ещё нет, на выходе
      Документ ещё скрыт. Вход — в поле HTML, каретка в начале; выход кнопкой
      — в Документ, каретка в конце, как `ref.focus()`.
    */
    useEffect(() => {
      const target = switchFocusRef.current;
      switchFocusRef.current = null;
      if (target === "source") {
        const field = sourceFieldRef.current;
        field?.focus();
        field?.setSelectionRange(0, 0);
      } else if (target === "document") {
        editorRef.current?.commands.focus("end");
      }
    }, [sourceOpen]);

    useEffect(() => {
      const form = rootRef.current?.closest("form");
      if (!form) return;
      // Захват на самой форме срабатывает раньше `onSubmit` потребителя:
      // React слушает всплытие у корня приложения.
      // Правка HTML-режима применяется первой: форма не теряет её и не
      // получает несанитизированный HTML.
      const flush = () => {
        applySourceRef.current();
        throttle.flush();
      };
      // `formdata` приходит на любой `new FormData(form)` — и на отправке, и
      // при автосохранении по таймеру, — но ПОСЛЕ сбора записей. Поэтому
      // свежее значение кладётся прямо в собранный набор.
      const fill = (event: FormDataEvent) => {
        flush();
        if (name != null && hiddenRef.current && !hiddenRef.current.disabled) {
          event.formData.set(name, hiddenRef.current.value);
        }
      };
      form.addEventListener("submit", flush, { capture: true });
      form.addEventListener("formdata", fill);
      return () => {
        form.removeEventListener("submit", flush, { capture: true });
        form.removeEventListener("formdata", fill);
      };
    }, [throttle, name]);

    const toolBridge: ToolBridge = {
      openSearch,
      // Фокус и каретку не трогаем: команду зовёт код экрана, а не автор в панели.
      closeSearch: () => closeSearch(false),
      sourceOpen: () => sourceTextRef.current !== null,
      jumpToc: (index) => tocJumpRef.current?.(index) ?? false,
    };

    useImperativeHandle(ref, () => {
      const methods = createHandleMethods({
        editor,
        editable,
        known: () => knownRef.current,
        initialDocument: () => initialDocumentRef.current,
        tables: enabledTools.has("table"),
        sourceOpen: () => sourceTextRef.current !== null,
        sourceField: () => sourceFieldRef.current,
        applySource: () => applySourceRef.current(),
        rewriteSource,
        fieldEmpty,
        commands: (name) => {
          const descriptor = enabledTools.descriptors.find((entry) => entry.name === name);
          return editor && !editor.isDestroyed && descriptor?.commands
            ? descriptor.commands({ editor, bridge: toolBridge })
            : null;
        },
      });
      return {
        editor,
        ...methods,
        getHTML: () => {
          applySourceRef.current();
          return editor ? serialize(editor) : knownRef.current;
        },
        getMarkdown: () => {
          applySourceRef.current();
          return editor && !isDocumentEmpty(editor.state.doc) ? markdownOf(editor) : "";
        },
        setMarkdown: (markdown) => {
          if (!editor) return;
          // Та же замена снаружи, что у `clear()`, и предел символов её не режет.
          // Таймер снимается ПОСЛЕ замены: её транзакция сама ставит `update`,
          // и отложенный `onChange` отдал бы уже отданное значение вторично.
          replaceWithMarkdown(editor, markdown);
          throttle.cancel();
          recount(editor);
          emit(serialize(editor));
          rewriteSource(editor);
        },
        getJSON: () => {
          if (!editor) return null;
          applySourceRef.current();
          return documentToJSON(editor);
        },
        setJSON: (document) => {
          // Та же Замена снаружи, что у `setMarkdown`, и в том же порядке.
          if (!editor || !replaceWithJSON(editor, document)) return false;
          throttle.cancel();
          recount(editor);
          emit(serialize(editor));
          rewriteSource(editor);
          return true;
        },
        openSearch: (options) => {
          devWarn(
            'RichTextEditor: handle.openSearch() is deprecated; use handle.tool("search")?.open() instead'
          );
          methods.tool("search")?.open(options);
        },
        clear: () => {
          if (!editor) return;
          throttle.cancel();
          editor.chain().setMeta(EXTERNAL_CHANGE, true).clearContent(false).run();
          recount(editor);
          syncValidity(editor);
          // Очистку зовёт потребитель, но значение держит владелец: без
          // `onChange` управляемый режим вернул бы прежний текст следующим
          // рендером.
          emit("");
          rewriteSource(editor);
        },
      };
    }, [editor, editable, throttle]);
    /*
      Хуки `useRichTextEditorState` и `useRichTextToolState` не видят смену
      движка у `ref` сами — сообщаем. Тем же сообщением идут сигналы кита для
      Состояния Инструмента: набор Инструментов и открытость панели Поиска.
    */
    const searchOpen = searchPanel !== null;
    useEffect(
      () => publishToolSignals(ref, { tools: enabledTools, searchOpen }),
      [ref, editor, enabledTools, searchOpen]
    );
    // Размонтирование (и смена `ref`) забирает сигналы: хук экрана отдаёт `null`.
    useEffect(() => () => clearToolSignals(ref), [ref]);

    /*
      Готовность (спека, словарь): один раз за монтаж, когда движок создан.
      Эффект идёт после `useImperativeHandle` (он — в фазе компоновки), поэтому
      `ref` в `onReady` уже действует. Флаг в ref, а не в эффекте: в строгом
      режиме React гоняет эффекты дважды, а событие одно. Загрузчики уже в
      условии: `editor` выходит наружу только после них, а ошибка набора и
      упавший загрузчик (`editor === null`) готовности не дают.
    */
    const readySentRef = useRef(false);
    useEffect(() => {
      if (!editor || readySentRef.current) return;
      readySentRef.current = true;
      onReadyRef.current?.();
    }, [editor]);

    /*
      Фокус поля — Документ, Панель, поповеры кита и поле HTML разом
      (`onFocus` и `onBlur` — о нём; Фокус Документа, `focus` и `blur` движка,
      клик в Панель снимает). Слушают корень поля через React: фокусные события
      React всплывают по дереву компонентов, в том числе из порталов, куда
      уходят поповеры и окна кита, — DOM-вложенность корня им не нужна.

      `focusout` приходит раньше `focusin` следующей цели, поэтому уход
      подтверждается на такт позже: за это время фокус мог вернуться в поле
      (Документ → Панель → поповер → Документ). Цель в самом корне отсеивается
      сразу. `onBlur` идёт ПОСЛЕ вытолкнутого `onChange`: автосохранение по
      `blur` получает свежий Документ, откуда бы фокус ни ушёл — не только из
      Документа, где `blur` движка выталкивает сам.
    */
    const fieldFocusedRef = useRef(false);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(leaveTimerRef.current), []);

    /** Цель Оглавления — Документ движка; объект новый с каждым движком. */
    const tocTarget = useMemo(
      () => ({
        get current() {
          return editor && !editor.isDestroyed ? (editor.view.dom as HTMLElement) : null;
        },
      }),
      [editor]
    );
    const searchPanelElement = (className: string) =>
      editor &&
      searchPanel && (
        <Suspense fallback={null}>
          <SearchPanel
            editor={editor}
            focus={searchPanel}
            onClose={() => closeSearch(true)}
            className={className}
          />
        </Suspense>
      );

    return (
      <div
        ref={rootRef}
        className={cn("relative", className)}
        onFocus={() => {
          clearTimeout(leaveTimerRef.current);
          if (fieldFocusedRef.current) return;
          fieldFocusedRef.current = true;
          onFocusRef.current?.();
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = setTimeout(() => {
            if (!fieldFocusedRef.current) return;
            fieldFocusedRef.current = false;
            throttle.flush();
            onBlurRef.current?.();
          }, 0);
        }}
      >
        <div
          data-disabled={disabled || undefined}
          className={cn(
            FIELD_SHELL_CLASS,
            "has-[[contenteditable][aria-invalid=true]]:border-danger-strong",
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
          )}
        >
          {editor && toolbarMode === "fixed" && !readOnly && (
            /*
              Липнет под шапкой приложения: отступ — `--topbar-h`, которую
              публикует `TopBar` (ADR-0016, ADR-0019); без шапки переменной нет,
              и Панель липнет к краю окна. Липкость — внутри рамки поля: Панель
              уходит вместе с полем, когда оно прокручено целиком.

              Отрицательные поля — под горизонтальный отступ оболочки: фон
              Панели закрывает текст, уезжающий под неё, от рамки до рамки.
              `z-[1]` — внутри поля, а не ступень стека слоёв: Панель не
              оверлей и должна оставаться ниже любого из них.
            */
            <div ref={setToolbarShell} className={TOOLBAR_SHELL_CLASS}>
              <EditorToolbar
                editor={editor}
                tools={enabledTools}
                disabled={disabled}
                onInsertTable={() => setTableDialogOpen(true)}
                shortcutsReference
                invisibleCharacters={enabledTools.has("invisibleCharacters")}
                search={
                  enabledTools.has("search")
                    ? {
                        open: searchPanel !== null,
                        onToggle: () => (searchPanel ? closeSearch(true) : openSearch(false)),
                      }
                    : undefined
                }
                source={
                  sourceAvailable
                    ? {
                        active: sourceOpen,
                        onToggle: () => (sourceOpen ? closeSource(true) : openSource()),
                      }
                    : undefined
                }
              />
              {searchPanelElement(SEARCH_PANEL_PLACE_CLASS)}
            </div>
          )}
          {editor && !(toolbarMode === "fixed" && !readOnly) && searchPanel && (
            /*
              Без фиксированной Панели панель поиска — в верхнем углу поля:
              липкая обёртка нулевой высоты держит её на виду при прокрутке
              Документа и не сдвигает его.
            */
            <div className="sticky top-[var(--topbar-h,0px)] z-[2] h-0">
              {searchPanelElement(SEARCH_PANEL_CORNER_CLASS)}
            </div>
          )}
          {!editor && toolbarMode === "fixed" && !readOnly && (
            // Скелет Панели — её рамка и невидимая копия раскладки: строк
            // столько же, сколько будет у Панели, и поле не прыгает.
            <div className={TOOLBAR_SHELL_CLASS}>
              <ToolbarSkeleton
                tools={enabledTools}
                source={sourceAvailable}
                search={enabledTools.has("search")}
                invisibleCharacters={enabledTools.has("invisibleCharacters")}
                shortcutsReference
              />
            </div>
          )}
          <div
            /*
              Реф — только у прокручиваемой области: колбэк ставит состояние и
              даёт лишний рендер на монтаже, а у обычного поля он сдвигал
              первый расчёт позиции плавающей Панели (опорой на миг становился
              весь Документ, и Панель вставала под полем).
            */
            ref={scrolls ? setScrollArea : undefined}
            className={cn(scrolls && "relative -mx-3 overflow-y-auto px-3")}
            style={areaStyle}
          >
            {/* В HTML-режиме Документ скрыт, но смонтирован: движок и история живы. */}
            {tocOn ? (
              /*
                Левое поле Оглавления: колонка есть, только пока есть полоса —
                `TocCore` с меньше чем двумя заголовками не рисует ничего, и
                текст стоит у края, как без Инструмента (ADR-0068, п. 2).
              */
              <div className="flex items-start">
                {editor && !sourceOpen && (
                  <Suspense fallback={null}>
                    <TocCore
                      target={tocTarget}
                      offsetVar={tocOptions.offsetVar}
                      levels={tocOptions.levels}
                      listWidth={tocOptions.listWidth}
                      stickyTop={tocStickyTop}
                      focusHeading={tocFocusHeading}
                      alignToFirstHeading
                      onCurrentChange={(tocAt) => publishToolSignals(ref, { tocAt })}
                      editor={editor}
                      jumpRef={tocJumpRef}
                      data-toc-gutter=""
                      className="sticky mr-3 shrink-0"
                      style={{
                        top: scrolls
                          ? "0.5rem"
                          : `calc(var(${tocOffsetVar}, 0px) + ${toolbarHeight}px + 0.5rem)`,
                      }}
                    />
                  </Suspense>
                )}
                <div className="min-w-0 flex-1">
                  <EditorContent editor={editor} hidden={sourceOpen} />
                </div>
              </div>
            ) : (
              <EditorContent editor={editor} hidden={sourceOpen} />
            )}
            {!editor && (
              /*
              Скелет (ADR-0058, п. 11.4): до Готовности и при сбое загрузчика —
              Документ статичным HTML с классом Документа движка, без ввода.
              HTML — `value`, очищенный Схемой (`skeleton.ts`), а не как есть:
              до эпика `value` шёл в страницу только через разбор Схемой, и
              Скелет этого не ломает. На сервере и до гидратации — пусто.
            */
              <div
                {...surfaceAttributes(surface)}
                className={documentClass}
                dangerouslySetInnerHTML={{ __html: skeleton }}
              />
            )}
            {source && (
              /*
              Поле HTML-режима на месте Документа. Отступы — как у области
              Документа, роли `--rte-*` и вложенная тема листа — те же, что у
              него, а поле на листе остаётся тёмным, как везде. Высота — не
              ниже Документа при входе, дальше растёт по содержимому (зеркало),
              растягивается по вертикали рукой.

              Имя — из каталога, описание и невалидность — те же, что у
              Документа: подсказка и ошибка `FormField` не теряются при смене
              режима. Автоисправления выключены — код ими портится. Tab
              нативный: табуляцию поле не вставляет, ловушки клавиатуры нет.
            */
              <div
                {...surfaceAttributes(surface)}
                className={cn(
                  "grid",
                  // На листе светлый лист остаётся под тёмным полем: смена режима
                  // меняет содержимое листа, а не сам лист.
                  surface === "paper"
                    ? cn(EDITOR_PAPER_TOKENS_CLASS, PAPER_SHEET_CLASS, "my-3")
                    : cn(EDITOR_TOKENS_CLASS, "py-2.5")
                )}
                style={{ minHeight: source.minHeight }}
              >
                <textarea
                  ref={sourceFieldRef}
                  value={source.text}
                  aria-label={messages.editor.sourceField}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  aria-required={required || undefined}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  dir="ltr"
                  disabled={disabled}
                  data-disable-focus-ring="true"
                  onChange={(event) => {
                    const text = event.target.value;
                    sourceTextRef.current = text;
                    setSource((previous) => previous && { ...previous, text });
                    if (editor) syncValidity(editor);
                  }}
                  onBlur={applySource}
                  /*
                  `Alt+F10` живёт в keymap движка, а фокус здесь — в
                  `textarea`, мимо ProseMirror. Панель же объявляет сочетание
                  (`aria-keyshortcuts`): из поля HTML оно обязано работать так
                  же, как из Документа.
                */
                  onKeyDown={(event) => {
                    if (
                      event.key === "F10" &&
                      event.altKey &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      focusToolbarRef.current()
                    ) {
                      event.preventDefault();
                    }
                  }}
                  className={cn(SOURCE_BOX_CLASS, SOURCE_FIELD_CLASS)}
                />
                <div aria-hidden className={cn(SOURCE_BOX_CLASS, "invisible border-transparent")}>
                  {source.text + "\n"}
                </div>
              </div>
            )}
            {editor && !readOnly && !sourceOpen && (
              <BlockHandle editor={editor} tools={enabledTools} openRef={openBlockMenuRef} />
            )}
          </div>
          {editor && !sourceOpen && slash.element}
          {editor && !sourceOpen && triggerMenu.element}
          {editor && bubbleShown && !readOnly && !sourceOpen && (
            <SelectionBubble
              editor={editor}
              tools={enabledTools}
              disabled={disabled}
              onCustomColor={openCustomColor}
              keyboardTarget={toolbarMode === "bubble"}
              scrollTarget={scrollTarget}
            />
          )}
          {editor && toolbarMode === "floating" && !readOnly && (
            <FloatingToolbar
              editor={editor}
              tools={enabledTools}
              disabled={disabled}
              onInsertTable={() => setTableDialogOpen(true)}
              scrollTarget={scrollTarget}
            />
          )}
          {editor && TableInsertDialog && enabledTools.has("table") && !readOnly && (
            <TableInsertDialog
              editor={editor}
              open={tableDialogOpen}
              onClose={() => setTableDialogOpen(false)}
            />
          )}
          {editor && toolPopover && (
            <SelectionPopover
              editor={editor}
              request={toolPopover.request}
              open={toolPopover.open}
              onOpenChange={(open) => setToolPopover((prev) => prev && { ...prev, open })}
            />
          )}
          {editor && textCardEntries.length > 0 && (
            <Suspense fallback={null}>
              <TextCard
                editor={editor}
                entries={textCardEntries}
                enabled={!disabled && !sourceOpen}
                readOnly={readOnly}
                rootRef={rootRef}
                controlRef={textCardRef}
              />
            </Suspense>
          )}
          {editor && customColor && (
            <Suspense fallback={null}>
              <CustomColorPopover
                editor={editor}
                kind={customColor.kind}
                open={customColor.open}
                onOpenChange={(open) => setCustomColor((prev) => prev && { ...prev, open })}
              />
            </Suspense>
          )}
          {editor && enabledTools.has("image") && !readOnly && !sourceOpen && (
            <ImageToolbar
              editor={editor}
              disabled={disabled}
              onEdit={() => setImageOpen(true)}
              scrollTarget={scrollTarget}
            />
          )}
          {editor && enabledTools.has("image") && (
            <ImagePopover
              editor={editor}
              open={imageOpen}
              onOpenChange={setImageOpen}
              canUpload={onUploadImage != null}
            />
          )}
          {resizable && (
            <FieldResizer
              area={scrollArea}
              height={areaHeight}
              onHeight={setAreaHeight}
              disabled={disabled}
            />
          )}
          <FieldNoticeView
            notice={
              toolsError || loadFailed
                ? { tone: "error", text: messages.editor.toolsFailed }
                : notice
            }
            action={
              loadFailed && (
                <Button size="sm" variant="outline" onClick={retryLoads}>
                  {messages.editor.retry}
                </Button>
              )
            }
          />
          <StatusLine status={status} counter={counter} counterId={counterId} />
        </div>
        {validatable && (
          /*
            Прокси для проверки ограничений браузера. `<input type="hidden">`
            из неё ИСКЛЮЧЁН по спецификации (barred from constraint
            validation: `willValidate === false`, `setCustomValidity` на нём
            ничего не блокирует), а `contenteditable` — не form-associated
            элемент вовсе. Поэтому `required` держит отдельное поле: оно
            обычное текстовое, без `name`, поэтому в `FormData` не попадает —
            значение по-прежнему несёт скрытое поле ниже.

            Валидность задаёт `setCustomValidity` (`syncValidity`), а не атрибут
            `required`: сообщение берётся из каталога кита, а не из языка
            браузера. Невидимое поле остаётся фокусируемым (`tabIndex=-1`,
            не `display:none`) — иначе браузер не покажет пузырь и напишет в
            консоль «An invalid form control is not focusable». Пузырь встаёт у
            рамки поля.

            Когда браузер отклоняет отправку, он ставит фокус на первое
            невалидное поле — здесь на прокси; оттуда фокус пересылается в
            документ. `invalid` ловит то же ещё до этого: так фокус попадёт в
            редактор и там, где браузер сам фокус не двигает.
          */
          <input
            ref={proxyRef}
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="pointer-events-none absolute right-0 bottom-0 left-0 h-px opacity-0"
            onInvalid={focusField}
            onFocus={focusField}
          />
        )}
        {name != null && (
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            /*
              Значение скрытого поля пишет Редактор (`emit`, эффекты движка), а
              не React. Но React на КАЖДОМ обновлении заново ставит `defaultValue`,
              а у `type="hidden"` это и есть его значение: любой рендер родителя
              откатывал бы поле формы к входящей строке. Поэтому после монтажа в
              `defaultValue` уходит то, что уже лежит в поле, — React видит равенство
              и ничего не трогает. Серверный рендер и первый кадр несут `initial`.
            */
            defaultValue={hiddenRef.current?.value ?? initial}
            // Выключенное поле не уходит в форму — как нативное. Поле только
            // для чтения уходит: это показанное значение, а не недоступный
            // контрол.
            disabled={disabled}
          />
        )}
      </div>
    );
  }
);
