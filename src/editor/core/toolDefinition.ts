import type { Editor } from "@tiptap/core";
import type { CustomTool, PrefixedName, ToolEntry } from "./customTool.js";
import { isConfiguredTool, mergeOptions } from "./toolOptions.js";

/*
  A custom Tool with Options, State and Commands: `defineTool()`.

  The module is server-safe, like `customTool.ts` and `toolOptions.ts`: types and one function
  over data; Tiptap is here only as a type. `defineTool` is a thin wrapper over the same
  `CustomTool` shape (ADR-0058). The definition has no build path of its own: the kit builds a
  regular Tool description from it (`describeDefinition`), and all the rules of a custom Tool
  (the consumer prefix, name uniqueness, set checks, the Loader of Extensions) apply as before.

  THE FILE NAME IS NOT `defineTool.ts`. Under that name, the consumer build on Next.js 15.5
  (`check:consumer`) dropped `RichTextEditor` from the client RSC manifest: a page with it,
  rendered from a server component, failed at prerender. The same code under another name, or
  inside a neighboring module, builds fine: the cause is in the bundler, not in the code.
  Rename it back only with a `check:consumer` run.
*/

/**
 * The body of a custom Tool description: the `CustomTool` shape without a name. The definition
 * supplies the name, so it cannot diverge from the key the definition sits under in `tools`.
 */
export type CustomToolBody = Omit<CustomTool, "name">;

/**
 * What the `state` and `commands` of a definition receive: the live engine and the Options of this
 * Editor, the `defaults` merged with `tool(definition, options)`.
 */
export interface ToolDefinitionContext<Options extends object = object> {
  /** Live engine: the function is called only when it has been created and not destroyed. */
  editor: Editor;
  /**
   * This Editor's Options. Read them, do not change them: the object is shared by `create`, `state`
   * and `commands`.
   */
  options: Options;
}

/**
 * What the author passes to `defineTool()`: the fields of the definition, without the internal marker.
 */
export interface ToolDefinitionInput<
  Name extends PrefixedName = PrefixedName,
  Options extends object = object,
  State = unknown,
  Commands extends object = object,
> {
  /** Name with the consumer prefix, unique within `tools`. */
  name: Name;
  /** Default Options: the complete set of fields. The Options type is inferred from them. */
  defaults: Options;
  /** The body of the Tool description, built from this Editor's Options. */
  create(options: Options): CustomToolBody;
  /**
   * The Tool's state, if it has one. The screen re-renders only when the snapshot has changed, and
   * this saves work for plain data: primitives, arrays and plain objects are compared by value.
   * `Date`, `Map`, `Set` and class instances are compared by reference: a new instance is a new
   * snapshot. If the function creates such a value anew on every call, the screen re-renders on
   * every transaction (and in the worst case React loops). Return plain data (`date.toISOString()`,
   * an array made from a `Map`) or the same reference for as long as the data has not changed.
   */
  state?(context: ToolDefinitionContext<Options>): State;
  /** The Tool's commands, if it has any. */
  commands?(context: ToolDefinitionContext<Options>): Commands;
}

/**
 * A custom Tool definition: what `defineTool()` returns. An element of `tools` can take it as is
 * (with `defaults`) or configure it through `tool(definition, options)`. The kit reads the fields;
 * the screen does not need them.
 */
export interface ToolDefinition<
  Name extends PrefixedName = PrefixedName,
  Options extends object = object,
  State = unknown,
  Commands extends object = object,
> extends ToolDefinitionInput<Name, Options, State, Commands> {
  /** The definition's mark: `tools` uses it to tell a definition from a plain `CustomTool`. */
  readonly defined: true;
}

/**
 * Define a custom Tool with Options, State and Commands. The screen configures it with the same
 * `tool()` as a built-in one, and reads it with the same `useRichTextToolState` and `handle.tool()`:
 *
 * ```ts
 * export const mention = defineTool({
 *   name: "acme_mention",
 *   defaults: { labels: { insert: "Mention" }, limit: 5 },
 *   create: (options) => ({
 *     engine: () => import("./mentionEngine.js").then((module) => module.engine),
 *     blocks: { acme_mention: { kind: "inline" } },
 *     insertItems: [{ section: "insert", label: options.labels.insert, icon: AtIcon, run }],
 *   }),
 *   state: ({ editor }) => ({ mentions: countMentions(editor) }),
 *   commands: ({ editor, options }) => ({ insert: (name: string) => … }),
 * });
 *
 * <RichTextEditor tools={[mention]} />                                         // defaults
 * <RichTextEditor tools={[tool(mention, { labels: { insert: "Mention it" } })]} /> // configured
 * ```
 *
 * - `defaults` — the complete set of Options; the Options type is inferred from it, so it does not
 *   have to be declared a second time.
 * - `create(options)` returns the body of the Tool description: the same shape as `CustomTool`
 *   without a name — Extensions, Schema rules, UI entries. It is called once per entry of `tools`
 *   (the definition itself, or the object that `tool(definition, options)` returned): the kit
 *   remembers the result, and an Island closed over the Options is the same on every render. An
 *   entry created anew on every render of the screen (`tools={[tool(mention, …)]}` in the body of a
 *   component) is a new entry for the kit: move `tools` out of the render. Keep the Loader of
 *   Extensions as a module-level constant: the Loader's cache lives on the function itself, and a
 *   new function on every `create` call would load the Extensions again for every entry.
 * - `state({ editor, options })` — the State for `useRichTextToolState(ref, name)`. It is called on
 *   every transaction and on every read of the hook, so it must be fast and free of side effects;
 *   return data, without DOM nodes. Plain data (primitives, arrays, plain objects) is compared by
 *   value, everything else (`Date`, `Map`, `Set`, class instances) by reference. If there is no
 *   `state`, the Tool has no State, and the hook returns `null`.
 * - `commands({ editor, options })` — the Commands for `handle.tool(name)`. Called on every access
 *   to the Handle: only wrappers over the engine, with no subscriptions. A command returns a
 *   `boolean`, as the built-in ones do. If there is no `commands`, `handle.tool(name)` returns `null`.
 *
 * Merging Options: nested plain objects are merged with the defaults, arrays and functions are
 * replaced whole, as `configure` does in Tiptap. Options are read once, when the engine is created;
 * to change them, recreate the Editor with a `key`. The author must validate Option values: the kit
 * does not do it.
 *
 * All the rules of a custom Tool apply (ADR-0058): the name has the consumer prefix and is unique
 * within `tools`, and two entries of one definition (with `tool()` and without it) are also a set
 * error. Typing of `useRichTextToolState` and `handle.tool()` goes through the `RichTextTools` map:
 * the author adds the Tool to it with `declare module "@olddevs/ui/editor"`; without that they
 * return `unknown`.
 *
 * Server-safe: the module has no Tiptap and no React. The definition contains functions, as
 * `CustomTool` does, so a set with it is assembled in the server module and passed to the client
 * component only together with the module, not as a prop across the RSC boundary.
 */
export function defineTool<
  Name extends PrefixedName,
  Options extends object,
  State = unknown,
  Commands extends object = object,
>(
  definition: ToolDefinitionInput<Name, Options, State, Commands>
): ToolDefinition<Name, Options, State, Commands> {
  return { ...definition, defined: true };
}

/** A definition collected for one set of Options: the merged Options and the `CustomTool` with the body from `create`. */
interface ResolvedDefinition {
  options: object;
  tool: CustomTool;
}

/** The key of an entry without `tool()`: it has no Options object, so the definition is taken with its defaults. */
const NO_OPTIONS: object = {};

/**
 * What is already collected: a definition, then the Options object of a `tool()` entry. Weak
 * references: an entry that the screen has released goes away together with its result.
 */
const resolved = new WeakMap<ToolDefinition, WeakMap<object, ResolvedDefinition>>();

/**
 * A definition turned into a plain description: this Editor's Options (the defaults merged with
 * `given`, the options of `tool()`) and a `CustomTool` with the body from `create`. From here on the
 * Tool takes the same path as one described by an object.
 *
 * THE RESULT IS MEMOIZED by the pair "definition + the Options object of a `tool()` entry" (entries
 * without `tool()` are memoized by the definition alone). `create` is the author's function, and an
 * Island closed over the Options would be created anew on every call; and `richTextSchema`,
 * `islandsFor`, `sanitizeRichText` and the assembly of the set each read the definition on their own
 * render. Without memoization, a client parent that re-renders `RichTextView` with the same `tools`
 * would get a new component type on every render, and React would unmount the Island. One entry in
 * `tools` is one `CustomTool`, for as long as the entry lives.
 */
export function resolveDefinition(definition: ToolDefinition, given?: object): ResolvedDefinition {
  const key = given ?? NO_OPTIONS;
  let byOptions = resolved.get(definition);
  if (!byOptions) resolved.set(definition, (byOptions = new WeakMap()));
  let result = byOptions.get(key);
  if (!result) {
    const options = mergeOptions(definition.defaults, given ?? {});
    result = { options, tool: { ...definition.create(options), name: definition.name } };
    byOptions.set(key, result);
  }
  return result;
}

/**
 * The Tool description from an entry of `tools`: a plain object as is; a definition, collected with
 * the defaults or the options of `tool()`. A kit name (a plain string) and a configured built-in Tool
 * give `undefined`: they have no Schema and no Islands. For the server: `richTextSchema` and
 * `islandsFor` read the rules only from here.
 */
export function customToolOf(entry: ToolEntry): CustomTool | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  if (isConfiguredTool(entry)) {
    return entry.definition && resolveDefinition(entry.definition, entry.options).tool;
  }
  return "defined" in entry ? resolveDefinition(entry).tool : entry;
}
