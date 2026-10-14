"use client";

import {
  flattenExtensions,
  getExtensionField,
  getSchema,
  mergeAttributes,
  type AnyExtension,
  type Attribute,
  type Extensions,
  type Node,
} from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import {
  isAllowedAttributeValue,
  isTriggerChar,
  type CustomAttribute,
  type CustomBlock,
  type CustomMark,
  type CustomTool,
  type CustomToolButton,
} from "./customTool.js";
import { devError } from "../../lib/dev-warn.js";
import type { UiMessages } from "../../i18n/messages.js";
import { turnIntoTypes } from "./blockTypes.js";
import type { InsertItem } from "./insertItems.js";
import {
  toolLabel,
  type BlockAction,
  type KitToolButton,
  type TextCardRecord,
  type ToolDescriptor,
  type ToolLabel,
  type ToolList,
} from "./toolDescriptor.js";
import { resolveDefinition, type ToolDefinition } from "./toolDefinition.js";
import { markdownFallback } from "./customMarkdown.js";
import { CUSTOM_ATTRIBUTE_NAME, CUSTOM_NAME, customElement } from "./schema.js";
import { loaded } from "./toolLoader.js";

/*
  Свой Инструмент в движке (ADR-0058, разделы 1 и 2): из
  публичного описания — внутреннее, и проверка набора при сборке.

  ПРАВИЛА СХЕМЫ — ЕДИНСТВЕННЫЙ ИСТОЧНИК HTML. Node и Mark Части для движка кит
  дописывает сам: группу и строчность — по виду Блока, разбор HTML — только
  `div|span[data-block="<имя>"]` и `span[data-mark="<имя>"]`, свои атрибуты —
  `data-<имя>` со значением по виду из правил, Признаки Блока — в spec узла.
  Своё правило разбора чужого Блока поэтому не займёт тег кита, а значение вне
  правил не войдёт в Документ ни из `value`, ни из вставки: проверяет код кита,
  и ослабить проверку Частью для движка нельзя. Поведение — содержимое,
  `atom`, React-вид, `renderText`, команды — остаётся за потребителем.
*/

type Rule = CustomBlock | CustomMark;

const blocksOf = (tool: CustomTool): Readonly<Record<string, CustomBlock>> => tool.blocks ?? {};
const marksOf = (tool: CustomTool): Readonly<Record<string, CustomMark>> => tool.marks ?? {};
const attributesOf = (rule: Rule): Readonly<Record<string, CustomAttribute>> =>
  rule.attributes ?? {};

/** Значение атрибута — по правилу или `null` (умолчание узла). */
function allowed(rule: CustomAttribute, value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return isAllowedAttributeValue(rule, text) ? text : null;
}

/** Node или Mark Части для движка, дописанный по своим правилам Схемы. */
function bindRules(extension: AnyExtension, tool: CustomTool): AnyExtension {
  const { name } = extension;
  const block = extension.type === "node" ? blocksOf(tool)[name] : undefined;
  const rule: Rule | undefined =
    block ?? (extension.type === "mark" ? marksOf(tool)[name] : undefined);
  if (!rule) return extension;
  const { tag, marker } = customElement(block ? block.kind : "mark");
  const selector = `${tag}[${marker}="${name}"]`;
  const own = attributesOf(rule);
  const config = {
    ...markdownFallback(extension, tool.name),
    parseHTML: () => [{ tag: selector }],
    // Свой `renderHTML` остаётся у Части для движка (текст внутри атома);
    // соглашение с ним сверяет `customToolsError`.
    ...(getExtensionField(extension, "renderHTML") === undefined && {
      renderHTML: ({ node, HTMLAttributes }: { node?: PmNode; HTMLAttributes: object }) =>
        node?.isLeaf
          ? [tag, mergeAttributes({ [marker]: name }, HTMLAttributes)]
          : [tag, mergeAttributes({ [marker]: name }, HTMLAttributes), 0],
    }),
    addAttributes(this: { parent?: (() => Record<string, Attribute>) | null }) {
      const parent = this.parent?.() ?? {};
      const result: Record<string, Partial<Attribute>> = { ...parent };
      for (const [key, value] of Object.entries(own)) {
        result[key] = {
          ...parent[key],
          default: parent[key]?.default ?? null,
          parseHTML: (element) => allowed(value, element.getAttribute(`data-${key}`)),
          renderHTML: (attributes) => {
            const text = allowed(value, attributes[key]);
            return text === null ? {} : { [`data-${key}`]: text };
          },
        };
      }
      return result;
    },
    ...(block && {
      // Верхний уровень — вне группы `block`: его называет сам Документ (`document.ts`).
      group: block.place === "top" ? "" : block.kind,
      inline: block.kind === "inline",
      extendNodeSchema(
        this: { parent?: ((extension: AnyExtension) => object) | null },
        target: AnyExtension
      ) {
        return {
          ...this.parent?.(target),
          ...(target.name === name && {
            blockContainer: block.container === true,
            turnInto: block.turnInto === true,
            plainAtom: block.plainAtom === true,
          }),
        };
      },
    }),
  };
  return (extension as Node).extend(config as never);
}

/**
 * Кнопка своего Инструмента — во внутреннюю форму. Id получает имя Инструмента
 * (`acme_stamp:stamp`): ключи флагов Панели и справочника общие с кнопками кита,
 * и свой id с чужим не столкнётся. Пустая подпись — `console.error` и имя
 * Инструмента (ADR-0058, п. 6.5); подпись зовётся при каждой отрисовке, поэтому
 * ошибка живёт в обёртке, а не в проверке набора: функция от локали бывает
 * пустой только в одной из них.
 */
function describeButton(tool: CustomTool, button: CustomToolButton): KitToolButton {
  return {
    ...button,
    id: `${tool.name}:${button.id}`,
    label: (context) => {
      const text = toolLabel(button.label, context);
      if (text.trim() !== "") return text;
      devError(
        `RichTextEditor: custom tool "${tool.name}": button "${button.id}" has an empty label`
      );
      return tool.name;
    },
  } as KitToolButton;
}

/**
 * Подпись записи для меню: строка или функция от `{ locale, messages }`.
 * Пустая подпись — `console.error` в разработке и имя Инструмента вместо неё
 * (ADR-0058, п. 6.5): забытый перевод не роняет поле.
 */
function labelOf(tool: CustomTool, entry: string, label: ToolLabel) {
  return (messages: UiMessages["editor"], locale: string): string => {
    const text = toolLabel(label, { locale, messages });
    if (text.trim() !== "") return text;
    devError(`RichTextEditor: custom tool "${tool.name}": ${entry} has an empty label`);
    return tool.name;
  };
}

/** Записи списка. Не список или не объект — не запись: набор отвергнет `customToolsError`. */
const records = <T extends object>(list: readonly T[] | undefined): readonly T[] =>
  Array.isArray(list) ? list.filter((item) => typeof item === "object" && item !== null) : [];

/**
 * Пункты вставки и Действия над Блоком в форме внутренних записей. Id — имя
 * Инструмента и номер записи через дефис: у имён дефиса нет, и пункт не
 * совпадёт ни с кит-пунктом, ни с чужим. «Превратить в» своего Инструмента
 * стоит и в «Формат ›» Ручки Блока (она читает «¶»): те же слова и иконка.
 */
function uiRecords(tool: CustomTool) {
  const insertItems = records(tool.insertItems).map((item, index): InsertItem => ({
    id: `${tool.name}-insert${index}`,
    section: item.section,
    label: labelOf(tool, `insert item ${index}`, item.label),
    icon: item.icon,
    aliases: item.aliases,
    keys: item.shortcut,
    shortcut: item.shortcut,
    // Пункт с поповером `run` не зовёт: `applyInsertItem` открывает поповер.
    run: item.run ?? ((chain) => chain),
    popover: item.popover,
  }));
  const blockTypes = turnIntoTypes(tool.name, insertItems);
  const blockActions = records(tool.blockActions).map((action, index): BlockAction => {
    const id = `${tool.name}-action${index}`;
    return {
      id,
      label: labelOf(tool, `block action ${index}`, action.label),
      icon: action.icon,
      blocks: action.blocks,
      shortcut: action.shortcut,
      // Действие с поповером открывает его у Блока: меню Ручки и сочетание зовут `run`.
      run: action.run ?? ((editor, pos) => void editor.commands.openToolPopover(id, pos)),
      popover: action.popover,
      isVisible: action.isVisible,
    };
  });
  // Id — по номеру записи, как у Действий: у Карточки он нужен только ключом React.
  const textCards = records(tool.textCards).map((textCard, index): TextCardRecord => ({
    id: `${tool.name}-textCard${index}`,
    label: labelOf(tool, `text card ${index}`, textCard.label),
    rangeAt: textCard.rangeAt,
    render: textCard.render,
  }));
  return { insertItems, blockTypes, blockActions, textCards };
}

/** Часть для движка: массив сразу или то, что отдал загрузчик; не массив — пустая. */
function engineOf(tool: CustomTool): Extensions {
  const engine = typeof tool.engine === "function" ? loaded(tool.engine) : tool.engine;
  return Array.isArray(engine) ? engine : [];
}

/** Внутреннее описание своего Инструмента — то, что кладёт в список `expandTools`. */
export function describeCustomTool(tool: CustomTool): ToolDescriptor {
  return {
    name: tool.name,
    custom: tool,
    // Загрузчик: правила Схемы ложатся на Часть, когда она пришла (`engineOf`).
    load: typeof tool.engine === "function" ? tool.engine : undefined,
    engine: () => engineOf(tool).map((extension) => bindRules(extension, tool)),
    ...uiRecords(tool),
    blocks: blocksOf(tool),
    buttons: records(tool.buttons).map((button) => describeButton(tool, button)),
    triggers:
      tool.trigger && typeof tool.trigger === "object"
        ? [{ ...tool.trigger, tool: tool.name }]
        : [],
    documentContent: Object.entries(blocksOf(tool))
      .filter(([, block]) => block.kind === "block" && block.place === "top")
      .map(([name]) => name),
  };
}

/**
 * Внутреннее описание Инструмента из определения (`defineTool`): тело из
 * `create` и имя определения собираются в обычный `CustomTool` и идут тем же
 * путём, а Опции этого Редактора — умолчания, слитые с `tool()`, — достаются
 * `create`, `state` и `commands`.
 */
export function describeDefinition(definition: ToolDefinition, given: object = {}): ToolDescriptor {
  const { options, tool } = resolveDefinition(definition, given);
  return {
    ...describeCustomTool(tool),
    options,
    state: definition.state && ((editor) => definition.state!({ editor, options })),
    commands: definition.commands && (({ editor }) => definition.commands!({ editor, options })),
  };
}

/**
 * Набор движка, который `RichTextEditor` собирает при ошибке набора: движок
 * нужен хуку `useEditor` в любом случае, но наружу он не выходит.
 */
export const FALLBACK_EXTENSIONS: Extensions = [StarterKit];

/** Виды правил: поле описания и тип расширения Tiptap. */
const KINDS = [
  ["blocks", "node"],
  ["marks", "mark"],
] as const;

/** Подпись — строка или функция, иконка — компонент (функция или `memo`/`forwardRef`). */
const isLabel = (value: unknown) => typeof value === "string" || typeof value === "function";
const isIcon = (value: unknown) =>
  typeof value === "function" || (typeof value === "object" && value !== null);
/** Список непустых строк: имена Блоков, `aliases`, клавиши сочетания. */
const isWords = (value: unknown) =>
  Array.isArray(value) && value.every((word) => typeof word === "string" && word !== "");

/** Ошибка UI-записей своего Инструмента (ADR-0058, п. 5) или `null`. */
function uiEntryError(tool: CustomTool): string | null {
  const lists = [
    ["insertItems", tool.insertItems],
    ["blockActions", tool.blockActions],
    ["textCards", tool.textCards],
  ] as const;
  for (const [field, list] of lists) {
    if (list === undefined) continue;
    if (!Array.isArray(list)) return `${field} must be an array`;
    for (const [index, entry] of (list as readonly Record<string, unknown>[]).entries()) {
      const where = `${field}[${index}]`;
      if (typeof entry !== "object" || entry === null) return `${where} must be an object`;
      if (field === "textCards") {
        if (!isLabel(entry.label) || typeof entry.rangeAt !== "function") {
          return `${where} needs a label (string or function) and rangeAt`;
        }
        if (typeof entry.render !== "function") return `${where} needs render`;
        continue;
      }
      if (!isLabel(entry.label) || !isIcon(entry.icon)) {
        return `${where} needs a label (string or function) and an icon component`;
      }
      if ((typeof entry.run === "function") === (typeof entry.popover === "function")) {
        return `${where} needs exactly one of run and popover`;
      }
      const keys = entry.shortcut;
      if (keys !== undefined && !(isWords(keys) && (keys as string[]).length > 1)) {
        return `${where}: shortcut is a list of keys, a modifier and a key at least`;
      }
      if (field === "insertItems") {
        if (entry.section !== "insert" && entry.section !== "turnInto") {
          return `${where}: section is "insert" or "turnInto"`;
        }
        if (entry.aliases !== undefined && !isWords(entry.aliases)) {
          return `${where}: aliases is a list of strings`;
        }
      } else if (!isWords(entry.blocks) || (entry.blocks as unknown[]).length === 0) {
        return `${where}: blocks is a list of block names`;
      } else if (entry.isVisible !== undefined && typeof entry.isVisible !== "function") {
        return `${where}: isVisible is a function`;
      }
    }
  }
  return null;
}

/** Ошибка набора своих Инструментов: текст для консоли и исключение движка, если было. */
export interface CustomToolsError {
  message: string;
  cause?: unknown;
}

/**
 * Ошибка сборки набора Инструментов или `null` (ADR-0058, п. 1.5, 2.4).
 *
 * Имя без Префикса потребителя, совпадение имён, Node или Mark Части для
 * движка без правил Схемы (и правило без них), атрибут, которого нет в
 * правилах, HTML мимо соглашения, Схема, которую движок не собрал, — всё это
 * потеря данных на сервере или в самом Редакторе, и автор должен увидеть её
 * до первого сохранения. `extensions` — полный набор движка, свои уже в нём.
 * Неизвестная строка в `tools` сюда не доходит: её отбрасывает `expandTools`.
 *
 * Текст — для консоли разработчика, по-английски (ADR-0034), коротко: каждая
 * строка здесь — вес кода кита; автору поле показывает строку каталога.
 * Исключение движка — отдельно, в `cause`: текст — ключ «один раз» у `devError`.
 */
export function customToolsError(tools: ToolList, extensions: Extensions): CustomToolsError | null {
  // Ошибка, найденная при развороте `tools` (две записи `tool()` с одним именем), идёт тем же путём.
  if (tools.error) return { message: tools.error };
  const custom = tools.descriptors.flatMap((descriptor) => descriptor.custom ?? []);
  if (custom.length === 0) return null;
  // Имена Инструментов и имена Блоков и Меток — разные пространства: Инструмент
  // `acme_card` вправе описывать Блок `acme_card`.
  const toolNames = new Set<string>();
  const ruleNames = new Set<string>();
  const triggerChars = new Set<string>();
  for (const tool of custom) {
    const fail = (text: string) => ({ message: `custom tool "${tool.name}": ${text}` });
    if (!CUSTOM_NAME.test(tool.name)) return fail("the name needs a consumer prefix (acme_name)");
    if (toolNames.has(tool.name)) return fail("two tools share this name");
    toolNames.add(tool.name);
    // Форму списка проверяет код кита: потребитель на JS обходит типы.
    if (tool.buttons !== undefined && !Array.isArray(tool.buttons)) {
      return fail("buttons must be an array");
    }
    const ids = new Set<string>();
    for (const [index, button] of (tool.buttons ?? []).entries()) {
      if (typeof button !== "object" || button === null) {
        return fail(`buttons[${index}] must be an object`);
      }
      const { id } = button;
      if (!id) return fail("a button needs an id");
      if (ids.has(id)) return fail(`two buttons share the id "${id}"`);
      ids.add(id);
      if (!isLabel(button.label)) return fail(`button "${id}" needs a label (string or function)`);
      if (!button.icon) return fail(`button "${id}" needs an icon`);
      if ((typeof button.run === "function") === (typeof button.popover === "function")) {
        return fail(`button "${id}" needs exactly one of run and popover`);
      }
    }
    const entry = uiEntryError(tool);
    if (entry) return fail(entry);
    if (tool.trigger !== undefined) {
      const { trigger } = tool;
      if (typeof trigger !== "object" || trigger === null) return fail("trigger must be an object");
      if (!isTriggerChar(trigger.char)) {
        return fail("trigger.char is one printable character, not a space and not /");
      }
      if (triggerChars.has(trigger.char)) {
        return fail(`the trigger character "${trigger.char}" is taken by another tool`);
      }
      triggerChars.add(trigger.char);
      if (typeof trigger.items !== "function" || typeof trigger.onSelect !== "function") {
        return fail("trigger needs items and onSelect functions");
      }
      if (trigger.label !== undefined && !isLabel(trigger.label)) {
        return fail("trigger.label is a string or a function");
      }
    }
    const top = engineOf(tool);
    for (const [field, type] of KINDS) {
      for (const [name, rule] of Object.entries(tool[field] ?? {}) as [string, Rule][]) {
        if (!CUSTOM_NAME.test(name)) return fail(`"${name}" in ${field} needs a consumer prefix`);
        if (ruleNames.has(name)) return fail(`"${name}" is taken by another block or mark`);
        ruleNames.add(name);
        if (!top.some((extension) => extension.type === type && extension.name === name)) {
          return fail(`"${name}" in ${field} has no ${type} at the top level of engine`);
        }
        for (const [key, value] of Object.entries(attributesOf(rule))) {
          if (!CUSTOM_ATTRIBUTE_NAME.test(key)) {
            return fail(`attribute "${key}" needs a lowercase consumer prefix`);
          }
          try {
            if (value.kind === "pattern") new RegExp(value.pattern);
          } catch {
            return fail(`the pattern of "${key}" is not a regular expression`);
          }
        }
      }
    }
    for (const { type, name } of flattenExtensions(top)) {
      const field = type === "node" ? "blocks" : "marks";
      if (type !== "extension" && !(name in (tool[field] ?? {}))) {
        return fail(`${type} "${name}" of engine has no rule in ${field}`);
      }
    }
  }

  let schema;
  try {
    schema = getSchema(extensions);
  } catch (cause) {
    return { message: "custom tools: the schema failed to build", cause };
  }
  for (const tool of custom) {
    for (const [field, type] of KINDS) {
      for (const [name, rule] of Object.entries(tool[field] ?? {}) as [string, Rule][]) {
        const fail = (text: string) => ({
          message: `custom tool "${tool.name}": ${type} "${name}" ${text}`,
        });
        const schemaType = type === "node" ? schema.nodes[name] : schema.marks[name];
        const extra = Object.keys(schemaType?.spec.attrs ?? {}).find(
          (key) => !(key in attributesOf(rule))
        );
        if (extra) return fail(`has attribute "${extra}" with no rule`);
        /*
          HTML — по соглашению: `toDOM` экземпляра по умолчанию даёт тег и
          метку с именем. Свой `renderHTML` Части для движка мог уйти от них, и
          тогда Блок не прочитался бы обратно из собственного `getHTML()`.
        */
        const { tag, marker } = customElement(
          type === "node" ? (rule as CustomBlock).kind : "mark"
        );
        const instance =
          type === "node" ? schema.nodes[name]?.createAndFill() : schema.marks[name]?.create();
        const spec: unknown = instance && schemaType?.spec.toDOM?.(instance as never, true);
        if (Array.isArray(spec) && (spec[0] !== tag || spec[1]?.[marker] !== name)) {
          return fail(`must render <${tag} ${marker}="${name}">`);
        }
      }
    }
  }
  return null;
}
