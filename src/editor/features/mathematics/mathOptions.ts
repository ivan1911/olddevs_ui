import {
  isConfiguredTool,
  mergeOptions,
  type MathematicsToolOptions,
} from "../../core/toolOptions.js";
import type { ToolEntry } from "../../core/customTool.js";

/*
  Опции формул (ADR-0070): умолчания, проверки значений и чтение опций из `tools`.
  Модуль серверно-безопасен, без Tiptap и KaTeX: описание Инструмента берёт отсюда
  умолчания, а `RichTextView` на сервере — опции для своего Острова.
*/

/** Опции KaTeX, которые задаёт экран (`tool("mathematics", …)`); умолчания — кит. */
export type MathRenderOptions = Pick<MathematicsToolOptions, "macros" | "strict">;

/** Умолчания: макросов нет, не-LaTeX ввод принимается молча (в отличие от `"warn"` у KaTeX). */
export const MATH_DEFAULTS: MathematicsToolOptions = { macros: {}, strict: "ignore" };

const STRICT_VALUES: readonly unknown[] = ["ignore", "warn", "error"];

/** Проверки значений Опций по имени поля — по одной на поле `MATH_DEFAULTS`. */
export const MATH_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  // Имя макроса KaTeX — управляющая последовательность: `\RR`, `\d`. Остальные ключи
  // KaTeX молча не использует, и значение с таким ключом — опечатка экрана.
  macros: (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([name, body]) => /^\\./.test(name) && typeof body === "string"),
  strict: (value) => STRICT_VALUES.includes(value),
};

/**
 * Опции формул из `tools`: запись `tool("mathematics", …)` поверх умолчаний.
 * Значение, не прошедшее проверку, заменяется умолчанием — как в Редакторе
 * (`expandTools`); записи нет — умолчания. `RichTextView` читает ими формулы так
 * же, как Редактор: макрос, заданный Редактору, работает и в Просмотре.
 */
export function mathOptionsOf(tools: readonly ToolEntry[] | undefined): MathRenderOptions {
  const configured = (tools ?? []).find(
    (entry) => isConfiguredTool(entry) && entry.name === "mathematics"
  );
  const given = Object.entries(isConfiguredTool(configured) ? configured.options : {}).filter(
    ([key, value]) => value !== undefined && MATH_CHECKS[key]?.(value) === true
  );
  const { macros, strict } = mergeOptions(
    MATH_DEFAULTS,
    Object.fromEntries(given)
  ) as MathRenderOptions;
  return { macros, strict };
}
