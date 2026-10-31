---
component: MarkdownView
exports: [MarkdownView]
category: content
status: stable
source: src/components/content/MarkdownView.tsx
story: src/components/content/MarkdownView.stories.tsx
---

# MarkdownView

## Summary for AI

`MarkdownView` presents complete or growing Markdown answers with the kit's typography, safe links and copyable code. Import it from `@olddevs/ui/markdown`; it is not exported from `@olddevs/ui`. It owns no transport, message history or AI runtime.

## When to use

- A consumer supplies an untrusted Markdown answer, either a full string or the latest accumulated streaming string.
- Readers need paragraphs, lists, emphasis, links, quotes, GFM tables and code with copying.

This family was developed for a future consumer using an isolated chat prototype (ADR-0048/0085). The first real product may expose API needs that the prototype did not establish.

## When not to use

- Plain message text: put it directly in [ChatMessage](chat-message.md); Markdown is optional.
- Editing a document: use [RichTextEditor](../inputs/rich-text-editor.md).
- Displaying the Editor's sanitized HTML: use [RichTextView](rich-text-view.md).
- Interactive charts, media, mathematical typesetting, HTML or Mermaid execution: these are outside this component's first-wave contract.

## Minimal example

```tsx
import { MarkdownView } from "@olddevs/ui/markdown";

<MarkdownView content={accumulatedAnswer} streaming={isResponding} />;
```

Your app replaces `content` with the full accumulated string, not just the next token. `streaming` marks the presentation as growing; it does not open a connection, schedule updates or change the parser. The component creates no live region and does not announce tokens.

## Public API

| Prop                                     | Meaning                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content: string`                        | Markdown text. The component parses the latest complete value on each render.                                                                                                                      |
| `streaming?: boolean`                    | Whether the answer is still growing; defaults to false. Parsing and URL policy are identical in either state.                                                                                      |
| `className?: string`                     | Classes for the outer typography container. It has no default background.                                                                                                                          |
| `renderCode?(code, language): ReactNode` | Optional trusted highlighting nodes inside the kit-owned CodeView. `code` is the semantic plain string; `language` is the fence label or undefined. Return null/undefined/false to use plain code. |

There is no parser, plugin, components or URL-transform override. This keeps the HTML/URL boundary owned by the component. `renderCode` is trusted application code, not a sandbox: do not execute the answer or render its raw text using `dangerouslySetInnerHTML`.

The package brings `react-markdown` and `remark-gfm` itself; the consumer installs no Markdown engine separately. The separate entry keeps the parser out of an ordinary `Button` bundle. It does not remove the dependency from the package download or promise zero module-resolution work in a bundler.

## Incomplete Markdown

The same CommonMark/GFM parser handles streaming and completed strings. No heuristic closing markers are inserted.

| Partial input                        | Visible result                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Unclosed code fence                  | The code received so far, with CodeView copying.                                                                        |
| Unclosed emphasis                    | Literal markers until the parser recognizes completed emphasis.                                                         |
| Unclosed link label or destination   | Literal opening markers. GFM can autolink a partial URL inside the unfinished destination; the same URL policy applies. |
| Incomplete table separator           | Literal paragraph until the table header/separator is recognized.                                                       |
| Recognized table with unfinished row | A table; the unfinished cell can be empty.                                                                              |

Switching `streaming` off does not repair an interrupted answer or discard received text. The consumer owns the interrupted message state. Completing syntax may change text into links, emphasis or a table and change height. [ChatTranscript](chat-transcript.md) owns following/pause behavior; this component does not scroll or move focus. Existing code copy actions stay mounted while their block grows.

## HTML, links and unsupported content

Raw HTML is ignored, with no raw-HTML plugin. Source tags are never inserted as DOM elements. Code containing HTML stays code.

Links permit `http:`, `https:`, `mailto:`, relative paths and fragments. Protocol-relative URLs beginning with `//`, backslashes, control characters, malformed percent escapes and other schemes are rejected, including entity/percent-obfuscated forms. Validation checks a decoded value but preserves the allowed URL string for navigation. Rejected links show their label without a link. Relative links use the consumer page's base URL; the component does not validate the destination's trustworthiness or the truth of linked content. Links navigate in the current browsing context.

Markdown images produce text such as `[Image: description]` or `[Image]`, using the message catalog. They create no image element or image request. Formulas remain literal text; a Mermaid fence is plain copyable code. No math, diagram or highlighting engine is required.

## Code, copying and optional highlighting

Every block reuses [CodeView](code-view.md) with its existing CopyButton. Copying uses the semantic plain code string from the parser, preserving leading spaces and intentional trailing blank lines. It excludes fence markers and the parser's one presentation newline. Markdown indentation and line-ending normalization can therefore differ from byte-for-byte source Markdown.

The clipboard never reads decorative nodes, line numbers or DOM text. The optional callback supplies only the display layer:

```tsx
import { MarkdownView } from "@olddevs/ui/markdown";
import { highlightCodeNodes } from "@olddevs/ui/editor/highlight";

<MarkdownView
  content={answer}
  renderCode={(code, language) => highlightCodeNodes(code, language ?? "")}
/>;
```

`renderCode` is a client callback. With React Server Components, define it in a client wrapper rather than passing a function across the server/client boundary. Plain `content` can be supplied as server data.

That helper is a separate opt-in import with its own engine installation requirements; see [CodeView](code-view.md#kit-highlighting). MarkdownView does not import it. A highlighter returning an HTML string must be adapted to trusted React nodes before use.

## Accessibility and keyboard

- Paragraphs, lists, links, quotes and tables retain semantic elements. Table columns/rows follow the Markdown source.
- Table overflow is a named focusable region. Tab reaches it and CodeView's horizontal scroll area; native scrolling lets keyboard users read wide content.
- Copy is a visible named button available with keyboard and touch, not only on hover.
- There is no token live region, automatic focus transfer or screen-reader announcement in MarkdownView. A chat recipe provides a separate polite status for lifecycle events.
- Source text and code use theme tokens in light, dark and dim. Optional highlight colors remain the consumer's responsibility.

## Limits and anti-patterns

- Do not import this family from the package root or from internal source files.
- Do not stream token-sized additions as `content` without accumulating them outside the component.
- Do not execute raw code, HTML or diagram text in the highlighting callback.
- Do not treat a rendered safe-scheme link as verification of its destination or of a source claim.
- Do not assume a virtualized or unbounded history: every changed answer is reparsed, and this component has no truncation or pagination. Large answers and tables require consumer measurement; prototype timings are not production guarantees.

The integrated production measurement on 2026-10-31 used a minified React bundle,
kit CSS, Chromium 153.0.8010.12 on Apple M5 Pro / Darwin 27.2.0, 1280×900,
three warmups and ten retained samples. The reply fixture repeats paragraphs,
links, GFM tables and fenced code. A separate public renderer probe appended
29 characters to an existing long reply and measured its synchronous React
commit, including reparsing; it did not measure appending to a new short reply.

| Existing reply size       | Changed-reply commit P50 / P95 |
| ------------------------- | -----------------------------: |
| 5,000 characters          |                   3.8 / 6.0 ms |
| 20,000 characters         |                 14.9 / 17.8 ms |
| 50,000 characters, stress |                 40.8 / 42.2 ms |

The normal single-reply fixture stops at 20,000 characters. This is a tested
configuration, not a hard length cap or an update-rate SLA; the 50,000-character
case is stress evidence. Full parsing of a changed complex answer can exceed a
frame budget, so coalesce incoming deltas in the consumer and measure its real
syntax and update frequency. Unchanged completed bodies should stay stable
while editing a draft, as the [integrated recipe](../../recipes/integrated-chat.md)
demonstrates. The [history measurements](chat-transcript.md#volume-and-limits)
cover simple and mixed histories separately; none implies virtualization.

## Chat example

```tsx
import { ChatMessage } from "@olddevs/ui";
import { MarkdownView } from "@olddevs/ui/markdown";

<ChatMessage author="Assistant" speaker="assistant" state={isResponding ? "streaming" : "complete"}>
  <MarkdownView content={answer} streaming={isResponding} />
</ChatMessage>;
```

See [Text chat recipe](../../recipes/chat.md) for consumer-owned history and lifecycle. The standalone `InChat` story composes the renderer with the message and reading viewport; it needs no backend.

## Source, tests and showcase

- [Source](../../../src/components/content/MarkdownView.tsx)
- Public rendering/security/copy tests: `tests/markdown-view.test.tsx`
- Entry contract tests: `tests/markdown-entry.test.ts`
- Consumer import isolation: `scripts/check-markdown.mjs`, run by `npm run check:markdown` and the release gate in the source repository
- Browser checks: `tests-visual/markdown.spec.ts`
- Storybook: `Content/MarkdownView` (`src/components/content/MarkdownView.stories.tsx`): SupportedContent, StreamingFragments, UnsupportedContent, CustomHighlight, InChat and WideContent.
