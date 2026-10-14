import type { Editor } from "@tiptap/core";
import type { CustomTool, PrefixedName, ToolEntry } from "./customTool.js";
import { isConfiguredTool, mergeOptions } from "./toolOptions.js";

/*
  Свой Инструмент с Опциями, Состоянием и Командами: `defineTool()`.

  Модуль серверно-безопасен, как `customTool.ts` и `toolOptions.ts`: типы и одна
  функция над данными, Tiptap здесь — только тип. `defineTool` — сахар над той
  же формой `CustomTool` (ADR-0058): отдельного пути сборки у определения нет,
  кит собирает из него обычное описание Инструмента (`describeDefinition`), и
  все правила своего Инструмента — Префикс потребителя, уникальность имени,
  проверки набора, загрузчик Части для движка — действуют как были.

  ИМЯ ФАЙЛА — НЕ `defineTool.ts`. Под этим именем сборка потребителя на Next.js
  15.5 (`check:consumer`) теряла `RichTextEditor` из клиентского манифеста RSC:
  страница с ним из серверного компонента падала при пререндере. Тот же код под
  другим именем или внутри соседнего модуля собирается; причина — в сборщике, а
  не в коде. Переименовывать обратно — только с прогоном `check:consumer`.
*/

/**
 * Тело описания своего Инструмента: форма `CustomTool` без имени. Имя задаёт
 * определение, поэтому оно не может разойтись с тем, под каким определение лежит
 * в `tools`.
 */
export type CustomToolBody = Omit<CustomTool, "name">;

/**
 * Что получают `state` и `commands` определения: живой движок и Опции этого
 * Редактора — умолчания `defaults`, слитые с `tool(definition, options)`.
 */
export interface ToolDefinitionContext<Options extends object = object> {
  /** Живой движок: функцию зовут, только когда он создан и не уничтожен. */
  editor: Editor;
  /** Опции этого Редактора. Читать, а не менять: объект общий для `create`, `state` и `commands`. */
  options: Options;
}

/**
 * Что автор передаёт `defineTool()`: поля определения без служебной метки.
 */
export interface ToolDefinitionInput<
  Name extends PrefixedName = PrefixedName,
  Options extends object = object,
  State = unknown,
  Commands extends object = object,
> {
  /** Имя с Префиксом потребителя, уникальное в `tools`. */
  name: Name;
  /** Умолчания Опций: полный набор полей. Из них выводится тип Опций. */
  defaults: Options;
  /** Тело описания Инструмента от Опций этого Редактора. */
  create(options: Options): CustomToolBody;
  /** Состояние Инструмента, если оно есть. */
  state?(context: ToolDefinitionContext<Options>): State;
  /** Команды Инструмента, если они есть. */
  commands?(context: ToolDefinitionContext<Options>): Commands;
}

/**
 * Определение своего Инструмента: то, что возвращает `defineTool()`. Элемент
 * `tools` — его можно положить туда как есть (с `defaults`) или настроить через
 * `tool(definition, options)`. Поля читает кит, экрану они не нужны.
 */
export interface ToolDefinition<
  Name extends PrefixedName = PrefixedName,
  Options extends object = object,
  State = unknown,
  Commands extends object = object,
> extends ToolDefinitionInput<Name, Options, State, Commands> {
  /** Метка определения: по ней `tools` отличает его от обычного `CustomTool`. */
  readonly defined: true;
}

/**
 * Определить свой Инструмент с Опциями, Состоянием и Командами. Экран настраивает
 * его тем же `tool()`, что и встроенный, а читает тем же `useRichTextToolState`
 * и `handle.tool()`:
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
 * <RichTextEditor tools={[mention]} />                                         // умолчания
 * <RichTextEditor tools={[tool(mention, { labels: { insert: "Отметить" } })]} /> // настройка
 * ```
 *
 * - `defaults` — полный набор Опций; тип Опций выводится из него, второй раз его
 *   объявлять не нужно.
 * - `create(options)` отдаёт тело описания — ту же форму, что `CustomTool`, без
 *   имени: Часть для движка, правила Схемы, UI-записи. Зовётся один раз на
 *   Редактор, при создании набора. Загрузчик Части для движка стоит держать
 *   константой модуля: кэш загрузчика живёт на самой функции, а новая функция на
 *   каждый вызов `create` загружала бы Часть заново для каждого Редактора.
 * - `state({ editor, options })` — Состояние для `useRichTextToolState(ref, name)`.
 *   Зовётся при каждой транзакции и при каждом чтении хука, поэтому должна быть
 *   быстрой и без побочных эффектов; вернуть — данные без DOM-узлов, их сравнивают
 *   по значению. Нет — у Инструмента нет Состояния, и хук отдаёт `null`.
 * - `commands({ editor, options })` — Команды для `handle.tool(name)`. Зовётся при
 *   каждом обращении к Хэндлу: только обёртки над движком, без подписок. Команда
 *   возвращает `boolean`, как у встроенных. Нет — `handle.tool(name)` отдаёт `null`.
 *
 * Слияние Опций: вложенные простые объекты сливаются с умолчаниями, массивы и
 * функции заменяются целиком, как `configure` у Tiptap. Опции читаются один раз,
 * при создании движка; чтобы сменить их, пересоздайте Редактор через `key`.
 * Проверять значения Опций должен автор: кит этого не делает.
 *
 * Все правила своего Инструмента действуют (ADR-0058): имя с Префиксом
 * потребителя, имя уникально в `tools` — и две записи одного определения, с
 * `tool()` и без, тоже ошибка набора. Типизация `useRichTextToolState` и
 * `handle.tool()` — через карту `RichTextTools`: автор дописывает Инструмент в неё
 * через `declare module "@olddevs/ui/editor"`; без этого они отдают `unknown`.
 *
 * Серверно-безопасна: модуль без Tiptap и React. Определение содержит функции, как
 * и `CustomTool`, поэтому набор с ним собирается в серверном модуле и отдаётся
 * клиентскому компоненту только вместе с модулем, а не как проп через границу RSC.
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

/**
 * Определение в обычное описание: Опции этого Редактора (умолчания, слитые с
 * `given` — опциями `tool()`) и `CustomTool` с телом из `create`. Дальше
 * Инструмент идёт тем же путём, что и описанный объектом.
 */
export function resolveDefinition(
  definition: ToolDefinition,
  given: object = {}
): { options: object; tool: CustomTool } {
  const options = mergeOptions(definition.defaults, given);
  return { options, tool: { ...definition.create(options), name: definition.name } };
}

/**
 * Описание своего Инструмента из элемента `tools`: обычный объект как есть,
 * определение — собранное по умолчаниям или Опциям `tool()`. Имя кита и
 * Настроенный встроенный Инструмент — `undefined`: Схемы и Острова у них нет.
 * Для сервера: `richTextSchema` и `islandsFor` читают правила только отсюда.
 */
export function customToolOf(entry: ToolEntry): CustomTool | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  if (isConfiguredTool(entry)) {
    return entry.definition && resolveDefinition(entry.definition, entry.options).tool;
  }
  return "defined" in entry ? resolveDefinition(entry).tool : entry;
}
