import { Extension, Mark, Node, type Editor, type Extensions } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createElement, useState } from "react";
import { markRange, type CustomIslandProps, type CustomTool } from "../src/editor/index.js";
import { ImageIcon, PinIcon, SparkleIcon, TagIcon, WrapperIcon } from "../src/icons.js";

/**
 * Тестовые свои Инструменты эпика OLDSUI-98 — общий помощник тестов.
 *
 * Префикс `test_`: это проверка публичного API, а не новые Блоки кита. Каждый
 * Инструмент — своя переменная, чтобы тест брал ровно нужное, а `TEST_TOOLS` —
 * весь набор. Extensions написаны так, как их написал бы потребитель по
 * странице компонента: Node и Mark без `parseHTML`, `renderHTML`, `group` и
 * разбора атрибутов — всё это кит берёт из правил Схемы.
 *
 * Следующие срезы добавляют сюда свои (Метка с Карточкой у текста, Инструмент
 * без Блока с фильтром вставки, Инструмент с загрузчиком), а не заводят копии.
 */

/** Строчный атом — Merge Tag: `{{key}}` текстом атома, ключ — шаблоном. */
export const testMergeTagNode = Node.create({
  name: "test_mergeTag",
  atom: true,
  selectable: true,
  addAttributes: () => ({ test_key: { default: null } }),
  renderText: ({ node }) => `{{${String(node.attrs.test_key ?? "")}}}`,
});

export const testMergeTagTool: CustomTool = {
  name: "test_mergeTag",
  engine: [testMergeTagNode],
  blocks: {
    test_mergeTag: {
      kind: "inline",
      attributes: { test_key: { kind: "pattern", pattern: "[a-z_]+" } },
    },
  },
};

/** Блок-контейнер — как Обёртка: Блоки внутри со своей Ручкой Блока. */
export const testBoxNode = Node.create({
  name: "test_box",
  content: "block+",
  isolating: true,
});

export const testBoxTool: CustomTool = {
  name: "test_box",
  engine: [testBoxNode],
  blocks: { test_box: { kind: "block", container: true } },
  // Пункт «Добавить»: пустая коробка с абзацем; подпись — по локали, сочетание — поле записи.
  insertItems: [
    {
      section: "insert",
      // Подпись — функция от контекста: локаль `UiProvider` видна в самой подписи.
      label: ({ locale }) => `Box ${locale}`,
      icon: WrapperIcon,
      aliases: ["crate", "bin"],
      shortcut: ["mod", "alt", "B"],
      run: (chain) => chain.insertContent({ type: "test_box", content: [{ type: "paragraph" }] }),
    },
  ],
  // Действие над Блоком: показывается у коробки и у Блока прямо в ней.
  blockActions: [
    {
      label: "Unbox",
      icon: WrapperIcon,
      blocks: ["test_box"],
      shortcut: ["mod", "alt", "U"],
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            // Позиция — Блок Ручки: сама коробка или Блок в ней; снимается коробка.
            const $pos = tr.doc.resolve(pos);
            const depth = $pos.parent.type.name === "test_box" ? $pos.depth : -1;
            const from = depth < 0 ? pos : $pos.before(depth);
            const box = tr.doc.nodeAt(from);
            if (box?.type.name === "test_box")
              tr.replaceWith(from, from + box.nodeSize, box.content);
            return true;
          })
          .run(),
    },
  ],
};

/**
 * Блок с атрибутами трёх видов значения и без Признаков: размер — списком,
 * код — шаблоном, адрес — по политике протоколов кита. Свои атрибуты Node не
 * объявляет: их добавляет кит по правилам.
 */
export const testCardNode = Node.create({
  name: "test_card",
  content: "inline*",
});

export const testCardTool: CustomTool = {
  name: "test_card",
  engine: [testCardNode],
  blocks: {
    test_card: {
      kind: "block",
      attributes: {
        test_size: { kind: "list", values: ["s", "m", "l"] },
        test_code: { kind: "pattern", pattern: "[0-9]{3}" },
        test_href: { kind: "url" },
      },
    },
  },
  // Пункт «Превратить в»: текущий Блок становится карточкой; подпись — строкой.
  insertItems: [
    {
      section: "turnInto",
      label: "Card",
      icon: ImageIcon,
      aliases: ["tile"],
      shortcut: ["mod", "alt", "K"],
      run: (chain) => chain.setNode("test_card"),
    },
  ],
  // Действие с предикатом видимости: «Enlarge» есть, пока размер не `l`.
  blockActions: [
    {
      label: "Enlarge",
      icon: ImageIcon,
      blocks: ["test_card"],
      isVisible: (editor, pos) => editor.state.doc.nodeAt(pos)?.attrs.test_size !== "l",
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const card = tr.doc.nodeAt(pos);
            if (card) tr.setNodeMarkup(pos, undefined, { ...card.attrs, test_size: "l" });
            return true;
          })
          .run(),
    },
  ],
};

/** Своя Метка — заметка на полях с автором. */
export const testNoteMark = Mark.create({
  name: "test_note",
  addAttributes: () => ({ test_author: { default: null } }),
});

export const testNoteTool: CustomTool = {
  name: "test_note",
  engine: [testNoteMark],
  marks: {
    test_note: { attributes: { test_author: { kind: "pattern", pattern: "[A-Za-z ]+" } } },
  },
};

/**
 * Инструмент без Блока: фильтр вставки и перехват файла. Только Extensions
 * (`Extension`), ни одного Блока и Метки — поведение, а не разметка.
 *
 * Фильтр `transformPastedHTML` дописывает к вставке чужую разметку
 * (`<script>`, `onclick`): Схема всё равно разберёт её по своим правилам.
 * `handlePaste` и `handleDrop` забирают PDF целиком и отдают его в `onFile`;
 * остальные файлы не трогают — они идут дальше, к киту.
 */
export interface TestPasteFilterOptions {
  /** Файл, который Инструмент забрал: вставкой (`paste`) или перетаскиванием (`drop`). */
  onFile?: (file: File, via: "paste" | "drop") => void;
  /** Порядок обращений к обработчикам Инструмента — для проверки очерёдности. */
  trace?: string[];
}

const isPdf = (file: File) => file.type === "application/pdf";

export function testPasteFilterTool(options: TestPasteFilterOptions = {}): CustomTool {
  const filter = Extension.create({
    name: "test_pasteFilter",
    addProseMirrorPlugins: () => [
      new Plugin({
        key: new PluginKey("test_pasteFilter"),
        props: {
          transformPastedHTML(html) {
            options.trace?.push("transformPastedHTML");
            return `${html}<script>alert(1)</script><p onclick="steal()">added</p>`;
          },
          handlePaste(view, event) {
            options.trace?.push("handlePaste");
            // `!!текст` — вставка своей транзакцией, без метки `paste`.
            const own = /^!!(.+)$/.exec(event.clipboardData?.getData("text/plain") ?? "")?.[1];
            if (own !== undefined) {
              view.dispatch(view.state.tr.insertText(own));
              event.preventDefault();
              return true;
            }
            const pdf = Array.from(event.clipboardData?.files ?? []).find(isPdf);
            if (!pdf) return false;
            options.onFile?.(pdf, "paste");
            event.preventDefault();
            return true;
          },
          handleDrop(_view, event) {
            options.trace?.push("handleDrop");
            const pdf = Array.from(event.dataTransfer?.files ?? []).find(isPdf);
            if (!pdf) return false;
            options.onFile?.(pdf, "drop");
            event.preventDefault();
            return true;
          },
        },
      }),
    ],
  });
  return { name: "test_pasteFilter", engine: [filter] };
}

/**
 * Блок-атом без Текста атома — видео: `renderText` нет, в Документе он «пустой
 * текст, но содержимое» (OLDSUI-109). Тот же узел вставляется по ссылке
 * (`testVideoLinkTool`, OLDSUI-108): адрес видео, вставленный текстом, становится
 * Блоком `test_video` раньше встроенной вставки и Markdown. Вставка — своей
 * транзакцией без метки `paste`: предел символов её не режет, а отклоняет целиком.
 */
export const testVideoNode = Node.create({
  name: "test_video",
  atom: true,
  selectable: true,
  addAttributes: () => ({ test_id: { default: null } }),
});

const VIDEO_LINK = /https:\/\/video\.example\.com\/watch\/([a-z0-9]+)/;

export const testVideoLinkTool: CustomTool = {
  name: "test_video",
  engine: [
    testVideoNode,
    Extension.create({
      name: "test_videoPaste",
      addProseMirrorPlugins: () => [
        new Plugin({
          key: new PluginKey("test_videoPaste"),
          props: {
            handlePaste(view, event) {
              const id = VIDEO_LINK.exec(event.clipboardData?.getData("text/plain") ?? "")?.[1];
              if (!id) return false;
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes["test_video"]!.create({ test_id: id })
                )
              );
              event.preventDefault();
              return true;
            },
          },
        }),
      ],
    }),
  ],
  blocks: {
    test_video: {
      kind: "block",
      attributes: { test_id: { kind: "pattern", pattern: "[a-z0-9]+" } },
    },
  },
};

export const testVideoTool: CustomTool = {
  name: "test_video",
  engine: [testVideoNode],
  blocks: {
    test_video: {
      kind: "block",
      attributes: { test_id: { kind: "pattern", pattern: "[a-z0-9]+" } },
    },
  },
};

/** Блок-атом с содержимым и без `renderText` — его Текст атома — текст детей. */
export const testEmbedNode = Node.create({
  name: "test_embed",
  atom: true,
  content: "inline*",
  selectable: true,
});

export const testEmbedTool: CustomTool = {
  name: "test_embed",
  engine: [testEmbedNode],
  blocks: { test_embed: { kind: "block" } },
};

/**
 * Блок со своими правилами Markdown (OLDSUI-104): строка `::: текст` —
 * токенайзер Tiptap, разбор и `renderMarkdown` в Extensions, как их
 * написал бы потребитель. Без них кит выгрузил бы Блок его содержимым.
 */
export const testAsideNode = Node.create({
  name: "test_aside",
  content: "inline*",
  markdownTokenizer: {
    name: "test_aside",
    level: "block",
    start: (src: string) => src.indexOf(":::"),
    tokenize: (src, _tokens, lexer) => {
      const match = /^::: ([^\n]*)(?:\n|$)/.exec(src);
      return match
        ? {
            type: "test_aside",
            raw: match[0],
            text: match[1],
            tokens: lexer.inlineTokens(match[1]!),
          }
        : undefined;
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode("test_aside", {}, helpers.parseInline(token.tokens ?? [])),
  renderMarkdown: (node, helpers) => `::: ${helpers.renderChildren(node.content ?? [])}`,
});

export const testAsideTool: CustomTool = {
  name: "test_aside",
  engine: [testAsideNode],
  blocks: { test_aside: { kind: "block" } },
};

/**
 * Блок с Островом в Просмотре (OLDSUI-114): плеер из адреса и подписи. Остров
 * рисует кнопку «Play …» и считает нажатия своим состоянием — по нему видно,
 * перемонтировал ли его Просмотр. Вызовы пишутся в `testPlayerCalls`: тест
 * проверяет, что Остров не работал у Документа без такого Блока.
 *
 * В настоящем приложении Остров — компонент из модуля с `"use client"`; в
 * jsdom директива ничего не меняет, и компонент лежит здесь же.
 */
export const testPlayerCalls: CustomIslandProps[] = [];

export function TestPlayerIsland(props: CustomIslandProps) {
  testPlayerCalls.push(props);
  const [plays, setPlays] = useState(0);
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "player",
      "data-src": props.attributes.test_src ?? "",
      "data-keys": Object.keys(props.attributes).sort().join(","),
      onClick: () => setPlays(plays + 1),
    },
    `Play ${props.text} ${plays}`
  );
}

export const testPlayerNode = Node.create({
  name: "test_player",
  content: "inline*",
});

export const testPlayerTool: CustomTool = {
  name: "test_player",
  engine: [testPlayerNode],
  blocks: {
    test_player: {
      kind: "block",
      attributes: {
        test_src: { kind: "url" },
        test_kind: { kind: "list", values: ["audio", "video"] },
      },
      island: TestPlayerIsland,
    },
  },
};

/** Строчный Блок с Островом — Остров встаёт и в `span`. */
export const testBadgeNode = Node.create({
  name: "test_badge",
  atom: true,
  inline: true,
  group: "inline",
  renderText: () => "badge",
});

export const testBadgeTool: CustomTool = {
  name: "test_badge",
  engine: [testBadgeNode],
  blocks: {
    test_badge: {
      kind: "inline",
      island: (props) => createElement("em", { "data-testid": "badge" }, `Badge ${props.block}`),
    },
  },
};

/** Все тестовые свои Инструменты — в порядке `tools`. */
export const TEST_TOOLS: readonly CustomTool[] = [
  testMergeTagTool,
  testBoxTool,
  testCardTool,
  testNoteTool,
  testVideoTool,
  testEmbedTool,
];

/**
 * Инструменты с кнопками (OLDSUI-105) — не в `TEST_TOOLS`: кнопка меняет
 * Панель, и тесты, которые её не ждут, остаются на прежней. Тест берёт нужный.
 */

/** Каретка стоит в тексте: вставлять есть куда. */
const inText = (editor: Editor) => editor.state.selection.$to.parent.inlineContent;

/**
 * Кнопка-действие: вставляет «★» в каретку. Сочетание — поле кнопки, и клавишу
 * вешает кит; Extensions при этом вешают свою клавишу (`Mod-Shift-K`),
 * которой в справочнике быть не должно.
 */
export const testStampTool: CustomTool = {
  name: "test_stamp",
  engine: [
    Extension.create({
      name: "test_stampKeys",
      addKeyboardShortcuts: () => ({ "Mod-Shift-K": () => true }),
    }),
  ],
  buttons: [
    {
      id: "stamp",
      label: "Stamp",
      icon: SparkleIcon,
      can: inText,
      run: (editor) => void editor.chain().insertContent("★").run(),
      shortcut: ["mod", "shift", "Y"],
    },
  ],
};

/** Метка-переключатель: `isActive` даёт `aria-pressed`, `selectionMenu` — место в Меню выделения. */
export const testPinMark = Mark.create({ name: "test_pin" });

export const testPinTool: CustomTool = {
  name: "test_pin",
  engine: [testPinMark],
  marks: { test_pin: {} },
  buttons: [
    {
      id: "pin",
      label: "Pin",
      icon: PinIcon,
      can: (editor) => editor.can().toggleMark("test_pin"),
      isActive: (editor) => editor.isActive("test_pin"),
      run: (editor) => void editor.chain().focus().toggleMark("test_pin").run(),
      selectionMenu: true,
      shortcut: ["mod", "alt", "P"],
    },
  ],
};

/**
 * Две кнопки в порядке описания: «Count» видна только над непустым выделением,
 * «Lock» никогда не доступна (`can` — нет).
 */
export const testContextTool: CustomTool = {
  name: "test_context",
  engine: [],
  buttons: [
    {
      id: "count",
      label: "Count",
      icon: TagIcon,
      can: () => true,
      isVisible: (editor) => !editor.state.selection.empty,
      run: (editor) => void editor.chain().insertContent("#").run(),
    },
    { id: "lock", label: "Lock", icon: PinIcon, can: () => false, run: () => {} },
  ],
};

/** Подпись функцией от контекста: смена локали `UiProvider` перерисовывает кнопку. */
export const testLocaleTool: CustomTool = {
  name: "test_locale",
  engine: [],
  buttons: [
    {
      id: "greet",
      label: ({ locale }) => (locale.startsWith("de") ? "Stempel" : "Stamp"),
      icon: SparkleIcon,
      can: inText,
      run: (editor) => void editor.chain().insertContent("★").run(),
      shortcut: ["mod", "shift", "G"],
    },
  ],
};

/**
 * Кнопка с поповером: содержимое — функция от `editor` и `close`. Пункт
 * «Choose Alpha» вставляет текст и закрывает поповер, «Dismiss» только закрывает.
 */
export const testPickerTool: CustomTool = {
  name: "test_picker",
  engine: [],
  buttons: [
    {
      id: "picker",
      label: "Picker",
      icon: TagIcon,
      can: inText,
      shortcut: ["mod", "shift", "J"],
      popover: ({ editor, close }) =>
        createElement(
          "div",
          null,
          createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                editor.chain().insertContent("Alpha").run();
                close();
              },
            },
            "Choose Alpha"
          ),
          createElement("button", { type: "button", onClick: close }, "Dismiss")
        ),
    },
  ],
};

/** Содержимое поповера пункта: «Choose Alpha» вставляет текст у каретки и закрывает. */
const choiceOf: NonNullable<NonNullable<CustomTool["insertItems"]>[number]["popover"]> = ({
  editor,
  close,
}) =>
  createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        editor.chain().insertContent("Alpha").run();
        close();
      },
    },
    "Choose Alpha"
  );

/**
 * Пункты вставки и Действие над Блоком с поповером (история 39): «Ask» —
 * «Добавить», «Reshape» — «Превратить в», оба вставляют «Alpha» у каретки.
 * «Inspect» у абзаца показывает позицию своего Блока и пишет «Beta» в его начало.
 */
export const testAskTool: CustomTool = {
  name: "test_ask",
  engine: [],
  insertItems: [
    {
      section: "insert",
      label: "Ask",
      icon: TagIcon,
      aliases: ["prompt"],
      shortcut: ["mod", "alt", "Q"],
      popover: choiceOf,
    },
    { section: "turnInto", label: "Reshape", icon: TagIcon, popover: choiceOf },
  ],
  blockActions: [
    {
      label: "Inspect",
      icon: TagIcon,
      blocks: ["paragraph"],
      shortcut: ["mod", "alt", "I"],
      popover: ({ editor, close, pos }) =>
        createElement(
          "div",
          null,
          createElement("output", null, `Block at ${pos}`),
          createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                editor
                  .chain()
                  .insertContentAt(pos + 1, "Beta")
                  .run();
                close();
              },
            },
            "Prefix Beta"
          )
        ),
    },
  ],
};

/**
 * Инструмент с загрузчиком (OLDSUI-110): Extensions приходят промисом,
 * который решает сам тест. Фабрика, а не константа: промис кэшируется на
 * функции загрузчика, и каждому тесту нужен свой. `calls` — сколько раз кит
 * позвал загрузчик; `resolve` и `reject` решают последний вызов. `engine`
 * подменяет то, что загрузчик отдаст, — например, Extensions мимо правил Схемы.
 */
export function testLazyTool(name: `test_${string}` = "test_lazy", engine?: Extensions) {
  const node = Node.create({ name, content: "inline*" });
  let settle = { resolve: () => {}, reject: () => {} };
  const loader = Object.assign(
    (): Promise<Extensions> => {
      loader.calls += 1;
      return new Promise((resolve, reject) => {
        settle = {
          resolve: () => resolve(engine ?? [node]),
          reject: () => reject(new Error("chunk failed")),
        };
      });
    },
    { calls: 0 }
  );
  const tool: CustomTool = { name, engine: loader, blocks: { [name]: { kind: "block" } } };
  return { tool, loader, resolve: () => settle.resolve(), reject: () => settle.reject() };
}

/**
 * Карточки у текста (OLDSUI-113) — не в `TEST_TOOLS`: Карточка открывается
 * кареткой в диапазоне, и тесты, которые её не ждут, не должны её видеть.
 *
 * Метка с Карточкой — замечание: `markRange` — готовый помощник кита для Метки.
 * Тело Карточки показывает диапазон (он едет за правкой) и две кнопки: «Reply»
 * — для фокуса и Tab, «Close» — `close` прячет Карточку до выхода каретки.
 * Подпись — функция от локали, чтобы доступное имя рамки менялось с языком.
 */
export const testRemarkMark = Mark.create({ name: "test_remark" });

const textCardBody =
  (name: string): NonNullable<CustomTool["textCards"]>[number]["render"] =>
  ({ editor, range, close }) =>
    createElement(
      "div",
      null,
      createElement("p", null, `${name} ${range.from}-${range.to}`),
      createElement("button", { type: "button" }, "Reply"),
      createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            close();
            editor.commands.focus();
          },
        },
        "Close"
      )
    );

export const testRemarkTool: CustomTool = {
  name: "test_remark",
  engine: [testRemarkMark],
  marks: { test_remark: {} },
  textCards: [
    {
      label: ({ locale }) => (locale.startsWith("de") ? "Anmerkung" : "Remark"),
      rangeAt: markRange("test_remark"),
      render: textCardBody("Remark"),
    },
  ],
};

/** Вторая Метка с Карточкой: диапазоны двух Инструментов перекрываются и совпадают. */
export const testTopicMark = Mark.create({ name: "test_topic" });

export const testTopicTool: CustomTool = {
  name: "test_topic",
  engine: [testTopicMark],
  marks: { test_topic: {} },
  textCards: [{ label: "Topic", rangeAt: markRange("test_topic"), render: textCardBody("Topic") }],
};
