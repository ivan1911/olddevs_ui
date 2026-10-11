"use client";

import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { DividerIcon, QuoteIcon, UnwrapIcon } from "../../icons.js";
import { turnIntoTypes } from "../core/blockTypes.js";
import type { InsertItem } from "../core/insertItems.js";
import type { ShortcutCommand } from "../core/shortcuts.js";
import { CODE_BLOCK_TOOL } from "./code/codeBlockTool.js";
import { EMOJI_TOOL } from "./emoji/emojiTool.js";
import { LINK_TOOL } from "./link/linkTool.js";
import type { CustomTool, ToolEntry } from "../core/customTool.js";
import { describeCustomTool } from "../core/customToolEngine.js";
import { toolList, type ToolDescriptor, type ToolList } from "../core/toolDescriptor.js";
import { SEARCH_TOOL } from "./search/searchTool.js";
import { TABLE_TOOL } from "./table/tableTool.js";
import { resolveTools, TOOLS, type RichTextEditorPreset, type Tool } from "../core/tools.js";
import { unwrapWrapperAt, WRAPPER_NODE } from "./wrapper/wrapper.js";

/** Сочетание цитаты: одна запись на справочник, Меню вставки и «¶». */
const BLOCKQUOTE_SHORTCUT: ShortcutCommand = {
  id: "blockquote",
  group: "blockType",
  tool: "blockquote",
  keys: ["mod", "shift", "B"],
  label: (m) => m.blockquote,
};

const BLOCKQUOTE_ITEMS: readonly InsertItem[] = [
  {
    id: "blockquote",
    section: "turnInto",
    label: (m) => m.blockquote,
    icon: QuoteIcon,
    aliases: [">"],
    markdown: ">",
    keys: BLOCKQUOTE_SHORTCUT.keys,
    run: (chain) => chain.setBlockquote(),
  },
];

/**
 * Описания встроенных Инструментов, переехавших со старых реестров
 * (ADR-0058, п. 10; тип — `toolDescriptor.ts`).
 *
 * Сюда Инструмент переезжает целиком: его записи удаляются из старых
 * реестров, и с этой минуты он берётся только из описания. Кого здесь нет, тот
 * стоит в развёрнутом списке заглушкой `legacy` и по-прежнему живёт в старых
 * реестрах. `image`, `layout` и виджеты Панели переезжают постепенно, и выпуск
 * их не ждёт.
 */
export const BUILTIN_TOOLS: Partial<Record<Tool, ToolDescriptor>> = {
  search: SEARCH_TOOL,
  /*
    Обёртка переехала только Действием над Блоком, поэтому
    `legacy`: её узел, вставка и сочетания остаются в старых реестрах. «Тон ›» —
    меню-виджет, своего Инструмента у него нет, и он собирается в Ручке по-старому.
  */
  wrapper: {
    name: "wrapper",
    legacy: true,
    blockActions: [
      {
        id: "unwrap",
        label: (messages) => messages.unwrap,
        icon: UnwrapIcon,
        blocks: [WRAPPER_NODE],
        // Одна правка: Блоки встают на место Обёртки, отмена — одна.
        run: (editor, pos) =>
          void editor
            .chain()
            .focus()
            .command(({ tr }) => unwrapWrapperAt(tr, pos))
            .run(),
      },
    ],
  },
  /*
    Проверочный набор: Инструмент с пунктом вставки и Инструмент
    с «Превратить в». Поля `insertItems` и `engine` совпадают с будущим
    публичным описанием, чтобы его форма проверялась кодом кита.
  */
  horizontalRule: {
    name: "horizontalRule",
    engine: () => [HorizontalRule],
    insertItems: [
      {
        id: "horizontalRule",
        section: "insert",
        label: (m) => m.horizontalRule,
        icon: DividerIcon,
        aliases: ["hr", "---"],
        markdown: "---",
        run: (chain) => chain.setHorizontalRule(),
      },
    ],
  },
  blockquote: {
    name: "blockquote",
    engine: () => [Blockquote],
    insertItems: BLOCKQUOTE_ITEMS,
    // «¶» — тот же пункт «Превратить в»: те же слова, иконка и сочетание.
    blockTypes: turnIntoTypes("blockquote", BLOCKQUOTE_ITEMS),
    // Клавишу вешает расширение Tiptap; строка справочника — подпись к ней.
    shortcuts: [BLOCKQUOTE_SHORTCUT],
  },
  link: LINK_TOOL,
  emoji: EMOJI_TOOL,
  /*
    Ленивые встроенные (ADR-0058, п. 11.1): их нет в `basic`, а
    Часть для движка тяжелее 10 кБ gzip, поэтому она грузится загрузчиком
    (`load`) — тем же, что у своего Инструмента.
  */
  codeBlock: CODE_BLOCK_TOOL,
  table: TABLE_TOOL,
};

/**
 * Развернуть `tools` (или `preset`) в один список описаний.
 *
 * Имена — те же, что у `resolveTools`: точный `tools` или пресет, неизвестная
 * строка отбрасывается молча. Порядок встроенных — порядок кита (`TOOLS`), а
 * не `tools`: место встроенного на поверхности решает кит. Свои Инструменты
 * (описания в `tools`) идут следом, в порядке `tools` (ADR-0058, п. 5.3);
 * набор имён (`Set`) — только имена кита.
 */
export function expandTools(
  preset: RichTextEditorPreset,
  tools: readonly ToolEntry[] | undefined
): ToolList {
  const names = resolveTools(
    preset,
    tools?.filter((tool): tool is Tool => typeof tool === "string")
  );
  const builtin = TOOLS.filter((name) => names.has(name)).map(
    (name): ToolDescriptor => BUILTIN_TOOLS[name] ?? { name, legacy: true }
  );
  const custom = (tools ?? [])
    .filter((tool): tool is CustomTool => typeof tool === "object" && tool !== null)
    .map(describeCustomTool);
  return toolList(
    builtin.map((descriptor) => descriptor.name as Tool),
    [...builtin, ...custom]
  );
}
