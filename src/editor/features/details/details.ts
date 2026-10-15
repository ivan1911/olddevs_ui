"use client";

import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { type Editor, type Extensions } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { placeContainerBlock } from "../../core/containers.js";
import { detailsTokenizer, parseDetails, renderDetails } from "./detailsMarkdown.js";

/**
 * Сворачиваемый Блок (Details) — Блок-контейнер из двух детей: заголовок
 * (`detailsSummary`, строчное содержимое) и содержимое (`detailsContent`, Блоки).
 * Движок — расширение Details из Tiptap (API по нему, ADR-0048: заказчика при
 * выпуске не было); кит добавляет Схему, санитайзер, Markdown и вставку.
 *
 * HTML — КАК У TIPTAP, ТЕГАМИ КИТА, без классов и `style`:
 *
 * ```html
 * <details>
 *   <summary>Заголовок</summary>
 *   <div data-type="detailsContent"><p>Блоки</p></div>
 * </details>
 * ```
 *
 * `open` пишется только с Опцией `persist` (по умолчанию нет): раскрытый при
 * правке Блок не публикуется раскрытым без спроса. Обёртка содержимого
 * (`div[data-type="detailsContent"]`) нужна движку, чтобы отличить содержимое от
 * заголовка; чужой HTML без неё (GitHub, браузер: `<details><summary>…</summary>
 * <p>…</p></details>`) читается так же, Схема достраивает её сама.
 *
 * ВЛОЖЕННОСТЬ — КАК У ЛЮБОГО БЛОКА. Details входит в группу `block`: он бывает на
 * верхнем уровне, в колонке Раскладки, Обёртке, цитате, ячейке и в содержимом
 * другого Details. Раскладки и Обёртки внутри него нет — их принимают только
 * Документ и колонка. `isolating`, как у Обёртки: Backspace в начале Блока не
 * выводит текст наружу.
 *
 * Вид Блока в Редакторе — представление узла из Tiptap: `div` с кнопкой
 * раскрытия и классом `is-open`; открытость при `persist: false` живёт только в
 * этом DOM, не в Документе и не в истории правок.
 */

/** Имена узлов Схемы движка. */
export const DETAILS_NODE = "details";
export const DETAILS_SUMMARY_NODE = "detailsSummary";
export const DETAILS_CONTENT_NODE = "detailsContent";

/** Имя обёртки содержимого в `data-type`: так её пишет Tiptap. */
export const DETAILS_CONTENT_TYPE = DETAILS_CONTENT_NODE;

export interface DetailsEngineOptions {
  /** Пишется ли открытость Блока в Документ (Опция `persist`). */
  persist: boolean;
  /** Имя кнопки раскрытия по тексту заголовка: из каталога, читается при каждой перерисовке. */
  toggleLabel: (text: string) => string;
}

/** Метка транзакции: позиция только что вставленного Блока, который надо раскрыть. */
const OPEN_ON_INSERT = new PluginKey<number | null>("detailsOpenOnInsert");

/**
 * Раскрыть Блок, вставленный из Меню вставки: открытость при `persist: false` —
 * класс в DOM представления, а не атрибут узла, поэтому раскрывает её щелчок по
 * кнопке, как у автора. Пустой Блок, который не раскрыт, — заголовок без места
 * под содержимое, а набирать его автор пришёл не в заголовок. Делается после
 * обновления DOM и вне транзакции: кнопка Tiptap возвращает фокус в Документ.
 */
const openOnInsert = new Plugin<number | null>({
  key: OPEN_ON_INSERT,
  state: {
    init: () => null,
    apply: (tr) => (tr.getMeta(OPEN_ON_INSERT) as number | undefined) ?? null,
  },
  view: () => ({
    update(view) {
      const pos = OPEN_ON_INSERT.getState(view.state);
      if (pos === null || pos === undefined) return;
      queueMicrotask(() => {
        if (view.isDestroyed) return;
        const dom = view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement) || dom.getAttribute("data-type") !== DETAILS_NODE) return;
        if (dom.classList.contains("is-open")) return;
        dom.querySelector<HTMLButtonElement>(":scope > button")?.click();
      });
    },
  }),
});

/** Текст заголовка Блока — для имени кнопки. */
function summaryText(node: PmNode): string {
  return node.firstChild?.type.name === DETAILS_SUMMARY_NODE ? node.firstChild.textContent : "";
}

/** Виден ли узел на позиции: свёрнутое содержимое спрятано, и у него нет `offsetParent`. */
function isVisibleAt(editor: Editor, pos: number): boolean {
  const { node } = editor.view.domAtPos(pos);
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  return element !== null && element.offsetParent !== null;
}

/**
 * Enter в заголовке раскрытого Блока, где содержимое начинается пустым Блоком:
 * каретка встаёт в него. Не в заголовке, свёрнутый Блок и непустое начало —
 * `false`, дело Tiptap.
 */
function moveIntoEmptyContent(editor: Editor): boolean {
  const { selection } = editor.state;
  const { $head } = selection;
  if (!selection.empty || $head.parent.type.name !== DETAILS_SUMMARY_NODE) return false;
  const content = $head.node(-1).lastChild;
  const first = content?.type.name === DETAILS_CONTENT_NODE ? content.firstChild : null;
  if (!first?.isTextblock || first.content.size > 0) return false;
  const start = $head.after() + 1;
  if (!isVisibleAt(editor, start)) return false;
  const { tr } = editor.state;
  editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(start), 1)).scrollIntoView());
  return true;
}

/**
 * Backspace в заголовке. Safari стирает при нём весь текст `summary` (баг
 * WebKit), поэтому Tiptap удаляет знак сам — но один знак UTF-16, и эмодзи с
 * суррогатной парой терял половину. Здесь удаляется последний графем:
 * `Intl.Segmenter`, а без него — кодовая точка.
 */
function lastGraphemeLength(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const parts = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)
    );
    return parts.at(-1)?.segment.length ?? 1;
  }
  return Array.from(text).at(-1)?.length ?? 1;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    detailsBlock: {
      /**
       * Вставить пустой сворачиваемый Блок под текущим Блоком; пустой абзац
       * заменяется. Каретка — в заголовке. Блок раскрыт: с `persist` — атрибутом,
       * без него — сразу после вставки. Из заголовка, списка и ячейки он встаёт под
       * их Блоком, из Обёртки, колонки и цитаты — внутри них.
       */
      insertDetails: () => ReturnType;
    };
  }
}

/**
 * Узел Details кита: Tiptap плюс вставка, Backspace без потери знака,
 * раскрытие вставленного и Markdown сырым HTML.
 */
function createDetails({ persist, toggleLabel }: DetailsEngineOptions) {
  return Details.extend({
    // Свой Markdown (`detailsMarkdown.ts`): вместо `:::details` — сырой HTML.
    markdownTokenizer: detailsTokenizer,
    parseMarkdown(token, helpers) {
      return parseDetails(token, helpers, this.options.persist);
    },
    renderMarkdown(node, helpers) {
      return renderDetails(node, helpers, this.options.persist);
    },
    addCommands() {
      return {
        ...this.parent?.(),
        insertDetails:
          () =>
          ({ tr, dispatch }) => {
            if (dispatch) placeDetails(tr, this.options.persist);
            return true;
          },
      };
    },
    addKeyboardShortcuts() {
      const upstream = this.parent?.() ?? {};
      return {
        ...upstream,
        /*
          Enter в заголовке раскрытого Блока Tiptap ставит НОВЫЙ пустой абзац в
          начало содержимого. У только что вставленного Блока содержимое — уже
          один пустой абзац, и новый оставил бы пустую строку в конце после
          набранного: каретка идёт в тот абзац, что есть.
        */
        Enter: (props) => moveIntoEmptyContent(props.editor) || (upstream.Enter?.(props) ?? false),
        Backspace: () => {
          const { selection } = this.editor.state;
          const { empty, $anchor } = selection;
          if (!empty || $anchor.parent.type.name !== DETAILS_SUMMARY_NODE) return false;
          // Начало заголовка — Блок распадается (`unsetDetails`).
          if ($anchor.parentOffset === 0) return this.editor.commands.unsetDetails();
          const before = $anchor.parent.textBetween(0, $anchor.parentOffset);
          const size = lastGraphemeLength(before);
          return this.editor.commands.command(({ tr }) => {
            tr.delete($anchor.pos - size, $anchor.pos);
            return true;
          });
        },
      };
    },
    addNodeView() {
      const parentView = this.parent?.();
      if (!parentView) return null;
      return (props) => {
        const view = parentView(props);
        const toggle = view.dom.querySelector<HTMLButtonElement>(":scope > button");
        /*
          Кнопка раскрытия лежит внутри Документа, и без этого её события
          забирал бы ProseMirror: `Enter` на кнопке резал бы строку, а щелчок
          двигал каретку. Кнопку обслуживает только она сама.
        */
        const stopEvent = (event: Event) =>
          event.target instanceof Node && !!toggle && toggle.contains(event.target);
        /*
          Кнопка стоит внутри редактируемого Документа и без этого сама
          редактируема. Chrome при любой клавише переводит фокус с такой кнопки
          на редактируемый корень ещё до `keydown`: Enter и Space не доходили до
          неё, и Блок не раскрывался с клавиатуры. Нередактируемая кнопка
          сохраняет фокус и получает клавишу.
        */
        toggle?.setAttribute("contenteditable", "false");
        /*
          Щелчок Tiptap возвращает фокус в Документ — мышь это не задевает, а
          клавиатуру выбросило бы с кнопки. Клавиатурный щелчок узнаём по Enter
          или Space на самой кнопке: `detail` равен нулю и у `click()` из кода
          (раскрытие вставленного Блока), а там фокус должен остаться в
          Документе. Фокус Tiptap ставит кадром позже (`requestAnimationFrame`),
          поэтому и возвращаем его кадром: колбэк стоит в очереди после Tiptap.
          `aria-expanded` озвучивается там, где человек.
        */
        let byKey = false;
        toggle?.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") byKey = true;
        });
        toggle?.addEventListener("blur", () => {
          byKey = false;
        });
        toggle?.addEventListener("click", () => {
          if (!byKey) return;
          byKey = false;
          requestAnimationFrame(() => {
            if (toggle.isConnected) toggle.focus({ preventScroll: true });
          });
        });
        return { ...view, stopEvent };
      };
    },
    addProseMirrorPlugins() {
      return [...(this.parent?.() ?? []), ...(this.options.persist ? [] : [openOnInsert])];
    },
  }).configure({
    persist,
    renderToggleButton: ({ element, isOpen, node }) => {
      // Имя кнопки — заголовок Блока; раскрыт он или нет, говорит `aria-expanded`.
      element.setAttribute("aria-label", toggleLabel(summaryText(node)));
      element.setAttribute("aria-expanded", String(isOpen));
    },
  });
}

/**
 * Заголовок: `details > summary`. Tiptap разбирает любой `summary`, а `summary`
 * вне Блока — это текст, который не должен превратиться в Блок целиком.
 */
const KitSummary = DetailsSummary.extend({
  parseHTML: () => [{ tag: "details > summary" }],
  // Markdown Блока пишет и читает сам Блок (`detailsMarkdown.ts`): `:::detailsSummary`
  // Tiptap кит не принимает.
  markdownTokenizer: {
    name: DETAILS_SUMMARY_NODE,
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
});

const KitContent = DetailsContent.extend({
  /*
    Содержимое — контейнер Блоков (`isBlockContainer`, `blockCommands.ts`): его
    дети — Блоки со своей ручкой, и «Вверх», «Вниз», «Добавить ниже» и `⌥⇧↑/↓`
    остаются внутри него. Флаг в Схеме ставит кит из Признака описания
    (`blocks`, `extensions.ts`).
  */
  markdownTokenizer: {
    name: DETAILS_CONTENT_NODE,
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
});

/** Всё, что нужно Блоку: узел, заголовок и содержимое. */
export function detailsExtensions(options: DetailsEngineOptions): Extensions {
  return [createDetails(options), KitSummary, KitContent];
}

/**
 * Пустой Блок с одним абзацем в содержимом — под текущим Блоком, в ближайшем
 * вверх узле, который его принимает (правила места общие с Раскладкой и
 * Обёрткой, `placeContainerBlock`). Каретка — в заголовке.
 */
function placeDetails(tr: Transaction, persist: boolean): void {
  const { schema } = tr.doc.type;
  const details = schema.nodes[DETAILS_NODE]!.create(persist ? { open: true } : null, [
    schema.nodes[DETAILS_SUMMARY_NODE]!.create(),
    schema.nodes[DETAILS_CONTENT_NODE]!.create(null, schema.nodes.paragraph!.create()),
  ]);
  placeContainerBlock(tr, details);
  if (persist) return;
  // Позиция Блока — над кареткой, в заголовке: два уровня вверх.
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === DETAILS_NODE) {
      tr.setMeta(OPEN_ON_INSERT, $from.before(depth));
      break;
    }
  }
}

/** Сворачиваемый Блок под позицией `pos`: сам Блок или Блок прямо в его содержимом. */
function detailsAt(tr: Transaction, pos: number): { from: number; node: PmNode } | null {
  const node = tr.doc.nodeAt(pos);
  if (node?.type.name === DETAILS_NODE) return { from: pos, node };
  const $pos = tr.doc.resolve(pos);
  if ($pos.parent.type.name !== DETAILS_CONTENT_NODE) return null;
  const from = $pos.before($pos.depth - 1);
  const details = tr.doc.nodeAt(from);
  return details?.type.name === DETAILS_NODE ? { from, node: details } : null;
}

/**
 * Снять Блок в `pos` (самого Блока или Блока в его содержимом): заголовок
 * становится абзацем, Блоки содержимого идут за ним. Одна правка — отмена одна.
 * Каретка остаётся в своём тексте (в заголовке — в абзаце из него); выделенный
 * узлом Блок исчезает, и каретка встаёт в начало абзаца. `false` — Блока в `pos` нет.
 */
export function unwrapDetailsAt(tr: Transaction, pos: number): boolean {
  const found = detailsAt(tr, pos);
  if (!found) return false;
  const { from, node } = found;
  const to = from + node.nodeSize;
  const { schema } = tr.doc.type;
  const summary = node.firstChild;
  const content = node.lastChild;
  const lead = schema.nodes.paragraph!.create(null, summary?.content ?? Fragment.empty);
  const blocks = content?.type.name === DETAILS_CONTENT_NODE ? content.content : Fragment.empty;
  const before = tr.selection;
  const wasNode = before instanceof NodeSelection && before.from === from;
  // Позиции внутри Блока после замены: заголовок на шаг левее (нет тега `details`),
  // Блоки содержимого — за абзацем вместо `details`, `summary` и обёртки.
  const summaryEnd = from + 1 + (summary?.nodeSize ?? 0);
  const delta = from + lead.nodeSize - (summaryEnd + 1);
  const shift = (at: number) => (at < summaryEnd ? at - 1 : at + delta);
  const inside = before.from > from && before.to < to;
  tr.replaceWith(from, to, Fragment.from(lead).append(blocks));
  if (wasNode || !inside) {
    tr.setSelection(TextSelection.create(tr.doc, from + 1));
  } else if (before instanceof NodeSelection) {
    tr.setSelection(NodeSelection.create(tr.doc, shift(before.from)));
  } else {
    tr.setSelection(TextSelection.create(tr.doc, shift(before.anchor), shift(before.head)));
  }
  tr.scrollIntoView();
  return true;
}
