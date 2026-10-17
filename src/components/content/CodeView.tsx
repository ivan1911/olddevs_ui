"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { CopyButton } from "../actions/CopyButton.js";

export interface CodeViewProps {
  /**
   * The source as plain text, without markup. Required even when `children` is passed, and that is
   * not redundant:
   *
   * - the line count for the gutter is taken from it: a gutter that counted lines from
   *   the markup would drift out of sync with the content on the first highlighter that
   *   wraps a line in two elements;
   * - the text copied to the clipboard also comes from it. Copying from the DOM would
   *   carry line numbers and highlight token boundaries into the clipboard, that is,
   *   text that does not compile.
   */
  code: string;
  /**
   * Highlighted markup, an optional display layer.
   *
   * The consumer passes here what its highlighter returned: either its own, or
   * `highlightCodeNodes` from `@olddevs/ui/editor/highlight`, which gives the kit's
   * highlighting the same theme as in the Editor (ADR-0052).
   * Without it, `code` is rendered as is, in a monospace font and without highlighting.
   * The component does not import a highlighter itself (ADR-0039).
   */
  children?: ReactNode;
  /** Panel title: a file name, a request URL. Without it, there is no header at all. */
  title?: ReactNode;
  /** Copy button in the header. */
  copyable?: boolean;
  /**
   * Line numbers.
   *
   * Works only together with plain `code`, and only without `wrap`. When markup is passed,
   * the kit does not know where its line boundaries are: a highlighter may wrap a line in
   * any number of elements, and wrapping a long line adds height to it that the adjacent
   * number column cannot anticipate. A number next to the wrong line is worse than no
   * number, so with `children` the gutter is not rendered.
   */
  lineNumbers?: boolean;
  /**
   * Line wrapping.
   *
   * Without it, the code gets a horizontal scrollbar instead of being clipped: a clipped
   * line of code silently drops the very thing it was opened to show.
   */
  wrap?: boolean;
  /** Classes for the root element. */
  className?: string;
}

/**
 * Code viewer: a JSON response, a YAML config, a webhook body.
 *
 * A VIEWER, NOT AN EDITOR, and the component does not do highlighting itself. A highlighter
 * is Shiki, Prism, highlight.js or Monaco, and any of them would ship with the kit to every
 * consumer because of one peripheral component (ADR-0072). The argument of ADR-0032 against
 * the chart layer applies word for word: a wrapper would not remove a library or a dependency
 * from the consumer, it would only add a layer. One more layer would be added on top of that:
 * the highlighter's theme is a second color system next to the kit's tokens, and keeping the
 * two in agreement would be an endless job.
 *
 * The boundary is recorded in ADR-0039.
 * The kit's own highlighting arrives the same way, through the `children` layer: the
 * `highlightCodeNodes` helper lives in the `@olddevs/ui/editor/highlight` subpath, and
 * lowlight is shipped only to whoever imported it (ADR-0052).
 *
 * WHAT THE KIT DOES ANYWAY: the things a highlighter does not solve and that every consumer
 * would otherwise write again: wrapping or scrolling instead of clipping, line numbers that
 * stay out of both the selection and the copy, a monospace font from a token, and copying
 * via the existing `CopyButton`.
 *
 * LINE NUMBERS are `aria-hidden` and `select-none`. In speech they are noise, since every
 * line would start with a number, and in the clipboard they are garbage: copied code with
 * numbers does not compile. The number column sticks to the left edge: without that, it
 * would scroll out of view when the content is scrolled to the right, exactly when it is
 * most needed.
 */
export function CodeView({
  code,
  children,
  title,
  copyable = false,
  lineNumbers = false,
  wrap = false,
  className,
}: CodeViewProps) {
  /*
    The gutter exists only when `code` is plain AND there is no wrapping.

    Both reasons are named in the prop's doc comment, but the condition checked only the first.
    Wrapping adds height to a line that the adjacent number column cannot anticipate, and the
    number lands next to the wrong line, which is worse than no number at all.
  */
  /*
    ONE predicate "markup is present" for both places.

    The gutter condition checked strict `undefined`, while the render below used nullish
    coalescing (`children ?? code`), and the two disagreed on `null` and `false`:
    `children={null}` rendered the code but silently lost the line numbers, and the idiom
    `{ready && <Highlighted/>}` with a falsy `ready` gave `false ?? code`, that is `false`:
    an empty panel with a title and a copy button.
  */
  const highlighted = hasContent(children);
  const gutter = lineNumbers && !highlighted && !wrap;

  /*
    The line count comes from `code`, not from the children, and is computed ONLY when the
    gutter is needed: without numbering, the content goes into the markup as a single node,
    and an array built for a multi-megabyte JSON would be pure waste on every render.

    All trailing newlines are stripped: a file read from disk almost always ends with at least
    one, sometimes two, and each would produce an extra number for an empty last line.
  */
  const lines = gutter ? code.replace(/\n+$/, "").split("\n") : [];

  return (
    <div
      className={cn("border-line bg-bg-1 overflow-hidden rounded-md border font-mono", className)}
    >
      {(title != null || copyable) && (
        <div className="border-line bg-bg-2 flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-fg-0 min-w-0 truncate text-[13px] font-semibold">{title}</span>
          {copyable && <CopyButton value={code} size="sm" variant="ghost" />}
        </div>
      )}

      {/*
        The scrollable area must be focusable: keyboard users cannot reach content that can
        be scrolled only with a pointer. This is the axe rule `scrollable-region-focusable`,
        and it matters all the more because scrolling is the only way to read a long line here.
      */}
      {/*
        The highlighting theme's background applies only under the kit's tokens (ADR-0052).
        The `highlightCodeNodes` helper puts a `data-code-highlight` marker on the root of the
        tokens; the component does not import the helper and recognizes it only by the marker.
        GitHub's colors do not reach the 4.5:1 contrast ratio on the kit's code background,
        so the background comes from the theme, as it does for a code Block in a Document.
        Markup from someone else's highlighter carries no marker, and its background is not changed.
      */}
      <div
        tabIndex={wrap ? undefined : 0}
        className={cn(
          "flex text-[13px] has-[[data-code-highlight]]:bg-(--rte-code-block-background)",
          wrap ? "" : "overflow-x-auto"
        )}
      >
        {gutter && (
          <div
            aria-hidden
            className="text-fg-3 bg-bg-2 border-line sticky left-0 shrink-0 border-r px-3 py-3 text-right tabular-nums select-none"
          >
            {lines.map((_, index) => (
              <div key={index} className="leading-5">
                {index + 1}
              </div>
            ))}
          </div>
        )}

        <pre
          className={cn(
            "text-fg-0 min-w-0 flex-1 px-3.5 py-3 leading-5",
            wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre"
          )}
        >
          <code>{highlighted ? children : code}</code>
        </pre>
      </div>
    </div>
  );
}
