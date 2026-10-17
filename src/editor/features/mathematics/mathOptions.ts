import {
  configuredBuiltins,
  repeatedConfigured,
  resolveToolOptions,
  type MathematicsToolOptions,
} from "../../core/toolOptions.js";
import type { ToolEntry } from "../../core/customTool.js";
import { devError } from "../../../lib/dev-warn.js";

/*
  Formula options (ADR-0070): the defaults, the checks of values and the reading of
  options from `tools`. The module is safe for the server, with no Tiptap and KaTeX: the
  Tool's descriptor takes the defaults from here, and `RichTextView` on the server takes
  the options for its Island.
*/

/**
 * The KaTeX options that the screen sets (`tool("mathematics", …)`); the defaults are
 * the kit's.
 */
export type MathRenderOptions = Pick<MathematicsToolOptions, "macros" | "strict">;

/** The defaults: no macros, and non-LaTeX input is accepted silently (unlike KaTeX's `"warn"`). */
export const MATH_DEFAULTS: MathematicsToolOptions = { macros: {}, strict: "ignore" };

const STRICT_VALUES: readonly unknown[] = ["ignore", "warn", "error"];

/** The checks of Tool option values by field name, one per field of `MATH_DEFAULTS`. */
export const MATH_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  // A KaTeX macro name is a control sequence: `\RR`, `\d`. KaTeX silently ignores any
  // other key, so a value with such a key is a typo in the screen's code.
  macros: (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([name, body]) => /^\\./.test(name) && typeof body === "string"),
  strict: (value) => STRICT_VALUES.includes(value),
};

/**
 * Formula options from `tools`: the `tool("mathematics", …)` entry over the defaults. They are
 * read by the same `resolveToolOptions` as the Editor (`expandTools`): a value that fails the
 * check is replaced with the default, with the same `console.error` in development; without an
 * entry, the defaults. Two `tool("mathematics")` entries are a mistake in the list that stops the
 * Editor from starting; the View does not select the "first" one, but takes the defaults and
 * reports it. `RichTextView` reads the formulas with them the same way the Editor does: a macro
 * given to the Editor works in the View too.
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
