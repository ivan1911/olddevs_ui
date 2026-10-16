"use client";

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { Marked, type marked } from "marked";
import { Fragment, Slice, type ResolvedPos, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorProps } from "@tiptap/pm/view";
import { inContainerFreeNode } from "./containers.js";
import { COLUMN_NODE, LAYOUT_NODE } from "../features/layout/layout.js";
import { replaceDocument } from "./maxLength.js";
import { WRAPPER_NODE } from "../features/wrapper/wrapper.js";
import { WRAPPER_TONE_ALERTS } from "../features/wrapper/wrapperTones.js";
import { VIDEO_BLOCK } from "../features/video/videoLink.js";
import { conformToSchema, headingLevels } from "./schemaConform.js";

/**
 * Markdown в документ — через Схему, а не мимо неё: `@tiptap/markdown`
 * разбирает текст в JSON по набору расширений движка и неизвестные ему токены
 * (таблица, ссылка без расширения ссылки) уже теряет, а остальное дерево
 * приводит к Схеме `conformToSchema` (`schemaConform.ts`).
 */

/**
 * Узлы, которых в Markdown нет и которые из него не создаются, даже если они
 * есть в Схеме: Раскладка и колонка, Обёртка.
 * `<div data-block="layout">` сырым HTML внутри Markdown разбирается правилами
 * Схемы, а колонок в Markdown нет по решению владельца — их Блоки встают
 * подряд. Обёртке без тона в Markdown нечем быть — её Блоки тоже встают подряд;
 * Обёртку с тоном даёт только GitHub alert (`alertOf` ниже), а не сырой HTML.
 */
const NOT_FROM_MARKDOWN: ReadonlySet<string> = new Set([LAYOUT_NODE, COLUMN_NODE, WRAPPER_NODE]);

/**
 * GitHub alert: цитата, первая строка которой — метка тона
 * `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` или `[!CAUTION]`, одна на
 * строке; регистр любой, как у GitHub. Метка с текстом на той же строке
 * (`> [!NOTE] текст`) и чужая метка (`[!INFO]`) — обычная цитата: GitHub их
 * alert'ом тоже не показывает.
 */
const ALERT_LABEL = /^\[!(\w+)\][ \t]*(?:\n|$)/;
const TONE_OF_ALERT: ReadonlyMap<string, string> = new Map(
  Object.entries(WRAPPER_TONE_ALERTS).map(([tone, label]) => [label, tone])
);

/** Переносы строки в начале ряда строчных узлов. */
function dropLeadingBreaks(inline: JSONContent[]): JSONContent[] {
  let start = 0;
  while (inline[start]?.type === "hardBreak") start += 1;
  return inline.slice(start);
}

/**
 * Тон и Блоки alert'а без метки или `null`, если узел — не alert. Метка — в
 * начале первого текста первого абзаца: парсер кладёт строки абзаца цитаты в
 * один текст через `\n`. Абзац, в котором ничего, кроме метки, не было, уходит.
 */
function alertOf(node: JSONContent): { tone: string; content: JSONContent[] } | null {
  if (node.type !== "blockquote") return null;
  const [first, ...rest] = node.content ?? [];
  const [text, ...inline] = first?.type === "paragraph" ? (first.content ?? []) : [];
  const match = text?.type === "text" ? ALERT_LABEL.exec(text.text ?? "") : null;
  const tone = match ? TONE_OF_ALERT.get(match[1]!.toUpperCase()) : undefined;
  if (!match || !tone) return null;
  const remainder = text!.text!.slice(match[0].length);
  // Жёсткий перенос в конце строки метки (два пробела или `\`) принадлежит
  // ей, а не первому абзацу: иначе абзац начался бы с пустой строки.
  const restInline = remainder ? inline : dropLeadingBreaks(inline);
  const lead = [...(remainder ? [{ ...text, text: remainder }] : []), ...restInline];
  return { tone, content: lead.length > 0 ? [{ ...first, content: lead }, ...rest] : rest };
}

/**
 * Блок видео вне верхнего уровня Документа (в списке, цитате) — абзац с его
 * ссылкой. Markdown плеера не знает: строка-ссылка становится блоком только сама
 * по себе, а ссылка в пункте списка остаётся ссылкой. Блок в первом месте пункта
 * списка к тому же не годится по Схеме (там абзац).
 */
function demoteNestedVideo(node: JSONContent, schema: Schema): JSONContent {
  if (node.type === VIDEO_BLOCK) {
    const href = String(node.attrs?.link ?? "");
    const marks = schema.marks.link ? [{ type: "link", attrs: { href } }] : undefined;
    return { type: "paragraph", content: [{ type: "text", text: href, marks }] };
  }
  return node.content
    ? { ...node, content: node.content.map((child) => demoteNestedVideo(child, schema)) }
    : node;
}

/**
 * Markdown как фрагмент Схемы редактора. Остаток несовпадений с Схемой
 * (вложенность блоков, которой она не допускает) подгоняет сама вставка:
 * фрагмент кладётся в документ через `replace` и клипборд ProseMirror, а они
 * достраивают недостающие обёртки.
 *
 * GitHub alert верхнего уровня становится Обёрткой с тоном — если Обёртка
 * есть в Схеме и `wrapper` разрешает её на месте вставки. Иначе — как Обёртка
 * из HTML в том же месте: Блоки подряд, без метки. Alert внутри списка или
 * цитаты остаётся цитатой, как и у GitHub.
 */
function markdownToFragment(editor: Editor, markdown: string, wrapper = true): Fragment {
  const { schema } = editor;
  const options = { levels: headingLevels(editor), excluded: NOT_FROM_MARKDOWN };
  const toned = wrapper && WRAPPER_NODE in schema.nodes;
  const parsed = (editor.markdown?.parse(markdown).content ?? []).map((child) =>
    child.type === VIDEO_BLOCK ? child : demoteNestedVideo(child, schema)
  );
  const blocks = parsed.flatMap((child) => {
    const alert = alertOf(child);
    if (!alert) return conformToSchema(child, schema, options);
    const content = alert.content.flatMap((block) => conformToSchema(block, schema, options));
    if (!toned) return content;
    return [
      {
        type: WRAPPER_NODE,
        attrs: { tone: alert.tone },
        // Пустой alert — пустая Обёртка: в ней всегда есть хоть один Блок.
        content: content.length > 0 ? content : [{ type: "paragraph" }],
      },
    ];
  });
  return Fragment.fromArray(blocks.map((block) => schema.nodeFromJSON(block)));
}

/**
 * Документ целиком — из Markdown. Замена снаружи (`EXTERNAL_CHANGE`): предел
 * символов её не режет, как и новый `value`. Без расширения Markdown — ничего.
 */
export function replaceWithMarkdown(editor: Editor, markdown: string): void {
  replaceDocument(editor, markdownToFragment(editor, markdown));
}

/*
  Признаки Markdown в обычном тексте из буфера. Строка текста без единого
  признака остаётся обычным текстом: вставка «2 * 3 * 4» или «foo_bar_baz» не
  должна ни с того ни с сего менять разметку, поэтому курсив ищется только на
  границах слов. Строчный признак при этом всегда должен быть парным.
*/
const BLOCK_SIGNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}[ \t]+\S/m, // заголовок
  /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\S/m, // пункт списка, в том числе чек-листа
  /^ {0,3}>[ \t]?\S/m, // цитата
  /^ {0,3}(?:`{3,}|~{3,})/m, // блок кода
  /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*\|[ \t:|-]*$/m, // строка-разделитель таблицы
  // Определение ссылки-сноски `[1]: https://…`. Только с адресом, который
  // пропустит политика ссылок: «[Note]: позвонить» — обычный текст.
  /^ {0,3}\[[^\]\n]+\]:[ \t]*<?(?:https?|mailto):[^\s>]+>?(?:[ \t]+["'(].*)?$/im,
];
const INLINE_SIGNS: readonly RegExp[] = [
  /(\*\*|__)(?=\S)[^\n]*?\S\1/, // жирный
  /~~(?=\S)[^\n]*?\S~~/, // зачёркнутый
  /(?<!`)`[^`\n]+`(?!`)/, // строчный код
  // Ссылка и картинка, у картинки `alt` бывает пустым; после адреса может
  // идти заголовок в кавычках или скобках.
  /!?\[[^\]\n]*\]\([^)\s]+(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*\)/,
  // Автоссылка в угловых скобках — только со схемой: `<b>` и «a <b> c» не она.
  /<(?:https?|mailto):[^\s<>]+>/i,
  /(?<![\w*])\*(?=[^\s*])[^*\n]*[^\s*]\*(?![\w*])/, // курсив звёздочками
  /(?<![\w_])_(?=[^\s_])[^_\n]*[^\s_]_(?![\w_])/, // курсив подчёркиваниями
];

/** Похож ли обычный текст из буфера на Markdown. */
export function looksLikeMarkdown(text: string): boolean {
  return [...BLOCK_SIGNS, ...INLINE_SIGNS].some((sign) => sign.test(text));
}

/*
  Подсвеченный исходник в `text/html`. Редактор кода (VS Code, JetBrains,
  Sublime Text) кладёт рядом с `text/plain` тот же текст, раскрашенный
  подсветкой: один моноширинный блок — `div` или `pre`, — внутри строки и
  `span` с `color`. Это не оформление автора, а цвета его темы: HTML-путь
  перенёс бы их в Документ «своим цветом», а разметку Markdown оставил бы
  сырым текстом. Признаков три, и нужны все: единственный корень — блок, сам
  моноширинный или обёртка такого блока; внутри нет ничего, кроме строк и
  раскраски; текст совпадает с `text/plain` с точностью до пробелов (строки
  VS Code — `div` без переводов строки). Браузер, Word и Google Docs кладут
  абзацы, списки, ссылки или `<b id="docs-internal-guid-…">` у корня — первый
  же признак их отсекает.
*/
/** Узлы, которые разбор пропускает: служебное `<head>` иногда оказывается в `<body>`. */
const SOURCE_SKIPPED = new Set(["META", "STYLE", "LINK", "TITLE", "SCRIPT"]);
/** Блоки, которыми редакторы кода оборачивают исходник и его строки. */
const SOURCE_BLOCKS = new Set(["DIV", "PRE", "CODE"]);
/** Всё, что бывает внутри подсвеченного исходника: строки и раскраска. */
const SOURCE_TAGS = new Set([
  ...SOURCE_BLOCKS,
  "SPAN",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "FONT",
]);
/**
 * Моноширинный шрифт по имени. VS Code пишет `font-family` из настроек как
 * есть, и родового `monospace` в конце может не быть: `'Fira Code'`.
 */
const MONOSPACE_FONT =
  /monospace|\bmono\b|menlo|monaco|consolas|courier|\bcode\b|inconsolata|iosevka|\bhack\b/i;

function isMonospaceBlock(element: Element): boolean {
  if (element.tagName === "PRE" || element.tagName === "CODE") return true;
  const style = element.getAttribute("style") ?? "";
  const font = /font-family\s*:([^;]*)/i.exec(style)?.[1] ?? "";
  return MONOSPACE_FONT.test(font) || /white-space\s*:\s*pre/i.test(style);
}

/** Моноширинный — сам корень или блок под обёртками без соседей: `div > pre`. */
function hasMonospaceBlock(root: Element): boolean {
  let block: Element | null = root;
  while (block && SOURCE_BLOCKS.has(block.tagName)) {
    if (isMonospaceBlock(block)) return true;
    block = block.childElementCount === 1 ? block.firstElementChild : null;
  }
  return false;
}

/** Похож ли `text/html` буфера на подсвеченный исходник `text/plain`. */
function isHighlightedSource(html: string, text: string): boolean {
  // `DOMParser` — инертный документ: картинки не грузятся, скрипты не идут.
  const { body } = new DOMParser().parseFromString(html, "text/html");
  const roots = Array.from(body.childNodes).filter((node) =>
    node.nodeType === Node.ELEMENT_NODE
      ? !SOURCE_SKIPPED.has(node.nodeName)
      : node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()
  );
  const root =
    roots.length === 1 && roots[0]!.nodeType === Node.ELEMENT_NODE ? (roots[0] as Element) : null;
  if (!root || !Array.from(root.querySelectorAll("*")).every((el) => SOURCE_TAGS.has(el.tagName)))
    return false;
  const squeeze = (value: string) => value.replace(/\s+/g, "");
  return hasMonospaceBlock(root) && squeeze(root.textContent ?? "") === squeeze(text);
}

/**
 * Вставка Markdown. Срабатывает на обычном тексте буфера и на подсвеченном
 * исходнике из редактора кода (`isHighlightedSource`) — тогда разбирается его
 * `text/plain`. Прочий `text/html` (браузер, Word, Google Docs) идёт прежним
 * разбором HTML Схемой — этого пути не касаемся. «Вставить как простой текст»
 * (Shift) и вставка внутрь кода тоже остаются текстом: так человек получает
 * исходные символы, когда Markdown ему как раз не нужен.
 *
 * ПОЧЕМУ `clipboardTextParser`, А НЕ `handlePaste`. Это штатное место, где
 * ProseMirror превращает текст буфера в Slice, а дальше вставка идёт обычным
 * путём: с меткой `paste`, которую читает предел символов, и с подгонкой
 * структуры под Схему.
 *
 * ПОДСВЕЧЕННЫЙ ИСХОДНИК — В `transformPasted`. Выбор между текстом и HTML
 * ProseMirror делает сам и до `clipboardTextParser` с HTML в буфере не доходит.
 * `transformPasted` — последний шаг того же разбора, и он знает, каким путём
 * шёл разбор: `plain` там — «текстом» (Shift, вставка в код или HTML нет).
 * Значит, подменить Slice можно только на HTML-пути, а вставка дальше идёт тем
 * же обычным путём. Самих данных буфера в нём нет — их запоминает событие
 * `paste`, которое приходит к плагину раньше разбора.
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const { editor } = this;
    // Буфер текущей вставки: от события `paste` до конца её разбора.
    let clipboard: { text: string; html: string } | null = null;
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          // Типы ProseMirror обещают Slice, но `null` он понимает как «не моё» и
          // отдаёт текст штатному разбору — на этом держится весь обычный текст.
          clipboardTextParser: ((text: string, $context: ResolvedPos, plain: boolean) => {
            if (plain || $context.parent.type.spec.code || !looksLikeMarkdown(text)) return null;
            const fragment = markdownToFragment(editor, text, !inContainerFreeNode($context));
            if (fragment.childCount === 0) return null;
            // Одна строка текста — не блок, а продолжение абзаца: вставка
            // `**жирный**` в середину фразы не должна рвать её на три абзаца.
            const open = fragment.childCount === 1 && fragment.firstChild?.isTextblock ? 1 : 0;
            return new Slice(fragment, open, open);
          }) as EditorProps["clipboardTextParser"],
          handleDOMEvents: {
            paste: (_view, event) => {
              const data = event.clipboardData;
              clipboard = data
                ? { text: data.getData("text/plain"), html: data.getData("text/html") }
                : null;
              // Буфер живёт ровно одну вставку: разбор идёт синхронно в этом же
              // событии. Если вставку забрал другой обработчик и до
              // `transformPasted` дело не дошло, следующая операция (перенос
              // мышью тоже идёт через `transformPasted`) не должна подменить
              // свой фрагмент старым буфером.
              queueMicrotask(() => {
                clipboard = null;
              });
              return false;
            },
          },
          transformPasted: (slice, view, plain) => {
            const pasted = clipboard;
            clipboard = null;
            if (plain || !pasted?.html || !looksLikeMarkdown(pasted.text)) return slice;
            if (!isHighlightedSource(pasted.html, pasted.text)) return slice;
            const fragment = markdownToFragment(
              editor,
              pasted.text,
              !inContainerFreeNode(view.state.selection.$from)
            );
            // Открыт настолько, насколько можно, — как ProseMirror открывает
            // Slice из `clipboardTextParser`: фраза продолжает абзац.
            return fragment.childCount > 0 ? Slice.maxOpen(fragment) : slice;
          },
        },
      }),
    ];
  },
});

/**
 * Расширение Markdown со СВОИМ экземпляром `marked`.
 *
 * ПОЧЕМУ НЕ ОБЩИЙ. По умолчанию `@tiptap/markdown` регистрирует правила
 * разбора в глобальном `marked`: Редактор с чек-листом оставлял свой
 * токенайзер всем, кто создан после него на той же странице, и Редакторы с
 * разными `tools` переставали быть независимыми. Опция `marked` — штатный
 * способ дать расширению свой экземпляр; `new Marked()` создаётся на каждое
 * расширение, а то создаётся на каждый набор инструментов Редактора.
 *
 * Приведение типа — потому что Tiptap объявляет опцию как `typeof marked`
 * (функция с методами), а `Marked` — класс с теми же `use`, `lexer`, `Lexer` и
 * `defaults`, которыми менеджер Markdown и пользуется (тест самого Tiptap
 * инжектирует `new Marked()` так же).
 */
export function createMarkdown() {
  return Markdown.configure({ marked: new Marked() as unknown as typeof marked });
}
