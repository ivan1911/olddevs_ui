"use client";

import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { DividerIcon, QuoteIcon } from "../../icons.js";
import { turnIntoTypes } from "../core/blockTypes.js";
import type { InsertItem } from "../core/insertItems.js";
import { INSERT_MENU_TOOL } from "../core/insertMenuTool.js";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../core/shortcuts.js";
import { CODE_BLOCK_TOOL } from "./code/codeBlockTool.js";
import { EMOJI_TOOL } from "./emoji/emojiTool.js";
import { HEADING1_TOOL, HEADING_TOOL } from "./heading/headingTool.js";
import { IMAGE_TOOL } from "./image/imageTool.js";
import { LAYOUT_TOOL } from "./layout/layoutTool.js";
import { LINK_TOOL } from "./link/linkTool.js";
import { devError } from "../../lib/dev-warn.js";
import type { ToolEntry } from "../core/customTool.js";
import { describeCustomTool, describeDefinition } from "../core/customToolEngine.js";
import { toolList, type ToolDescriptor, type ToolList } from "../core/toolDescriptor.js";
import { isConfiguredTool, mergeOptions, type ConfiguredTool } from "../core/toolOptions.js";
import { SEARCH_TOOL } from "./search/searchTool.js";
import { TABLE_TOOL } from "./table/tableTool.js";
import { TOC_TOOL } from "./toc/tocTool.js";
import { resolveTools, TOOLS, type RichTextEditorPreset, type Tool } from "../core/tools.js";
import { WRAPPER_TOOL } from "./wrapper/wrapperTool.js";

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
 * реестрах. `layout` и виджеты Панели переезжают постепенно, и выпуск
 * их не ждёт.
 */
export const BUILTIN_TOOLS: Partial<Record<Tool, ToolDescriptor>> = {
  search: SEARCH_TOOL,
  // Оглавление несёт только Опции: полоса и список рисуются в `RichTextEditor`.
  toc: TOC_TOOL,
  layout: LAYOUT_TOOL,
  wrapper: WRAPPER_TOOL,
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
  heading: HEADING_TOOL,
  heading1: HEADING1_TOOL,
  link: LINK_TOOL,
  image: IMAGE_TOOL,
  emoji: EMOJI_TOOL,
  insertMenu: INSERT_MENU_TOOL,
  /*
    Своего расширения у «Очистить форматирование» нет: клавишу `⌘\` держит
    `BlockCommands` ядра (он спрашивает `has("clearFormatting")`), а кнопка в
    «…» — виджет кита. В описании — только строка справочника.
  */
  clearFormatting: {
    name: "clearFormatting",
    shortcuts: [
      {
        id: "clearFormatting",
        group: "clear",
        tool: "clearFormatting",
        keys: SHORTCUT_KEYS.clearFormatting,
        label: (m) => m.clearFormatting,
      },
    ],
  },
  /*
    HTML-режим — виджет «HTML» Панели и режим `RichTextEditor`, показ по
    `has("source")`. Ни Схемы, ни записей у Инструмента нет: описание
    нужно, чтобы он не стоял заглушкой `legacy`.
  */
  source: { name: "source" },
  /*
    Ленивые встроенные (ADR-0058, п. 11.1): их нет в `basic`, а
    Часть для движка тяжелее 10 кБ gzip, поэтому она грузится загрузчиком
    (`load`) — тем же, что у своего Инструмента.
  */
  codeBlock: CODE_BLOCK_TOOL,
  table: TABLE_TOOL,
};

/**
 * Опции Инструмента для Редактора: умолчания описания, поверх них — те, что
 * передал `tool()`. Значение, не прошедшее проверку, и опция, которой у
 * Инструмента нет (проверки для неё тоже нет), отбрасываются, в разработке —
 * одним `console.error` на Инструмент: потребитель на JS обходит типы карты, а
 * поле от этого не падает.
 */
function resolveOptions(
  descriptor: ToolDescriptor,
  configured: ConfiguredTool | undefined
): ToolDescriptor {
  const { defaults, checks } = descriptor;
  const given = Object.entries(configured?.options ?? {}).filter(
    ([, value]) => value !== undefined
  );
  const valid = given.filter(([key, value]) => checks?.[key]?.(value));
  if (valid.length < given.length) {
    devError(
      `RichTextEditor: tool "${descriptor.name}": ignored invalid options: ` +
        given
          .filter((entry) => !valid.includes(entry))
          .map(([key]) => key)
          .join(", ")
    );
  }
  return defaults
    ? { ...descriptor, options: mergeOptions(defaults, Object.fromEntries(valid)) }
    : descriptor;
}

/**
 * Развернуть `tools` (или `preset`) в один список описаний.
 *
 * Имена — те же, что у `resolveTools`: точный `tools` или пресет, неизвестная
 * строка отбрасывается молча. Запись `tool()` включает Инструмент так же, как
 * его имя, а если в `tools` есть и имя (из пресета), и запись, побеждает
 * Настроенный Инструмент; две записи с одним именем — ошибка набора
 * (`ToolList.error`). Порядок встроенных — порядок кита (`TOOLS`), а не
 * `tools`: место встроенного на поверхности решает кит, и Настроенный стоит
 * там же, где голое имя. Свои Инструменты (описания в `tools`) идут следом, в
 * порядке `tools` (ADR-0058, п. 5.3); набор имён (`Set`) — только имена кита.
 *
 * Опции Инструментов читаются здесь, один раз, вместе с набором.
 */
export function expandTools(
  preset: RichTextEditorPreset,
  tools: readonly ToolEntry[] | undefined
): ToolList {
  // Настроенные встроенные: запись с определением настраивает свой Инструмент, она ниже.
  const configured = (tools ?? []).filter(
    (entry): entry is ConfiguredTool => isConfiguredTool(entry) && !entry.definition
  );
  const twice = configured.find((entry, index) =>
    configured.some((e, i) => i < index && e.name === entry.name)
  );
  const names = resolveTools(
    preset,
    tools && [
      ...tools.filter((entry) => typeof entry === "string"),
      ...configured.map((entry) => entry.name),
    ]
  );
  const builtin = TOOLS.filter((name) => names.has(name)).map((name) =>
    resolveOptions(
      BUILTIN_TOOLS[name] ?? { name, legacy: true },
      configured.find((entry) => entry.name === name)
    )
  );
  // Свои: определение (с `tool()` и без) и обычное описание; уникальность имени проверяет набор.
  const custom = (tools ?? []).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    if (isConfiguredTool(entry)) {
      return entry.definition ? describeDefinition(entry.definition, entry.options) : [];
    }
    return "defined" in entry ? describeDefinition(entry) : describeCustomTool(entry);
  });
  return toolList(
    builtin.map((descriptor) => descriptor.name as Tool),
    [...builtin, ...custom],
    twice && `tool "${twice.name}": two tool() entries share this name`
  );
}
