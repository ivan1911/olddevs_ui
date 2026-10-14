import type { PrefixedName } from "./customTool.js";
import type { ToolDefinition } from "./toolDefinition.js";
import type { SearchToolState, TocToolState } from "./toolState.js";
import type { SearchToolCommands, TocToolCommands } from "./toolCommands.js";
import type { Tool as ToolName } from "./tools.js";

/*
  Опции Инструмента: `tool()` и карта `RichTextTools`. Модуль серверно-безопасен,
  как `customTool.ts`: типы и функции над данными, без Tiptap и React. Набор
  `tools` собирается в серверном модуле экрана рядом с остальной конфигурацией,
  и Настроенный Инструмент — обычный объект из данных, без функций: его можно
  отдать клиентскому компоненту через границу RSC, если сами опции — данные.
*/

/**
 * Уровень заголовка в опциях Оглавления: 1 — `h1` … 4 — `h4`. Выше четвёртого
 * Схема кита заголовков не знает.
 */
export type TocLevel = 1 | 2 | 3 | 4;

/**
 * Опции Инструмента `search` (все значения — со стартовыми умолчаниями кита).
 * Это стартовые флажки поиска вообще, а не только панели: запрос, который
 * задаёт Команда `setQuery`, берёт не названные в ней флажки отсюда, пока
 * поиск не закрыт (`close()`, Escape в панели).
 */
export interface SearchToolOptions {
  /**
   * Панель открывается с включённым флажком «Регистр». Флажок остаётся
   * переключаемым; кит не запоминает его между открытиями. По умолчанию `false`.
   */
  matchCase: boolean;
  /** Панель открывается с включённым флажком «Слово целиком». По умолчанию `false`. */
  wholeWord: boolean;
  /** Панель открывается с включённым переключателем «Регулярное выражение». По умолчанию `false`. */
  regex: boolean;
}

/** Опции Инструмента `toc` (ADR-0068). */
export interface TocToolOptions {
  /**
   * Имя CSS-переменной с высотой липкой шапки экрана (ADR-0016): переход к
   * заголовку ставит его под шапку, а подсветка считает раздел текущим от её
   * нижнего края. Значение — имя переменной целиком, с двумя дефисами:
   * `--header-h`. Липкую Панель Редактора это не двигает: она по-прежнему
   * стоит под `--topbar-h`. По умолчанию `--topbar-h`.
   */
  offsetVar: string;
  /**
   * Уровни заголовков, которые попадают в Оглавление: подмножество 1–4. Заголовка
   * другого уровня нет ни в полосе, ни в списке, и отступ пунктов считается
   * от самого крупного из оставшихся. По умолчанию все четыре.
   */
  levels: readonly TocLevel[];
  /**
   * Ширина списка — длина CSS или пиксели. Постоянная, а не по самому длинному
   * заголовку. По умолчанию 240.
   */
  listWidth: number | string;
}

/**
 * Типы Инструментов Редактора по имени: что экран задаёт при настройке (`options`),
 * что читает (`state`) и что вызывает (`commands`). Расширяемый интерфейс, как
 * `Storage` и `Commands` у Tiptap: кит объявляет в нём `search` и `toc`, а
 * потребитель дописывает свои Инструменты через declaration merging:
 *
 * ```ts
 * declare module "@olddevs/ui/editor" {
 *   interface RichTextTools {
 *     acme_note: {
 *       options: { tone: "info" | "warning" };
 *       state: { count: number };
 *       commands: { clear(): boolean };
 *     };
 *   }
 * }
 * ```
 *
 * Из карты выводятся типы `useRichTextToolState`, `handle.tool()` и Опции `tool()`
 * встроенного; Опции своего Инструмента `tool()` берёт из `defaults` его определения.
 * Инструмент, не дописанный в карту, работает: типизация добровольна.
 */
export interface RichTextTools {
  search: {
    options: SearchToolOptions;
    state: SearchToolState;
    commands: SearchToolCommands;
  };
  toc: {
    options: TocToolOptions;
    state: TocToolState;
    commands: TocToolCommands;
  };
}

/**
 * Имена встроенных Инструментов, у которых есть опции: ключи карты, совпадающие
 * с именами кита. Свой Инструмент, дописанный в карту, сюда не попадает —
 * настраивается по определению, а не по имени.
 */
export type ConfigurableToolName = keyof RichTextTools & ToolName;

/** Опции Инструмента из карты; нет карты или `options` — `never`. */
type OptionsOf<Name extends ConfigurableToolName> = RichTextTools[Name] extends {
  options: infer Options;
}
  ? Options
  : never;

/**
 * Опции, которые экран передаёт `tool()`: каждое поле необязательно, остальное
 * берётся из умолчаний. Вложенные объекты вкладываются так же, а массивы и
 * функции — значение целиком (правило слияния, `mergeOptions`).
 */
export type ToolOptionsInput<Options> = {
  [Key in keyof Options]?: Options[Key] extends readonly unknown[] | ((...args: never[]) => unknown)
    ? Options[Key]
    : Options[Key] extends object
      ? ToolOptionsInput<Options[Key]>
      : Options[Key];
};

/**
 * Настроенный Инструмент: запись для `tools`, которую возвращает `tool()`.
 * Непрозрачная — поля читает только кит. У встроенного это имя и опции, а не
 * описание: описания встроенных наружу не выходят (ADR-0058, п. 10.3). У своего
 * Инструмента добавляется определение, которое `tool()` настраивает.
 */
export interface ConfiguredTool<Name extends string = ToolName> {
  /** Метка записи: по ней `tools` отличает Настроенный Инструмент от своего. */
  readonly configured: true;
  readonly name: Name;
  readonly options: Readonly<Record<string, unknown>>;
  /** Определение своего Инструмента (`defineTool`); у встроенного его нет. */
  readonly definition?: ToolDefinition;
}

/**
 * Слить Опции: вложенные простые объекты сливаются, массивы, функции и всё
 * остальное заменяются целиком — как `configure` у Tiptap. Значение `undefined`
 * не в счёт: остаётся то, что было. Новый объект, исходные не меняются (вложенный
 * объект, которого нет в `given`, остаётся тем же).
 */
export function mergeOptions(base: object, given: object): object {
  // Простой объект — литерал; экземпляры классов, `Date`, React-элементы — значения.
  const plain = (value: unknown): value is object =>
    (value as { constructor?: unknown } | null)?.constructor === Object;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(given)) {
    if (value !== undefined) {
      result[key] = plain(value) && plain(result[key]) ? mergeOptions(result[key], value) : value;
    }
  }
  return result;
}

/**
 * Настроить Инструмент прямо в `tools`: встроенный — по имени, свой — по
 * определению (`defineTool`).
 *
 * ```tsx
 * <RichTextEditor
 *   tools={[
 *     ...RICH_TEXT_PRESETS.full,
 *     tool("toc", { offsetVar: "--header-h", levels: [2, 3] }),
 *     tool(mention, { labels: { insert: "Отметить коллегу" } }),
 *   ]}
 * />
 * ```
 *
 * Запись включает Инструмент и без имени в `tools`; если в `tools` есть и голое
 * имя (из пресета), побеждает Настроенный Инструмент. Две записи `tool()` с
 * одним встроенным именем — ошибка набора, как и две записи одного своего
 * Инструмента. Место на поверхности не меняется: у встроенного оно
 * определяется порядком кита, у своего — порядком `tools`. Передавать нужно
 * только те опции, которые меняются, остальные берутся из умолчаний; вложенные
 * объекты сливаются, массивы и функции заменяются целиком.
 *
 * Опции читаются один раз, вместе с набором, при создании движка. Чтобы сменить
 * их на лету, пересоздайте Редактор через `key`. Неверное значение встроенной
 * опции (из JS без типов) заменяется умолчанием, в разработке — один
 * `console.error`; опции своего Инструмента проверяет его автор.
 *
 * Встроенный — только Инструмент с опциями: `search` и `toc`. Серверно-безопасна.
 */
export function tool<Name extends ConfigurableToolName>(
  name: Name,
  options?: ToolOptionsInput<OptionsOf<Name>>
): ConfiguredTool<Name>;
export function tool<Name extends PrefixedName, Options extends object>(
  definition: ToolDefinition<Name, Options, unknown, object>,
  options?: ToolOptionsInput<Options>
): ConfiguredTool<Name>;
export function tool(
  entry: ToolName | ToolDefinition,
  options: Record<string, unknown> = {}
): ConfiguredTool<string> {
  return typeof entry === "string"
    ? { configured: true, name: entry, options }
    : { configured: true, name: entry.name, options, definition: entry };
}

/** Запись `tools` — Настроенный Инструмент. `null` и строки — нет. */
export function isConfiguredTool(entry: unknown): entry is ConfiguredTool<string> {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as { configured?: unknown }).configured === true
  );
}
