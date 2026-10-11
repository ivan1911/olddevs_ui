"use client";

// Происхождение: minimal-tiptap, `extensions/image/image.ts` и
// `extensions/file-handler/index.ts` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Взяты обработка вставки и
// перетаскивания файлов и путь «файл → загрузка → адрес»; узел переписан под
// `<figure>` с подписью, `blob:` и base64 в документ не попадают. Лицензия —
// NOTICE в корне пакета.

import { Node, type Editor } from "@tiptap/core";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { Decoration, DecorationSet, type EditorView, type NodeView } from "@tiptap/pm/view";
import type { FieldNotice } from "../../core/fieldNotice.js";
import { isAllowedImageSrc, RICH_TEXT_SCHEMA } from "../../core/schema.js";

/** Ширина картинки: пресет из Схемы или `null` — свой размер, не шире Документа. */
export type ImageWidth = (typeof RICH_TEXT_SCHEMA.imageWidths)[number];

export const IMAGE_WIDTHS: readonly ImageWidth[] = RICH_TEXT_SCHEMA.imageWidths;

/** Атрибуты картинки в Документе. */
export interface ImageAttributes {
  src: string;
  alt: string;
  width: ImageWidth | null;
}

/** Ширина из атрибута HTML: только пресет Схемы, остальное — «не задана». */
function widthOf(value: unknown): ImageWidth | null {
  return IMAGE_WIDTHS.find((width) => width === value) ?? null;
}

/**
 * Атрибуты из `<img>` входящего HTML или `false`, если такой картинке в
 * Документе не быть: адрес вне политики (`data:`, `blob:`, `javascript:`,
 * относительный) отбрасывает картинку целиком — пустой рамки без адреса нет.
 */
function attributesFromImg(img: Element | null): ImageAttributes | false {
  const src = img?.getAttribute("src")?.trim() ?? "";
  if (!img || !isAllowedImageSrc(src)) return false;
  return {
    src,
    alt: img.getAttribute("alt") ?? "",
    width: widthOf(img.getAttribute("data-width")),
  };
}

/** `<img>` на выходе: `alt` всегда (пустой — «описания нет»), `data-width` — если задана. */
function imgAttributes(node: ProseMirrorNode): Record<string, string> {
  const { src, alt, width } = node.attrs as ImageAttributes;
  // `src` сверяется и на выходе: картинку с чужим адресом мог поставить только
  // сырой `ref.editor`, и в HTML она уходит без адреса, как ссылка в `link.ts`.
  const attributes: Record<string, string> = isAllowedImageSrc(src) ? { src } : {};
  attributes.alt = alt ?? "";
  if (widthOf(width)) attributes["data-width"] = width!;
  return attributes;
}

/** Есть ли у картинки подпись — непустое содержимое `figcaption`. */
function hasCaption(node: ProseMirrorNode): boolean {
  return (node.firstChild?.childCount ?? 0) > 0;
}

/** Картинка под выделением: выделенный узел или та, в подписи которой каретка. */
export function selectedImage(state: EditorState): { pos: number; node: ProseMirrorNode } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === IMAGE_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === IMAGE_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Выделена ли картинка целиком — тогда над ней панель картинки, а не
 * форматирования.
 *
 * Живёт в узле, а не в `ImageToolbar.tsx`: условие нужно и общему UI (плавающей
 * Панели и меню выделения), и общий UI не должен импортировать панель картинки,
 * которая сама берёт из него `focusWithin` (ADR-0060, пункт 14).
 */
export function isImageSelection(selection: unknown): boolean {
  return selection instanceof NodeSelection && selection.node.type.name === IMAGE_NODE;
}

/** Тип-заглушка отброшенной Markdown-картинки: такого узла в Схеме нет. */
const DROPPED_IMAGE = "droppedImage";

/** Имя узла картинки в Схеме движка. */
export const IMAGE_NODE = "image";
const CAPTION_NODE = "imageCaption";

/**
 * Подпись картинки — `figcaption` с текстом и Метками.
 *
 * Своего правила разбора у неё нет намеренно: подпись бывает только внутри
 * картинки и разбирается её правилом (`contentElement`). `<figcaption>` вне
 * `<figure>` во вставке становится обычным текстом, а не картинкой без адреса.
 */
const ImageCaption = Node.create({
  name: CAPTION_NODE,
  content: "inline*",
  // Подпись — не самостоятельный Блок: «Превратить в заголовок» и списки её
  // не трогают, потому что `figure` ничего, кроме подписи, не держит.
  defining: true,
  parseHTML: () => [],
  renderHTML: () => ["figcaption", 0],
  // В Markdown подписи нет: `![alt](src)` её не выражает.
  renderMarkdown: () => "",
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richImage: {
      /** Открыть поповер картинки: кнопка Панели и пункт Меню вставки. */
      openImageEditor: () => ReturnType;
      /**
       * Вставить картинку на место выделения: пустой абзац заменяется, иначе
       * Блок встаёт рядом. Каретка уходит в подпись. Адрес вне политики — `false`.
       */
      insertImage: (attributes: Partial<ImageAttributes> & { src: string }) => ReturnType;
      /** Изменить картинку под выделением; адрес вне политики — `false`. */
      updateImage: (attributes: Partial<ImageAttributes>) => ReturnType;
      /** Убрать картинку под выделением. */
      removeImage: () => ReturnType;
      /**
       * Загрузить файлы через `onUploadImage` и вставить картинки на место
       * `pos` (по умолчанию — каретки). Без загрузчика — `false` и подсказка.
       */
      uploadImages: (files: readonly File[], pos?: number) => ReturnType;
    };
  }
}

export interface RichImageOptions {
  /** Открыть поповер картинки — его держит `RichTextEditor`. */
  onOpenEditor: () => void;
  /** Подсказка пустой подписи; читается на каждой перерисовке, смена локали подхватывается. */
  captionPlaceholder: () => string;
  /** Подпись плейсхолдера загрузки файла `name`. */
  uploadingLabel: (name: string) => string;
  /** Загрузчик потребителя; `undefined` — файлы не принимаются. Читается в момент вставки. */
  upload: () => ((file: File) => Promise<string>) | undefined;
  /**
   * Текст и тон Сообщения поля для события файлов: каталог сообщений у
   * `RichTextEditor`. Само сообщение уходит командой движка `showNotice`
   * (`fieldNotice.ts`) — тем же каналом, что у своих Инструментов.
   */
  describeNotice: (notice: ImageNotice) => FieldNotice;
}

/** Событие файлов: идёт загрузка, готово, отказ, файлы не принимаются. */
export type ImageNotice =
  | { kind: "uploading"; name: string }
  | { kind: "uploaded"; name: string }
  | { kind: "failed"; name: string }
  | { kind: "notImage"; name: string }
  | { kind: "unsupported" };

/** Сообщить о файлах каналом Сообщения поля; в снятом с экрана Редакторе — молча. */
function notify(editor: Editor, options: RichImageOptions, notice: ImageNotice): void {
  if (!editor.isDestroyed) editor.commands.showNotice(options.describeNotice(notice));
}

/**
 * Куда встаёт новая картинка: пустой абзац под кареткой заменяется ею, иначе
 * она встаёт рядом с текущим Блоком — `replaceRangeWith` сам найдёт место,
 * разрезав абзац, если каретка в середине.
 */
function placeImage(tr: Transaction, pos: number, image: ProseMirrorNode): number {
  const $pos = tr.doc.resolve(pos);
  const parent = $pos.parent;
  // Заменять пустой абзац можно, только если его место примет картинку: первый
  // абзац пункта списка обязан остаться абзацем.
  const index = $pos.depth > 0 ? $pos.index(-1) : 0;
  if (
    parent.isTextblock &&
    parent.content.size === 0 &&
    $pos.depth > 0 &&
    $pos.node(-1).canReplaceWith(index, index + 1, image.type)
  ) {
    const before = $pos.before();
    tr.replaceWith(before, $pos.after(), image);
    return before;
  }
  tr.replaceRangeWith(pos, pos, image);
  // Узел в документе — тот же объект, что вставлен: его позиция ищется по
  // тождеству, а не пересчётом места, которое выбрал `replaceRangeWith`.
  let found = -1;
  tr.doc.descendants((node, at) => {
    if (node === image) found = at;
    return found < 0 && !node.isTextblock;
  });
  return found;
}

/** Каретка — в конец подписи картинки на позиции `pos`. */
function selectCaption(tr: Transaction, pos: number): void {
  const image = tr.doc.nodeAt(pos);
  if (!image) return;
  // pos + 1 — начало подписи, + 1 — внутри неё; конец — плюс её содержимое.
  const end = pos + 2 + (image.firstChild?.content.size ?? 0);
  tr.setSelection(TextSelection.create(tr.doc, end));
}

/**
 * Картинка Документа — `<figure>` с `<img>` и необязательной `<figcaption>`.
 *
 * ПОЧЕМУ `figure` С ПОДПИСЬЮ-УЗЛОМ, А НЕ `Image` TIPTAP. Расширение Tiptap —
 * голый `<img>`: подписи у него нет, а подпись — часть «Набора v1». Подпись
 * здесь — свой узел-текст внутри картинки: в ней работают Метки и ссылки, а
 * «Превратить в заголовок» или список её не тронут — Схема `figure` не
 * пустит внутрь ничего, кроме подписи.
 *
 * `atom: true` — картинка выделяется целиком (щелчок по ней, стрелки,
 * Backspace после неё), как разделитель. Это же делает документ из одной
 * картинки непустым для `isEmpty` движка, на котором держатся `required` и
 * пустое значение `""`.
 *
 * ПУСТАЯ ПОДПИСЬ НЕ ПИШЕТСЯ. Узел подписи в Документе есть всегда, иначе её
 * некуда было бы набрать; в HTML `figcaption` уходит, только когда в ней есть
 * текст. Обратный путь симметричен: `<figure>` без подписи и голый `<img>`
 * получают пустую.
 */
export const RichImage = Node.create<RichImageOptions>({
  name: IMAGE_NODE,
  group: "block",
  content: CAPTION_NODE,
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addOptions() {
    return {
      onOpenEditor: () => {},
      captionPlaceholder: () => "",
      uploadingLabel: (name) => name,
      upload: () => undefined,
      describeNotice: () => ({ tone: "status", text: "" }),
    };
  },

  addExtensions() {
    return [ImageCaption];
  },

  addAttributes() {
    // Атрибуты читает правило разбора (`attributesFromImg`), а пишет
    // `renderHTML`: со своих элементов `figure` Tiptap ничего не берёт —
    // иначе `<figure src="javascript:…">` обошёл бы проверку адреса.
    const own = { parseHTML: () => null, rendered: false };
    return {
      src: { default: "", ...own },
      alt: { default: "", ...own },
      width: { default: null, ...own },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (dom) => attributesFromImg(dom.querySelector("img")),
        // Содержимое — текст подписи; без неё — пустой элемент, и подпись
        // получается пустой, а не из случайного текста внутри `figure`.
        contentElement: (dom) =>
          (dom as HTMLElement).querySelector("figcaption") ??
          dom.ownerDocument!.createElement("figcaption"),
      },
      { tag: "img[src]", getAttrs: (dom) => attributesFromImg(dom) },
    ];
  },

  renderHTML({ node }): DOMOutputSpec {
    const img: DOMOutputSpec = ["img", imgAttributes(node)];
    if (!hasCaption(node)) return ["figure", img];
    /*
      Дыра содержимого в DOMOutputSpec обязана быть единственным ребёнком
      своего элемента, а подпись идёт ПОСЛЕ `img` в том же `figure`. Поэтому
      с подписью — DOM-узлом: `contentDOM` — сама `figure`, и подпись
      дописывается за картинкой.
    */
    const figure = document.createElement("figure");
    const element = document.createElement("img");
    for (const [name, value] of Object.entries(imgAttributes(node))) {
      element.setAttribute(name, value);
    }
    figure.append(element);
    return { dom: figure, contentDOM: figure };
  },

  markdownTokenName: "image",

  parseMarkdown: (token) => {
    const src = typeof token.href === "string" ? token.href.trim() : "";
    /*
      Картинка с чужим адресом пропадает целиком: её `alt` в тексте Документа
      места нет. Пустой результат `@tiptap/markdown` понимает как «не моё» и
      отдаёт токен запасному разбору, который вернул бы `alt` текстом. Поэтому
      — узел без типа в Схеме: приведение к Схеме (`markdown.ts`, `conform`)
      разворачивает такие узлы в их содержимое, а содержимого у него нет.
    */
    if (!isAllowedImageSrc(src)) return { type: DROPPED_IMAGE };
    return {
      type: IMAGE_NODE,
      attrs: { src, alt: typeof token.text === "string" ? token.text : "", width: null },
      content: [{ type: CAPTION_NODE }],
    };
  },

  renderMarkdown: (node) => {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "").replace(/([[\]\\])/g, "\\$1");
    return isAllowedImageSrc(src) ? `![${alt}](${src.replace(/[()\s]/g, encodeURIComponent)})` : "";
  },

  addCommands() {
    return {
      openImageEditor:
        () =>
        ({ editor, dispatch }) => {
          if (!editor.isEditable) return false;
          if (dispatch) this.options.onOpenEditor();
          return true;
        },
      insertImage:
        (attributes) =>
        ({ tr, dispatch, state }) => {
          const src = attributes.src.trim();
          if (!isAllowedImageSrc(src)) return false;
          const image = state.schema.nodes[IMAGE_NODE]!.create(
            { src, alt: attributes.alt ?? "", width: widthOf(attributes.width) },
            state.schema.nodes[CAPTION_NODE]!.create()
          );
          if (dispatch) {
            const at = placeImage(tr, tr.selection.from, image);
            if (at >= 0) selectCaption(tr, at);
          }
          return true;
        },
      updateImage:
        (attributes) =>
        ({ tr, dispatch, state }) => {
          const found = selectedImage(state);
          if (!found) return false;
          const next = { ...(found.node.attrs as ImageAttributes), ...attributes };
          next.src = next.src.trim();
          if (!isAllowedImageSrc(next.src)) return false;
          next.width = widthOf(next.width);
          if (dispatch) {
            const wasNode = tr.selection instanceof NodeSelection;
            tr.setNodeMarkup(found.pos, undefined, next);
            if (wasNode) tr.setSelection(NodeSelection.create(tr.doc, found.pos));
          }
          return true;
        },
      removeImage:
        () =>
        ({ tr, dispatch, state }) => {
          const found = selectedImage(state);
          if (!found) return false;
          if (dispatch) tr.delete(found.pos, found.pos + found.node.nodeSize);
          return true;
        },
      uploadImages:
        (files, pos) =>
        ({ editor, dispatch }) => {
          if (!editor.isEditable) return false;
          if (!this.options.upload()) {
            if (dispatch) notify(editor, this.options, { kind: "unsupported" });
            return false;
          }
          if (dispatch)
            void uploadFiles(editor, this.options, files, pos ?? editor.state.selection.from);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const inCaption = () => this.editor.state.selection.$from.parent.type.name === CAPTION_NODE;
    return {
      /*
        Enter в подписи — выход из неё в новый абзац под картинкой: подпись
        одна строка, а второй `figcaption` в `figure` Схема не пустит. Enter на
        выделенной картинке — вход в её подпись: так до подписи доходят с
        клавиатуры, стрелками выделив картинку.
      */
      Enter: ({ editor }) => {
        const found = selectedImage(editor.state);
        if (!found) return false;
        if (editor.state.selection instanceof NodeSelection) {
          return editor.commands.command(({ tr }) => {
            selectCaption(tr, found.pos);
            return true;
          });
        }
        if (!inCaption()) return false;
        return editor.commands.command(({ tr, state }) => {
          const after = found.pos + found.node.nodeSize;
          tr.insert(after, state.schema.nodes.paragraph!.create());
          tr.setSelection(TextSelection.create(tr.doc, after + 1));
          return true;
        });
      },
      // Backspace в начале подписи выделяет картинку, а не склеивает подпись
      // с Блоком выше — склейка разобрала бы картинку на текст.
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        if (!inCaption() || !selection.empty || selection.$from.parentOffset > 0) return false;
        const found = selectedImage(editor.state);
        if (!found) return false;
        return editor.commands.setNodeSelection(found.pos);
      },
    };
  },

  addNodeView() {
    return ({ node, view, getPos, editor }) =>
      new ImageView(node, view, getPos as () => number | undefined, editor);
  },

  addProseMirrorPlugins() {
    return [
      captionPlaceholderPlugin(this.options.captionPlaceholder),
      uploadPlugin(this.editor, this.options),
    ];
  },
});

/**
 * Подсказка пустой подписи — декорацией, а не текстом: в Документ и в HTML
 * она не попадает. Класс `rte-caption-empty` прячет пустую подпись в
 * нередактируемом поле (`prose.ts` её не знает: в сохранённом HTML пустой
 * подписи нет вовсе).
 */
function captionPlaceholderPlugin(text: () => string): Plugin {
  return new Plugin({
    key: new PluginKey("imageCaptionPlaceholder"),
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name !== CAPTION_NODE) return true;
          if (node.content.size === 0) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "rte-caption-empty",
                "data-placeholder": text(),
              })
            );
          }
          return false;
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/** Есть ли у адреса схема (`https:`, `data:`, `blob:`…). */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Адрес из поля поповера — в адрес картинки, или `null`, если такой картинке
 * в Документе не быть. Правило то же, что у ссылки (`normalizeLinkInput`):
 * адрес без схемы получает `https://`, а начинающийся с `/`, `#`, `?` или `.`
 * — ошибка, а не путь от текущей страницы. Строже в одном: схемы только
 * `http` и `https` — ни `mailto:`, ни `data:`, ни `blob:`.
 */
export function normalizeImageInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (SCHEME.test(value)) return isAllowedImageSrc(value) ? value : null;
  if (/^[/#?.]/.test(value)) return null;
  const candidate = `https://${value}`;
  return isAllowedImageSrc(candidate) ? candidate : null;
}

/** Действие над плейсхолдерами загрузки — метой транзакции, без правки Документа. */
type UploadAction = { add: { id: object; pos: number; name: string } } | { remove: { id: object } };

const UPLOAD_KEY = new PluginKey<DecorationSet>("imageUpload");

/** Где сейчас плейсхолдер загрузки `id`: его позиция едет вместе с правками вокруг. */
function placeholderPos(state: EditorState, id: object): number | null {
  const found = UPLOAD_KEY.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
  return found?.[0]?.from ?? null;
}

/** Есть ли в HTML буфера текст — тогда это выделение документа, а не одна картинка. */
function htmlHasText(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim() !== "";
}

/**
 * Файлы из буфера и перетаскивания, плейсхолдеры загрузки.
 *
 * ПЛЕЙСХОЛДЕР — ДЕКОРАЦИЯ, А НЕ УЗЕЛ. Пока загрузка идёт, Документ не меняется
 * вовсе: картинки с `blob:`-адресом нет ни в `getHTML()`, ни в `onChange`, ни
 * в форме, ни в истории правок. Декорация едет вместе с текстом вокруг, а по
 * завершении на её место встаёт настоящая картинка — одной транзакцией, то
 * есть одной отменой. Отказ загрузки снимает декорацию, и откатывать нечего:
 * правки не было. Это рецепт загрузки из примеров ProseMirror; minimal-tiptap
 * вставлял узел с `blob:` сразу и подменял адрес потом, и такой адрес успевал
 * уйти в значение.
 *
 * КАКИЕ ФАЙЛЫ НАШИ. Вставка с текстом в HTML буфера — это выделение из Word
 * или страницы, и снимок выделения, который Word кладёт рядом картинкой,
 * загружать нельзя: идёт обычный разбор HTML. HTML без текста («Копировать
 * картинку» в браузере) — сама картинка: с загрузчиком загружается файл, без
 * него остаётся разбор HTML — картинка по адресу, если он в политике.
 */
function uploadPlugin(editor: Editor, options: RichImageOptions): Plugin {
  const start = (files: readonly File[], pos: number) => {
    if (!options.upload()) {
      notify(editor, options, { kind: "unsupported" });
      return;
    }
    void uploadFiles(editor, options, files, pos);
  };

  return new Plugin<DecorationSet>({
    key: UPLOAD_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        let next = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(UPLOAD_KEY) as UploadAction | undefined;
        if (action && "add" in action) {
          const { id, name } = action.add;
          const widget = Decoration.widget(
            action.add.pos,
            () => uploadPlaceholder(options.uploadingLabel(name), previews.get(id)),
            { id, side: -1 }
          );
          next = next.add(tr.doc, [widget]);
        } else if (action && "remove" in action) {
          const { id } = action.remove;
          next = next.remove(next.find(undefined, undefined, (spec) => spec.id === id));
          const preview = previews.get(id);
          if (preview) URL.revokeObjectURL(preview);
          previews.delete(id);
        }
        return next;
      },
    },
    props: {
      decorations: (state) => UPLOAD_KEY.getState(state),
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0 || !editor.isEditable) return false;
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (html && (htmlHasText(html) || !options.upload())) return false;
        event.preventDefault();
        start(files, view.state.selection.from);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || files.length === 0 || !editor.isEditable) return false;
        event.preventDefault();
        let pos = view.state.selection.from;
        try {
          pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? pos;
        } catch {
          // Без раскладки (тесты, скрытое поле) позиции по координатам нет —
          // картинка встаёт у каретки.
        }
        start(files, pos);
        return true;
      },
    },
  });

  /** Плейсхолдер — блок с превью и подписью «Загружается …». В Документ он не попадает. */
  function uploadPlaceholder(label: string, preview: string | undefined): HTMLElement {
    const box = document.createElement("div");
    box.contentEditable = "false";
    box.dataset.imageUpload = "";
    box.className = UPLOAD_PLACEHOLDER_CLASS;
    if (preview) {
      const img = document.createElement("img");
      img.src = preview;
      img.alt = "";
      img.className = "max-h-40 max-w-full rounded-(--rte-radius) opacity-60";
      box.append(img);
    }
    const text = document.createElement("span");
    text.textContent = label;
    box.append(text);
    return box;
  }
}

/**
 * Превью файлов в плейсхолдерах по ключу загрузки. `blob:`-адрес живёт только
 * в DOM плейсхолдера и отзывается вместе с ним — в Документ он не попадает.
 */
const previews = new Map<object, string>();

/**
 * Загрузить файлы по одному и вставить картинки, начиная с `pos`.
 *
 * ПО ОДНОМУ, А НЕ РАЗОМ. Следующая картинка встаёт сразу за предыдущей, и
 * порядок в Документе — порядок файлов, а не того, кто раньше ответил.
 * Плейсхолдер у каждого свой, и появляется он, когда до файла дошла очередь.
 */
async function uploadFiles(
  editor: Editor,
  options: RichImageOptions,
  files: readonly File[],
  pos: number
): Promise<void> {
  let at = pos;
  for (const file of files) {
    const upload = options.upload();
    if (editor.isDestroyed || !upload) return;
    if (!file.type.startsWith("image/")) {
      notify(editor, options, { kind: "notImage", name: file.name });
      continue;
    }
    const id = {};
    if (typeof URL.createObjectURL === "function") previews.set(id, URL.createObjectURL(file));
    const { view } = editor;
    const add: UploadAction = {
      add: { id, pos: Math.min(at, view.state.doc.content.size), name: file.name },
    };
    view.dispatch(view.state.tr.setMeta(UPLOAD_KEY, add));
    notify(editor, options, { kind: "uploading", name: file.name });

    let src: unknown = null;
    try {
      src = await upload(file);
    } catch {
      src = null;
    }
    if (editor.isDestroyed) {
      // Поле размонтировано посреди загрузки: плейсхолдера больше нет, превью отзывается здесь.
      const preview = previews.get(id);
      if (preview) URL.revokeObjectURL(preview);
      previews.delete(id);
      return;
    }

    const placed = placeholderPos(editor.state, id);
    const tr = editor.state.tr.setMeta(UPLOAD_KEY, { remove: { id } } satisfies UploadAction);
    const address = typeof src === "string" ? src.trim() : "";
    if (!isAllowedImageSrc(address)) {
      editor.view.dispatch(tr);
      notify(editor, options, { kind: "failed", name: file.name });
      continue;
    }
    // Плейсхолдер пропал вместе с текстом вокруг — картинке некуда вставать.
    if (placed == null) {
      editor.view.dispatch(tr);
      at = editor.state.selection.from;
      continue;
    }
    const { schema } = editor.state;
    const image = schema.nodes[IMAGE_NODE]!.create(
      { src: address, alt: "", width: null },
      schema.nodes[CAPTION_NODE]!.create()
    );
    const inserted = placeImage(tr, placed, image);
    // Своя ступень истории: отмена убирает картинку, а не заодно и текст,
    // набранный перед ней за те же полсекунды.
    closeHistory(tr);
    editor.view.dispatch(tr);
    at = inserted >= 0 ? inserted + image.nodeSize : editor.state.selection.from;
    notify(editor, options, { kind: "uploaded", name: file.name });
  }
}

const UPLOAD_PLACEHOLDER_CLASS =
  "my-1 flex min-h-16 flex-col items-center justify-center gap-2 rounded-(--rte-radius) " +
  "border border-dashed border-(--rte-code-border) bg-(--rte-code-background) p-3 " +
  "text-sm text-(--rte-muted-foreground)";

/** Ширина, к которой прилипает ручка: ближайший пресет к доле ширины Документа. */
function nearestWidth(percent: number): ImageWidth {
  return IMAGE_WIDTHS.reduce((best, width) =>
    Math.abs(Number(width) - percent) < Math.abs(Number(best) - percent) ? width : best
  );
}

/**
 * Представление картинки в Редакторе: `figure` с картинкой, ручками ширины и
 * местом для подписи.
 *
 * СВОЁ ПРЕДСТАВЛЕНИЕ, А НЕ React. Узлу нужны картинка и две ручки — React-узел
 * Tiptap ради этого тянул бы рендер на каждую картинку и свой портал.
 *
 * РУЧКИ — ТОЛЬКО ДЛЯ МЫШИ. Они `aria-hidden` и без фокуса: с клавиатуры та же
 * ширина ставится пресетами в поповере картинки. Пока ручку тянут, ширина
 * меняется в DOM, а в Документ при отпускании уходит ближайший пресет — одна
 * правка, одна отмена.
 */
class ImageView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private img: HTMLImageElement;
  private node: ProseMirrorNode;

  constructor(
    node: ProseMirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private editor: Editor
  ) {
    this.node = node;
    this.dom = document.createElement("figure");
    const frame = document.createElement("div");
    frame.contentEditable = "false";
    frame.className = "relative";
    this.img = document.createElement("img");
    frame.append(this.img);
    for (const side of ["left", "right"] as const) frame.append(this.handle(side));
    this.contentDOM = document.createElement("div");
    this.dom.append(frame, this.contentDOM);
    this.render();
  }

  private render() {
    const attributes = imgAttributes(this.node);
    for (const name of ["src", "alt", "data-width"]) {
      if (attributes[name] == null) this.img.removeAttribute(name);
      else this.img.setAttribute(name, attributes[name]);
    }
  }

  private handle(side: "left" | "right"): HTMLElement {
    const handle = document.createElement("div");
    handle.setAttribute("aria-hidden", "true");
    handle.dataset.resizeHandle = side;
    handle.className =
      side === "left" ? RESIZE_HANDLE_CLASS + " -left-1" : RESIZE_HANDLE_CLASS + " -right-1";
    handle.addEventListener("pointerdown", (event) => this.startResize(event, side));
    return handle;
  }

  private startResize(event: PointerEvent, side: "left" | "right") {
    if (!this.editor.isEditable || event.button !== 0) return;
    event.preventDefault();
    const container = this.dom.parentElement?.getBoundingClientRect().width ?? 0;
    const start = this.dom.getBoundingClientRect().width;
    if (container <= 0 || start <= 0) return;
    const startX = event.clientX;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    // Картинка стоит по центру: край идёт за курсором, когда ширина меняется
    // на удвоенный сдвиг.
    const sign = side === "right" ? 2 : -2;
    let width = start;
    const move = (moveEvent: PointerEvent) => {
      width = Math.min(
        container,
        Math.max(container * 0.25, start + sign * (moveEvent.clientX - startX))
      );
      this.dom.style.width = `${width}px`;
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      this.dom.style.removeProperty("width");
      const pos = this.getPos();
      if (pos == null) return;
      const next = nearestWidth((width / container) * 100);
      if (next === this.node.attrs.width) return;
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, width: next })
      );
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  // Ручки ведут себя сами: ни выделения, ни перетаскивания узла от них.
  stopEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest("[data-resize-handle]") != null;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: "selection"; target: globalThis.Node }
  ): boolean {
    if (mutation.type === "selection") return false;
    return !this.contentDOM.contains(mutation.target);
  }
}

/*
  Ручка — полоса у края картинки, видна только у выделенной картинки в
  редактируемом поле (`prose`-классы Редактора, `ProseMirror-selectednode`).
*/
const RESIZE_HANDLE_CLASS =
  "rte-resize-handle absolute top-1/2 hidden h-10 w-2 -translate-y-1/2 cursor-ew-resize " +
  "rounded-full border border-(--rte-background) bg-(--rte-primary)";
