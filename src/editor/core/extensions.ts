"use client";

// Происхождение: minimal-tiptap, `hooks/use-minimal-tiptap.ts`, функция
// `createExtensions` (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap).
// Оставлено ядро StarterKit и Placeholder; картинки, файлы, цвет, таблицы и
// Markdown придут отдельными срезами. Лицензия — NOTICE в корне пакета.

import { Extension, type Extensions } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit, type StarterKitOptions } from "@tiptap/starter-kit";
import { AtomText } from "./atomText.js";
import { BlockCommands, BlockMenuKey } from "./blockCommands.js";
import { FieldNoticeExtension, type FieldNoticeOptions } from "./fieldNotice.js";
import type { RichImageOptions } from "../features/image/image.js";
import { createDocumentNode } from "./document.js";
import { createMarkdown, MarkdownPaste } from "./markdown.js";
import { MaxLength } from "./maxLength.js";
import {
  HighlightExtension,
  TEXT_COLOR_EXTENSIONS,
  TextAlignExtension,
} from "../features/color/styleExtensions.js";
import { TriggerCommand, type SlashBridge, type TriggerBinding } from "./slashCommand.js";
import {
  describedTools,
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
 *   ленивой Частью для движка из описания (`codeBlockTool.ts`, `tableTool.ts`).
 */
/**
 * Ключи StarterKit, которые принадлежат Инструментам. Все выключены, пока их не
 * включит доля описания (`starterKit`) или не переехавший Инструмент: Метка,
 * которой нет в наборе, не попадает в Схему. Цитата, разделитель, блок кода и
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

/**
 * Части для движка не переехавших встроенных Инструментов (OLDSUI-273):
 * переезд переносит запись отсюда в поле `engine` описания. Доли StarterKit
 * не переехавших — `legacyStarterKit` ниже.
 */
const LEGACY_ENGINE: Partial<Record<Tool, (context: ToolEngineContext) => Extensions>> = {
  superscript: () => [Superscript],
  subscript: () => [Subscript],
  // Цвет, маркер и выравнивание пишут `data-color` и `data-align`, а не `style`
  // (`styleExtensions.ts`; единственное исключение — цвет автора, `customColor.ts`):
  // выключенный инструмент не отдаёт ни атрибута, ни правила разбора, и такой
  // атрибут из вставки отбрасывается.
  color: () => TEXT_COLOR_EXTENSIONS,
  highlight: () => [HighlightExtension],
  align: () => [TextAlignExtension],
  taskList: (context) => [
    TaskList,
    TaskItem.configure({
      // Вложенные чек-листы — как вложенные обычные списки: Tab и Shift+Tab.
      nested: true,
      a11y: { checkboxLabel: (node) => context.taskCheckbox(node.textContent) },
    }),
  ],
};

/** Доли StarterKit не переехавших Инструментов: включённый — умолчание StarterKit. */
function legacyStarterKit(on: (tool: Tool) => boolean, context: ToolEngineContext) {
  const keep = (tool: Tool) => (on(tool) ? { [STARTER_KIT_KEY[tool] ?? tool]: undefined } : {});
  return {
    // H1 — только с `heading1`; без него `#` и `<h1>` остаются
    // прежними: правило ввода и разбор HTML строятся по этим уровням.
    ...(on("heading") && {
      heading: { levels: context.has("heading1") ? [1, 2, 3, 4] : [2, 3, 4] },
    }),
    ...keep("bold"),
    ...keep("italic"),
    ...keep("underline"),
    ...keep("strike"),
    ...keep("code"),
    ...keep("bulletList"),
    ...keep("orderedList"),
    ...keep("history"),
  } as Partial<StarterKitOptions>;
}

/** Ключ StarterKit Инструмента, если он не совпадает с именем. */
const STARTER_KIT_KEY: Partial<Record<Tool, keyof StarterKitOptions>> = { history: "undoRedo" };

/** Место символов-триггеров в `ENGINE_ORDER`: они не Инструмент, но порядок держат. */
const TRIGGERS = "triggers";

/**
 * ПОРЯДОК РЕГИСТРАЦИИ Частей для движка встроенных — привилегия кита, как
 * порядок поверхностей, и не зависит от того, переехал ли Инструмент. От него
 * зависят:
 *
 * - **ранг Меток** — а с ним вложенность Меток в сохранённом HTML;
 * - **вставка и drop** (ADR-0058, п. 9.5): плагины ProseMirror у Tiptap идут в
 *   обратном порядке регистрации при равном `priority`, и зарегистрированное
 *   последним опрашивается первым. Свои Инструменты стоят после встроенных
 *   (`expandTools`), поэтому `transformPastedHTML`, `transformPasted`,
 *   `handlePaste` и `handleDrop` своего Инструмента видят событие раньше и могут
 *   забрать его. Давать встроенному плагину `priority` выше 100 нельзя без правки
 *   этого правила;
 * - **клавиши**: `Alt+F10` блока кода (`codeBlockTool.ts`) зарегистрирован после
 *   `ToolbarFocus` и опрашивается раньше; Tab в таблице — раньше Раскладки.
 *
 * Список повторяет порядок до переезда (OLDSUI-273): сначала Инструменты, чьи
 * расширения подключались отдельными ветками, затем Меню вставки, триггеры и
 * описания в порядке `TOOLS`. Метки и Блоки из StarterKit регистрирует он сам.
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

export function createEditorExtensions(options: EditorExtensionOptions): Extensions {
  /*
    Движок — проекция списка описаний (`toolDescriptor.ts`): Часть для движка
    переехавшего Инструмента берётся из описания, остальных — из
    `LEGACY_ENGINE`. `on` — «Инструмент включён и его расширение ещё здесь»;
    связи между Инструментами (уровни заголовка, Обёртка в колонке) спрашивают
    `has` контекста.
  */
  const described = describedTools(options.tools);
  const context: ToolEngineContext = { ...options, has: (tool) => options.tools.has(tool) };
  const on = (tool: Tool) =>
    options.tools.has(tool) && !described.some((descriptor) => descriptor.name === tool);
  // Контейнеры Блоков верхнего уровня: их принимает только свой Документ.
  const containers = described.flatMap((descriptor) => descriptor.documentContent ?? []);

  const extensions: Extensions = [
    StarterKit.configure({
      ...STARTER_KIT_OFF,
      ...legacyStarterKit(on, context),
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
  // Части для движка встроенных — в порядке кита, свои — следом в порядке списка.
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
    else if (on(slot)) extensions.push(...(LEGACY_ENGINE[slot]?.(context) ?? []));
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
  if (buttons.length + entries.length > 0) {
    extensions.push(ToolButtons.configure({ buttons, entries, openPopover: options.openPopover }));
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
