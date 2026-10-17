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
  Custom Tool in the engine (ADR-0058, sections 1 and 2): from the public description, the
  internal one, and the check of the set at build time.

  THE SCHEMA RULES ARE THE ONLY SOURCE OF THE HTML. The kit adds the Node and Mark from
  Extensions itself: the group and inline-ness follow the kind of Block, HTML parsing is only
  `div|span[data-block="<name>"]` and `span[data-mark="<name>"]`, the custom attributes are
  `data-<name>` with a value checked by the kind from the rules, and the Block traits go into
  the node spec. So a custom parse rule cannot take over a kit tag, and a value outside the rules
  does not enter the Document, neither from `value` nor from a paste: the kit's code checks it,
  and the check cannot be weakened through Extensions. Behavior (content, `atom`, the React view,
  `renderText`, commands) stays with the consumer.
*/

type Rule = CustomBlock | CustomMark;

const blocksOf = (tool: CustomTool): Readonly<Record<string, CustomBlock>> => tool.blocks ?? {};
const marksOf = (tool: CustomTool): Readonly<Record<string, CustomMark>> => tool.marks ?? {};
const attributesOf = (rule: Rule): Readonly<Record<string, CustomAttribute>> =>
  rule.attributes ?? {};

/** The attribute value, checked by its rule, or `null` (the node's default). */
function allowed(rule: CustomAttribute, value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return isAllowedAttributeValue(rule, text) ? text : null;
}

/** A Node or Mark from Extensions, extended with the kit's Schema rules. */
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
    // A custom `renderHTML` stays with the Extensions (the text inside an Atom). The convention
    // with it is checked by `customToolsError`.
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
      // The top level is outside the `block` group: the Document names it itself (`document.ts`).
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
 * A custom Tool's button, in the internal form. The id is the Tool's name and the button key
 * (`acme_stamp:stamp`): the keys of the Toolbar flags and of the reference are shared with the
 * kit's buttons, so an id never collides with them or with another Tool's id. An empty caption
 * gives a `console.error` and the Tool's name (ADR-0058, item 6.5). The caption is called on
 * every render, so the error lives in the wrapper and not in the set check: the set check cannot
 * see what a locale function returns, only the wrapper can.
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
 * A label for the menu: a string or a function of `{ locale, messages }`. An empty label gives a
 * `console.error` in development and the Tool's name in its place (ADR-0058, item 6.5): a
 * forgotten translation does not break the field.
 */
function labelOf(tool: CustomTool, entry: string, label: ToolLabel) {
  return (messages: UiMessages["editor"], locale: string): string => {
    const text = toolLabel(label, { locale, messages });
    if (text.trim() !== "") return text;
    devError(`RichTextEditor: custom tool "${tool.name}": ${entry} has an empty label`);
    return tool.name;
  };
}

/**
 * Records of a list. A value that is not an array, or an item that is not an object, is not a
 * record: `customToolsError` rejects the set.
 */
const records = <T extends object>(list: readonly T[] | undefined): readonly T[] =>
  Array.isArray(list) ? list.filter((item) => typeof item === "object" && item !== null) : [];

/**
 * Insert items and Block actions in the internal form of records. The id is the Tool's name and
 * the entry's number, joined with a hyphen: names have no hyphens, so an item matches neither a
 * kit item nor someone else's. The "Turn into" of a custom Tool also appears in the Format ›
 * item of the Block handle (it reads it through the "¶" paragraph): the same words and icon.
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
    // An item with a popover does not call `run`: `applyInsertItem` opens the popover.
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
      // A Block action with a popover opens it at its Block. The handle menu and the shortcut
      // call `run`, which opens the popover.
      run: action.run ?? ((editor, pos) => void editor.commands.openToolPopover(id, pos)),
      popover: action.popover,
      isVisible: action.isVisible,
    };
  });
  // The id is the entry's number, as for Block actions. A Text card needs it only as a React key.
  const textCards = records(tool.textCards).map((textCard, index): TextCardRecord => ({
    id: `${tool.name}-textCard${index}`,
    label: labelOf(tool, `text card ${index}`, textCard.label),
    rangeAt: textCard.rangeAt,
    render: textCard.render,
  }));
  return { insertItems, blockTypes, blockActions, textCards };
}

/** Extensions: an array as is, or what the Loader returned. Not an array: an empty array. */
function engineOf(tool: CustomTool): Extensions {
  const engine = typeof tool.engine === "function" ? loaded(tool.engine) : tool.engine;
  return Array.isArray(engine) ? engine : [];
}

/** The internal description of a custom Tool: what goes into the `expandTools` list. */
export function describeCustomTool(tool: CustomTool): ToolDescriptor {
  return {
    name: tool.name,
    custom: tool,
    // A Loader: the Schema rules are applied to the Extensions once they arrive (`engineOf`).
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
 * The internal description of a Tool from a definition (`defineTool`). The body from `create` and
 * the definition's name are assembled into a plain `CustomTool` and go the same way; this
 * Editor's options (the defaults merged with `tool()`) are taken by `create`, `state` and
 * `commands`.
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
 * The engine's extension set that `RichTextEditor` builds when the Tool set has an error. The
 * `useEditor` hook needs an engine in any case, but that engine is never exposed.
 */
export const FALLBACK_EXTENSIONS: Extensions = [StarterKit];

/** The kinds of rules: the descriptor field and the Tiptap extension type. */
const KINDS = [
  ["blocks", "node"],
  ["marks", "mark"],
] as const;

/** A label is a string or a function; an icon is a component (a function, or `memo`/`forwardRef`). */
const isLabel = (value: unknown) => typeof value === "string" || typeof value === "function";
const isIcon = (value: unknown) =>
  typeof value === "function" || (typeof value === "object" && value !== null);
/** A list of non-empty strings: Block names, `aliases`, shortcut keys. */
const isWords = (value: unknown) =>
  Array.isArray(value) && value.every((word) => typeof word === "string" && word !== "");

/** The error in a custom Tool's UI contributions (ADR-0058, item 5), or `null`. */
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

/** An error in the Tool set: the text for the console and the engine exception, if any. */
export interface CustomToolsError {
  message: string;
  cause?: unknown;
}

/**
 * An error in building the set of Tools, or `null` (ADR-0058, items 1.5 and 2.4).
 *
 * A name without the consumer prefix, two Tools with one name, a Node or Mark in the Extensions
 * without Schema rules (and a rule without them), an attribute that has no rule, HTML outside the
 * convention, a Schema the engine failed to build: all of this is data lost on the server or in
 * the Editor itself, and the author must see it before the first save. `extensions` is the
 * engine's full set; the custom ones are already in it. An unknown string in `tools` does not
 * reach here: `expandTools` drops it.
 *
 * The text is for the developer's console, in English (ADR-0034), and short: each line here adds
 * to the kit's bundle size; the author sees a catalog string in the field instead. An engine
 * exception is separate, in `cause`: the text is the once-only key of `devError`.
 */
export function customToolsError(tools: ToolList, extensions: Extensions): CustomToolsError | null {
  // The error found while expanding `tools` (two `tool()` entries with one name) goes the same way.
  if (tools.error) return { message: tools.error };
  const custom = tools.descriptors.flatMap((descriptor) => descriptor.custom ?? []);
  if (custom.length === 0) return null;
  // Tool names and the names of Blocks and Marks are separate namespaces: a Tool `acme_card`
  // may describe a Block `acme_card`.
  const toolNames = new Set<string>();
  const ruleNames = new Set<string>();
  const triggerChars = new Set<string>();
  for (const tool of custom) {
    const fail = (text: string) => ({ message: `custom tool "${tool.name}": ${text}` });
    if (!CUSTOM_NAME.test(tool.name)) return fail("the name needs a consumer prefix (acme_name)");
    if (toolNames.has(tool.name)) return fail("two tools share this name");
    toolNames.add(tool.name);
    // The kit checks the shape of the list: a consumer in plain JS can bypass the types.
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
          The HTML follows the convention: the instance's default `toDOM` gives the tag and the
          label with the name. A custom `renderHTML` in the Extensions could depart from them, and
          then the Block would not read back from its own `getHTML()` output.
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
