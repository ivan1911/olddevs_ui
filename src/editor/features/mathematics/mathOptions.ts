import {
  configuredBuiltins,
  repeatedConfigured,
  resolveToolOptions,
  type MathematicsToolOptions,
} from "../../core/toolOptions.js";
import type { ToolEntry } from "../../core/customTool.js";
import { devError } from "../../../lib/dev-warn.js";

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
 * Читает их тем же `resolveToolOptions`, что Редактор (`expandTools`): значение, не
 * прошедшее проверку, заменяется умолчанием с тем же `console.error` в разработке;
 * записи нет — умолчания. Две записи `tool("mathematics")` — ошибка набора, на
 * которой Редактор не стартует; Просмотр не выбирает «первую», а берёт умолчания и
 * сообщает. `RichTextView` читает ими формулы так же, как Редактор: макрос, заданный
 * Редактору, работает и в Просмотре.
 */
export function mathOptionsOf(tools: readonly ToolEntry[] | undefined): MathRenderOptions {
  const configured = configuredBuiltins(tools).filter((entry) => entry.name === "mathematics");
  const twice = repeatedConfigured(configured);
  if (twice) {
    devError(`RichTextView: tool "mathematics": two tool() entries share this name`);
  }
  const { macros, strict } = resolveToolOptions(
    "RichTextView",
    "mathematics",
    MATH_DEFAULTS,
    MATH_CHECKS,
    twice ? undefined : configured[0]
  ) as MathRenderOptions;
  return { macros, strict };
}
