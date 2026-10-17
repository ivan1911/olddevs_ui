import { forwardRef, useId, useMemo, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";
import { BlockIsland } from "./ui/BlockIsland.js";
import { CodeCopyIsland } from "./features/code/CodeCopyIsland.js";
import { hasCodeBlocks, withCodeHeaders } from "./features/code/codeHeader.js";
import { MathIsland } from "./features/mathematics/MathIsland.js";
import { hasMath, withMathSource } from "./features/mathematics/mathHtml.js";
import { mathOptionsOf } from "./features/mathematics/mathOptions.js";
import { VideoIsland } from "./features/video/VideoIsland.js";
import { videoAutoloadOf } from "./features/video/videoOptions.js";
import { hasVideoBlocks } from "./features/video/videoSrc.js";
import type { ToolEntry } from "./core/customTool.js";
import { proseClass } from "./styles/prose.js";
import { surfaceAttributes, type RichTextSurface } from "./styles/surface.js";
import { islandsFor } from "./core/viewIsland.js";

export interface RichTextViewProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "dangerouslySetInnerHTML"
> {
  /**
   * The saved Document: an HTML string in the Editor's format.
   *
   * **NOT SANITIZED.** The string is put into the markup as is, through
   * `dangerouslySetInnerHTML`: the component expects HTML that your server has already cleaned
   * against the Schema's allowlist. A user-supplied string that has skipped server-side
   * sanitization is an XSS hole on your page. Sanitize it with
   * `sanitizeRichText(html, DOMPurify)` from `@olddevs/ui/editor/schema`.
   */
  html: string;
  /**
   * The Document's surface: `"theme"` (default) — in the app's theme; `"paper"` — a light Paper
   * in any theme, for emails, print and PDF. As with `RichTextEditor`, one Document on Paper
   * looks the same in the Editor and in the View.
   */
  surface?: RichTextSurface;
  /**
   * The Document's custom Tools — the same array as for `RichTextEditor` and `sanitizeRichText`; a
   * Configured Tool (`tool()`) is allowed in it. The View reads the Islands of custom Blocks from
   * it (`blocks[name].island`): a Block that has one and is present in the Document comes alive as
   * a client component, while the Block's server HTML is visible before loading and without JS. The
   * View also takes the formula options — `tool("mathematics", { macros })`, so that a macro works
   * in the View the same way as in the Editor; the formulas themselves need not be named in `tools`
   * for this, they are rendered for any Document with formulas. It also takes the video `autoload`
   * option, per service: `tool("youtube", { autoload: false })` keeps the "Play" placeholder
   * instead of the player; without the option the player appears at once. The rest of the
   * descriptor is not needed by the View. Without `tools`, and for a Document with no such Blocks
   * and formulas, the View works as before and pulls in no client code.
   */
  tools?: readonly ToolEntry[];
}

/**
 * A short fingerprint of a string — FNV-1a over the code units, plus the length. Islands need it
 * only to notice that the Document has changed; there is no cryptography here.
 */
function fingerprint(html: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    hash ^= html.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${html.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * View of a saved Document: the same typography as in the Editor, and no engine.
 *
 * WHY A SEPARATE COMPONENT RATHER THAN THE EDITOR'S `readOnly`. `readOnly` keeps Tiptap and
 * ProseMirror alive for a page that only displays content, and that costs 130–170 kB gzipped to
 * load. Here the module graph has neither Tiptap nor lowlight: the component works for server
 * rendering and carries no `"use client"` (ADR-0029, ADR-0050). The module graph is guarded by
 * `tests/rich-text-view.test.tsx`.
 *
 * THE "COPY" BUTTON ON CODE BLOCKS IS A CLIENT PIECE. The component itself stays on the server:
 * it emits HTML with the Block headers (the language label and an empty mount point —
 * `withCodeHeaders`) and renders next to it the `CodeCopyIsland`, which inserts the buttons into
 * the mount points after mounting. Only if a code Block is present (`hasCodeBlocks`): a
 * text-only Document needs no island — neither a label in the markup nor an effect on the
 * client. The island is a separate file with its own directive, so the client boundary runs
 * along it, not along `RichTextView`. There is no prop to turn it off: the button is always
 * there (the owner's decision).
 *
 * THE ISLAND OF A CUSTOM BLOCK IS THE SECOND ONE, AND THE SAME (`BlockIsland`). `tools` is not
 * sent to the client whole: `islandsFor` takes from the descriptors only the Islands of Blocks
 * that are present in the Document, and passes the island the references to its client
 * components and the names of the declared attributes. No such Block — no island, and the
 * consumer's island code is not loaded. The server HTML of the Block always arrives; the Island
 * replaces it after mounting.
 *
 * THE FORMULA ISLAND IS THE THIRD (ADR-0070, `MathIsland`). A formula sits in the Document as an
 * empty element with `data-latex`; the server writes the source LaTeX into it (`withMathSource`),
 * so without JS the reader sees it. The island exists only if a formula is in the Document
 * (`hasMath`); it loads KaTeX and its CSS through a lazy `import()` and draws the formulas in
 * place, in a chunk that a page without formulas never receives.
 *
 * THE VIDEO ISLAND IS THE FOURTH, AND THE SAME (`VideoIsland`, ADR-0071). A video Block arrives in
 * the HTML as a link (`div[data-block="video"]` with a link inside), which the reader sees without
 * JS. If the Block is in the Document (`hasVideoBlocks`), the island puts the service's player in
 * its place right after mounting (an `iframe` with `loading="lazy"`). The option
 * `tool("youtube", { autoload: false })` in `tools` brings back the kit's placeholder with a "Play"
 * button: the player appears after a click, and until then not a single request goes to the
 * service. No Block — no island, and the player's code is not loaded.
 *
 * HOOKS — `useId` and `useMemo`, both allowed in server components. The identifier links the
 * island to its mount points and is the same on the server and the client; `useMemo` keeps the
 * markup object stable (see below). The component has no state and no effects.
 *
 * TYPOGRAPHY — `proseClass(surface)`, the same module that sets the classes on the Editor's
 * content. The classes sit on the container and find tags by name, so the Document's HTML has no
 * classes or `style`, and the sanitizer need not allow them; the code Block header is the
 * component's own markup, assembled after sanitization.
 */
export const RichTextView = forwardRef<HTMLDivElement, RichTextViewProps>(function RichTextView(
  { html, surface = "theme", tools, className, ...rest },
  ref
) {
  const hostId = useId();
  const islands = islandsFor(tools, html);
  const code = hasCodeBlocks(html);
  const math = hasMath(html);
  const video = hasVideoBlocks(html);
  // Every island needs the fingerprint, but it is computed over the whole HTML: once per render,
  // and only if an island exists; otherwise text without islands would pay for it for nothing.
  const docKey = code || islands[0] || math || video ? fingerprint(html) : "";
  // One object per pair (Document, view): React compares `dangerouslySetInnerHTML` by reference,
  // and a new object makes it rewrite `innerHTML` — along with the buttons and Islands that the
  // islands inserted through portals. A parent re-render with the same Document (a new
  // `className`, a new `tools` literal) must not touch the markup.
  const inner = useMemo(
    () => ({ __html: withMathSource(withCodeHeaders(html, hostId)) }),
    [html, hostId]
  );
  return (
    <>
      <div
        ref={ref}
        className={cn(proseClass(surface), className)}
        {...surfaceAttributes(surface)}
        {...rest}
        dangerouslySetInnerHTML={inner}
      />
      {/* Only a Document with code needs this island; text without code Blocks does not. */}
      {code && <CodeCopyIsland hostId={hostId} docKey={docKey} />}
      {/* Custom Block islands too — only for a Document where such a Block exists. */}
      {islands[0] && <BlockIsland islands={islands} docKey={docKey} />}
      {/* The formula island is the third: only for a Document with formulas (it loads KaTeX). */}
      {math && <MathIsland docKey={docKey} options={mathOptionsOf(tools)} />}
      {/* The video island (ADR-0071) too — only for a Document with a video Block. */}
      {video && <VideoIsland docKey={docKey} autoload={videoAutoloadOf(tools)} />}
    </>
  );
});
