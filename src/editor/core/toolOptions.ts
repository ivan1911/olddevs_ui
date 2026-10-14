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

/** Опции Инструмента `search` (все значения — со стартовыми умолчаниями кита). */
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
   * Уровни заголовков, которые попадают в Оглавление: подмножество 1–4. Заголовок
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
 * Заготовка Состояния и Команд до слайсов, которые их наполняют: пустой объект,
 * в который нельзя ничего записать.
 */
type Pending = Record<string, never>;

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
 * Из карты выводятся типы `tool()` и, в следующих срезах, `useRichTextToolState`
 * и `handle.tool()`. Инструмент, не дописанный в карту, работает: типизация
 * добровольна.
 */
export interface RichTextTools {
  search: {
    options: SearchToolOptions;
    state: Pending;
    commands: Pending;
  };
  toc: {
    options: TocToolOptions;
    state: Pending;
    commands: Pending;
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
 * Непрозрачная — поля читает только кит. Это имя и опции, а не описание
 * Инструмента: описания встроенных наружу не выходят (ADR-0058, п. 10.3).
 */
export interface ConfiguredTool<Name extends ToolName = ToolName> {
  /** Метка записи: по ней `tools` отличает Настроенный Инструмент от своего. */
  readonly configured: true;
  readonly name: Name;
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Настроить встроенный Инструмент прямо в `tools`:
 *
 * ```tsx
 * <RichTextEditor
 *   tools={[...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h", levels: [2, 3] })]}
 * />
 * ```
 *
 * Запись включает Инструмент и без имени в `tools`; если в `tools` есть и голое
 * имя (из пресета), побеждает Настроенный Инструмент. Две записи `tool()` с
 * одним именем — ошибка набора. Место на поверхности не меняется: оно
 * определяется порядком кита. Передавать нужно только те опции, которые
 * меняются, остальные берутся из умолчаний.
 *
 * Опции читаются один раз, вместе с набором, при создании движка. Чтобы сменить
 * их на лету, пересоздайте Редактор через `key`. Неверное значение встроенной
 * опции (из JS без типов) заменяется умолчанием, в разработке — один
 * `console.error`.
 *
 * Принимает только имя Инструмента с опциями: `search` и `toc`. Серверно-безопасна.
 */
export function tool<Name extends ConfigurableToolName>(
  name: Name,
  options?: ToolOptionsInput<OptionsOf<Name>>
): ConfiguredTool<Name> {
  return { configured: true, name, options: options ?? {} };
}

/** Запись `tools` — Настроенный Инструмент. `null` и строки — нет. */
export function isConfiguredTool(entry: unknown): entry is ConfiguredTool {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as { configured?: unknown }).configured === true
  );
}
