"use client";

import katex, { type KatexOptions } from "katex";
/*
  The KaTeX CSS and fonts ship with this module (ADR-0070, item 9). The kit is built
  with a bare `tsc`, without a bundler, so the CSS is not a file of the package: the
  module imports `katex/dist/katex.min.css` from the consumer's `katex` package, and
  the consumer's bundler (Next.js, Vite, webpack) emits the stylesheet itself and
  rewrites `url(fonts/…)` to the fonts of the same package. The module loads only
  lazily, through the Editor's Loader and the `RichTextView` Island (`import()`), so
  styles and fonts stay off pages without formulas: the bundler puts the CSS into the
  same lazy chunk. The consumer has no extra step: it installs `katex` with the same
  command as Tiptap (see the Editor page).
*/
import "katex/dist/katex.min.css";
import type { MathRenderOptions } from "./mathOptions.js";

export { katex };

/**
 * KaTeX options for one formula.
 *
 * `throwOnError` is on: the Editor and the Island catch the error themselves and show
 * the source with a mark, while the popover's preview writes it into the field. `output`
 * is HTML and MathML (ADR-0070, item 8): a screen reader reads MathML, not a set of loose
 * `span`s. `trust` is off (the default): `\href`, `\url` and `\includegraphics` from
 * someone else's Document do not work. `maxSize` limits `\rule` and spaces, so a formula
 * such as `\rule{9999em}{9999em}` does not stretch the reader's page. `maxExpand` is the
 * cap on macro expansion in KaTeX, set explicitly (1000, the KaTeX default), so that the
 * limit does not depend on the version of the consumer's package.
 *
 * MACROS ARE A FRESH COPY ON EVERY RENDER. `\gdef` in a formula writes into the `macros`
 * object that KaTeX received, and the macro of one formula would carry over to the next
 * ones. However, the same options are not read by one call only: the Tiptap extension
 * passes one `katexOptions` object to all node views of the Editor, and the popover uses
 * it for its own previews. So `macros` is a getter: KaTeX reads the field on every render
 * (`new Settings(options)`) and gets a new object, so the formulas of the Editor, of its
 * popover and of the `RichTextView` Island do not share a `\gdef`. A copy of the options
 * taken once (`{ ...options }`) evaluates the getter once, so the copy must be made before
 * every call.
 */
export function katexOptionsFor(options: MathRenderOptions, display: boolean): KatexOptions {
  return {
    displayMode: display,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: options.strict,
    get macros() {
      return { ...options.macros };
    },
    maxSize: 50,
    maxExpand: 1000,
  };
}

/**
 * The KaTeX error message without the "KaTeX parse error:" prefix: the phrase goes into the
 * field after our "Invalid LaTeX" message. An error that is not from KaTeX (a render failure)
 * is used as its own text.
 */
export function mathErrorDetail(error: unknown): string {
  const raw = (error as { rawMessage?: unknown } | null)?.rawMessage;
  const message =
    typeof raw === "string" ? raw : error instanceof Error ? error.message : String(error);
  return message.replace(/^KaTeX parse error:\s*/, "");
}
