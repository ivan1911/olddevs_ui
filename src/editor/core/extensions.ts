"use client";

// Происхождение: minimal-tiptap, `hooks/use-minimal-tiptap.ts`, функция
// `createExtensions` (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap).
// Оставлено ядро StarterKit и Placeholder; картинки, файлы, цвет, таблицы и
// Markdown придут отдельными срезами. Лицензия — NOTICE в корне пакета.

import { Extension, type Extensions } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit, type StarterKitOptions } from "@tiptap/starter-kit";
import { AtomText } from "./atomText.js";
import { BlockCommands, BlockMenuKey } from "./blockCommands.js";
import { FieldNoticeExtension, type FieldNoticeOptions } from "./fieldNotice.js";
import type { RichImageOptions } from "../features/image/image.js";
import { createDocumentNode } from "./document.js";
import { createMarkdown, MarkdownPaste } from "./markdown.js";
import { MaxLength } from "./maxLength.js";
import { TriggerCommand, type SlashBridge, type TriggerBinding } from "./slashCommand.js";
import {
  type BlockTraits,
  type ToolDescriptor,
  type ToolEngineContext,
  type ToolList,
} from "./toolDescriptor.js";
import { ToolButtons, type ToolPopoverEntry, type ToolPopoverRequest } from "./toolButtons.js";
import { ToolEntryShortcuts } from "./toolEntryShortcuts.js";
import type { Tool } from "./tools.js";

export interface EditorExtensionOptions {
  /** Включённые инструменты: выключенный не попадает в Схему вовсе. */
  tools: ToolList;
  /** Плейсхолдер читается при каждом показе: смена локали не пересоздаёт движок. */
  placeholder: () => string;
  /** Предел символов; `undefined` — без предела. Читается на каждой транзакции. */
  limit: () => number | undefined;
  /** Имя флажка пункта чек-листа — из каталога, читается при каждой перерисовке пункта. */
  taskCheckbox: (text: string) => string;
  /**
   * Имя кнопки раскрытия сворачиваемого Блока по тексту его заголовка — из
   * каталога, читается при каждой перерисовке кнопки.
   */
  detailsToggle: (text: string) => string;
  /**
   * Мост Меню вставки по `/`. Нет — меню не открывается: инструмент
   * `insertMenu` выключен или пунктов для него нет.
   */
  slash?: SlashBridge;
  /**
   * Свои символы-триггеры Инструментов и мосты их списков (ADR-0064). Нет или
   * пусто — своих триггеров нет; от Меню вставки они не зависят.
   */
  triggers?: readonly TriggerBinding[];
  /**
   * Открыть поповер записи описания у выделения или у Блока: сочетание кнопки,
   * кнопка ссылки, пункт вставки и Действие над Блоком с поповером. Поповер
   * держит `RichTextEditor`.
   */
  openPopover: (request: ToolPopoverRequest) => void;
  /** Перевести фокус в Панель (`Alt+F10`); `false` — Панели нет, клавиша идёт дальше. */
  focusToolbar: () => boolean;
  /** Открыть меню ручки Блока (`Mod+/`); `false` — ручки нет, клавиша идёт дальше. */
  openBlockMenu: () => boolean;
  /**
   * Картинка: поповер, загрузчик и сообщения о файлах держит `RichTextEditor`.
   * Нет — картинки нет в Схеме, даже при включённом инструменте.
   */
  image?: RichImageOptions;
  /** Сообщение поля (`showNotice`): состояние держит `RichTextEditor`. */
  onNotice: FieldNoticeOptions["onNotice"];
  /**
   * Открыть панель поиска (`Mod+F`, `Mod+Alt+F`); `replace` — с
   * фокусом в поле замены. Панель держит `RichTextEditor`; `false` — панели
   * нет, и клавиша уходит браузеру.
   */
  openSearch?: (replace: boolean) => boolean;
}

/**
 * `Alt+F10` — из документа в Панель. Так это сочетание работает в CKEditor,
 * TinyMCE и Google Docs (`Alt+F10` / `Alt+/`): у APG своего нет, а
 * пользователю клавиатуры привычнее одно сочетание на все редакторы, чем своё
 * у каждого. Tab для этого не годится: в документе он сдвигает пункт списка.
 */
const ToolbarFocus = Extension.create<{ focus: () => boolean }>({
  name: "toolbarFocus",
  addOptions: () => ({ focus: () => false }),
  addKeyboardShortcuts() {
    return { "Alt-F10": () => this.options.focus() };
  },
});

/**
 * Tab, который взял Документ, не доходит до окна вокруг Редактора.
 *
 * Tab в Документе занят: сдвигает пункт списка, ходит по ячейкам таблицы и по
 * колонкам Раскладки. Но ловушка фокуса Radix у `Dialog` и `Drawer` слушает
 * Tab на своём контейнере и, когда Редактор — последнее поле окна, уводит фокус
 * к первому, не глядя на `defaultPrevented`: каретка уже в соседней колонке, а
 * фокус — на кнопке «Закрыть». Поэтому взятый Документом Tab дальше не
 * всплывает. Слушатель стоит в представлении плагина: оно создаётся после
 * обработчиков ProseMirror и видит, взял ли он клавишу. Tab, который Документ
 * отпустил (край Раскладки, абзац вне списка), уходит окну как обычно.
 */
const HandledTabStaysInside = Extension.create({
  name: "handledTabStaysInside",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: new PluginKey("handledTabStaysInside"),
      view(view) {
        const keep = (event: KeyboardEvent) => {
          if (event.key === "Tab" && event.defaultPrevented) event.stopPropagation();
        };
        view.dom.addEventListener("keydown", keep);
        return { destroy: () => view.dom.removeEventListener("keydown", keep) };
      },
    }),
  ],
});

/**
 * Признаки Блоков описаний (`blocks`) — в spec узлов Схемы: `blockContainer`,
 * `turnInto` и `plainAtom`, которые читают ручка и Меню выделения. Расширение
 * без разметки: `extendNodeSchema` у Tiptap зовётся для каждого узла набора, и
 * признак находит свой узел по имени. Нет признаков — расширения нет.
 */
function blockTraitsExtension(traits: Readonly<Record<string, BlockTraits>>) {
  return Extension.create({
    name: "blockTraits",
    extendNodeSchema: (extension) => {
      const own = Object.hasOwn(traits, extension.name) ? traits[extension.name] : undefined;
      return own
        ? {
            blockContainer: own.container === true,
            turnInto: own.turnInto === true,
            plainAtom: own.plainAtom === true,
          }
        : {};
    },
  });
}

/**
 * Ключи StarterKit, которые принадлежат Инструментам. Все выключены, пока их не
 * включит доля описания (`starterKit`): Метка, которой нет в наборе, не
 * попадает в Схему. Цитата, разделитель, блок кода и
 * ссылка — свои расширения кита, а `trailingNode` выключен всегда (см. выше).
 * Документ, абзац, текст, перенос, пункт списка, его клавиши и курсоры
 * StarterKit остаются его умолчаниями: они есть в любом наборе.
 */
const STARTER_KIT_OFF: Partial<StarterKitOptions> = {
  heading: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  bulletList: false,
  orderedList: false,
  undoRedo: false,
  blockquote: false,
  codeBlock: false,
  horizontalRule: false,
  link: false,
  trailingNode: false,
};

/** Место символов-триггеров в `ENGINE_ORDER`: они не Инструмент, но порядок держат. */
const TRIGGERS = "triggers";

/**
 * ПОРЯДОК РЕГИСТРАЦИИ Extensions встроенных Инструментов — привилегия кита, как
 * порядок поверхностей, и описание его не задаёт. От него зависят:
 *
 * - **ранг Меток** — а с ним вложенность Меток в сохранённом HTML;
 * - **вставка и drop** (ADR-0058, п. 9.5): плагины ProseMirror у Tiptap идут в
 *   обратном порядке регистрации при равном `priority`, и зарегистрированное
 *   последним опрашивается первым. Свои Инструменты стоят после встроенных
 *   (`expandTools`), поэтому `transformPastedHTML`, `transformPasted`,
 *   `handlePaste` и `handleDrop` своего Инструмента видят событие раньше и могут
 *   забрать его. Давать встроенному плагину `priority` выше 100 нельзя без правки
 *   этого правила;
 * - **клавиши**: `Enter`, `Backspace` и стрелки сворачиваемого Блока (`details`)
 *   срабатывают только в его заголовке и в пустом конце содержимого, поэтому
 *   с клавишами других Блоков не спорят. Он стоит сразу за контейнерами
 *   (Раскладка, Обёртка): позже ядра и StarterKit, значит, опрашивается раньше
 *   них — `Enter` в заголовке уходит в содержимое, а не режет заголовок надвое;
 * - **клавиши**: `Alt+F10` блока кода (`codeBlockTool.ts`) зарегистрирован после
 *   `ToolbarFocus` и опрашивается раньше; Tab в таблице — раньше Раскладки.
 *
 * Список сохраняет порядок, который был до переезда встроенных на описания, —
 * эталонные тесты (`rich-text-editor-golden.test.tsx`) держат сохранённый HTML и клавиши. Метки и
 * Блоки из StarterKit регистрирует он сам, в своём порядке.
 */
const ENGINE_ORDER: readonly (Tool | typeof TRIGGERS)[] = [
  "superscript",
  "subscript",
  "color",
  "highlight",
  "align",
  "taskList",
  "image",
  "layout",
  "wrapper",
  "details",
  "insertMenu",
  TRIGGERS,
  "history",
  "heading",
  "heading1",
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "clearFormatting",
  "link",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "emoji",
  "source",
  "search",
  "toc",
];

/**
 * Набор расширений — это и есть Схема в коде: что не зарегистрировано здесь,
 * ProseMirror не разберёт ни из `value`, ни из буфера. Белый список ДАННЫМИ,
 * совпадающий с полным набором, лежит в `schema.ts`.
 *
 * ВЫКЛЮЧЕННЫЙ ИНСТРУМЕНТ — ВЫКЛЮЧЕННОЕ РАСШИРЕНИЕ. Вместе с узлом или меткой
 * уходят его сочетание клавиш, markdown-шорткат и правило разбора вставки:
 * такого Блока не получить ничем (спека, «Набор инструментов»). Инструменты без
 * своего расширения (`clearFormatting`) убирают только кнопку.
 *
 * Отличия от оригинала, и каждое — про чистоту значения:
 *
 * - **Без `HTMLAttributes: { class: "…-node" }`** на узлах. Оригинал вешал
 *   классы ради своих стилей, и они уезжали в сохранённый HTML — то есть в базу
 *   потребителя и в белый список его санитайзера. Типографика здесь живёт на
 *   контейнере (`prose.ts`) и находит теги по имени.
 * - **`trailingNode: false`.** Расширение дописывает пустой абзац после
 *   заголовка, списка или цитаты в конце, и каждый такой документ отдавался с
 *   хвостом `<p></p>`.
 * - **Ссылка — своё расширение** (`link.ts`), а не `link` из StarterKit: та
 *   пропускала бы `target`, `class` и относительные адреса.
 * - **Блок кода — своё расширение** (`codeBlock.ts`), а не
 *   `codeBlock` из StarterKit: язык из `codeLanguages.ts` и подсветка
 *   декорациями lowlight (ADR-0051). В Документ по-прежнему уходит только
 *   `class="language-*"` на `<code>`. Оно, как и таблица, приходит
 *   из описания ленивыми Extensions (`codeBlockTool.ts`, `tableTool.ts`).
 */
export function createEditorExtensions(options: EditorExtensionOptions): Extensions {
  /*
    Движок — проекция списка описаний (`toolDescriptor.ts`): Extensions
    Инструмента берутся из его описания. Связи между Инструментами (уровни
    заголовка, Обёртка в колонке) спрашивают `has` контекста.
  */
  const described = options.tools.descriptors;
  // Без самого набора: связи между Инструментами — только через `has`.
  const { tools, ...bridges } = options;
  const context: ToolEngineContext = { ...bridges, has: (tool) => tools.has(tool) };
  // Контейнеры Блоков верхнего уровня: их принимает только свой Документ.
  const containers = described.flatMap((descriptor) => descriptor.documentContent ?? []);

  const extensions: Extensions = [
    StarterKit.configure({
      ...STARTER_KIT_OFF,
      // Доли описаний — одним StarterKit: порядок его Меток не меняется.
      ...Object.assign({}, ...described.map((descriptor) => descriptor.starterKit?.(context))),
      // С Раскладкой или Обёрткой Документ — свой (`document.ts`): они не в
      // группе `block`, и принять их может только тот, кто назвал их поимённо.
      document: containers.length > 0 ? false : undefined,
    }),
    ...(containers.length > 0 ? [createDocumentNode(containers)] : []),
    Placeholder.configure({ placeholder: () => options.placeholder() }),
    // Идёт после Блоков и Меток: Markdown собирает свои правила из расширений,
    // зарегистрированных к его запуску.
    createMarkdown(),
    MarkdownPaste,
    MaxLength.configure({ limit: options.limit }),
    // `leafText` из `renderText`: Текст атома для счётчика, копирования и `textContent`.
    AtomText,
    ToolbarFocus.configure({ focus: options.focusToolbar }),
    HandledTabStaysInside,
    // Команды над Блоками — своей разметки нет, включены всегда (`blockCommands.ts`).
    // После ядра Tiptap: его `Mod+A` (весь Документ) опрашивается позже нашего.
    BlockCommands.configure({ clearFormatting: options.tools.has("clearFormatting") }),
    // `⌘/` — меню ручки Блока по месту клавиши, раньше карт Меток (`blockCommands.ts`).
    BlockMenuKey.configure({ openBlockMenu: options.openBlockMenu }),
    // `showNotice` — в каждом Редакторе: сообщить может любой Инструмент (`fieldNotice.ts`).
    FieldNoticeExtension.configure({ onNotice: options.onNotice }),
  ];
  // Признаки Блоков описаний (`blocks`) — одним расширением на весь набор.
  const traits: Record<string, BlockTraits> = Object.assign(
    {},
    ...described.map((descriptor) => descriptor.blocks)
  );
  if (Object.keys(traits).length > 0) extensions.push(blockTraitsExtension(traits));
  // Extensions встроенных Инструментов — в порядке кита, свои — следом в порядке списка.
  const engineOf = (descriptor: ToolDescriptor) =>
    descriptor.engine?.(context, descriptor.options) ?? [];
  for (const slot of ENGINE_ORDER) {
    if (slot === TRIGGERS) {
      if (options.triggers?.length) {
        extensions.push(TriggerCommand.configure({ triggers: options.triggers }));
      }
      continue;
    }
    const descriptor = described.find((candidate) => candidate.name === slot);
    if (descriptor) extensions.push(...engineOf(descriptor));
  }
  for (const descriptor of described) {
    if (!(ENGINE_ORDER as readonly string[]).includes(descriptor.name)) {
      extensions.push(...engineOf(descriptor));
    }
  }
  // Сочетания кнопок описаний вешает кит: поле записи — их единственный источник.
  const buttons = described.flatMap((descriptor) => descriptor.buttons ?? []);
  // Поповер пункта вставки и Действия открывает та же команда, что у кнопки.
  const entries = described
    .flatMap((descriptor) => [
      ...(descriptor.insertItems ?? []),
      ...(descriptor.blockActions ?? []),
    ])
    .flatMap(({ id, label, popover }): ToolPopoverEntry[] =>
      popover ? [{ id, label: ({ messages, locale }) => label(messages, locale), popover }] : []
    );
  // Кнопке без сочетания и поповера (отмена, картинка) расширение не нужно: её
  // `run` зовёт Панель. Так набор расширений не меняется от того, что кнопка
  // переехала в описание.
  const keyed = buttons.filter((button) => button.shortcut || button.popover);
  if (keyed.length + entries.length > 0) {
    extensions.push(
      ToolButtons.configure({ buttons: keyed, entries, openPopover: options.openPopover })
    );
  }
  // То же — у пунктов вставки и Действий над Блоком.
  const keyedItems = described.flatMap((d) => d.insertItems ?? []).filter((i) => i.shortcut);
  const keyedActions = described.flatMap((d) => d.blockActions ?? []).filter((a) => a.shortcut);
  if (keyedItems.length + keyedActions.length > 0) {
    extensions.push(
      ToolEntryShortcuts.configure({ insertItems: keyedItems, blockActions: keyedActions })
    );
  }
  return extensions;
}
