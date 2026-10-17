---
component: CodeView
exports: [CodeView]
category: content
status: stable
source: src/components/content/CodeView.tsx
story: src/components/content/CodeView.stories.tsx
---

# CodeView

## Summary for AI

`CodeView` is a code viewer: a JSON API response, a YAML config, a webhook body. **It does not highlight by itself**: `code` is required plain text, `children` is optional markup. The kit's highlighting, with the same theme as in the Editor, comes from `highlightCodeNodes(code, language)` in `@olddevs/ui/editor/highlight` — put its result into `children`; you can also bring your own highlighter.

## When to use

- You need to show code or data as is: an API response, a configuration, a filter expression.
- The user needs to copy it whole.

## When not to use

- The code has to be **edited** — that is a different component, not an axis of this one. A code editor requires Monaco or CodeMirror, and the conversation starts with a decision, not with a prop.
- If you show a short identifier inline, use `Kbd` or `CopyButton` next to the text.

## Minimal example

```tsx
<CodeView code={JSON.stringify(response, null, 2)} title="response.json" copyable lineNumbers />
```

With the kit's highlighting — the helper from the `@olddevs/ui/editor/highlight` entry point (the "Kit highlighting" section):

```tsx
import { highlightCodeNodes } from "@olddevs/ui/editor/highlight";

<CodeView code={source} title="main.py" copyable>
  {highlightCodeNodes(source, "python")}
</CodeView>;
```

With your own highlighter — also as **nodes**, not an HTML string:

```tsx
// Shiki: codeToHast + hast-to-jsx. Prism: tokenize. Both return nodes.
<CodeView code={source} title="response.json" copyable>
  {highlightToNodes(source)}
</CodeView>
```

## Public API

- `code` — **always required**, even when markup is passed. The line count is computed from it, and the content to copy is taken from it.
- `children` — highlighted markup: the kit's `highlightCodeNodes` or your own highlighter; without it, `code` is rendered as is.
- `title` — the panel title; without it and without `copyable` there is no header at all.
- `copyable` — a copy button in the header, the ready-made `CopyButton`.
- `lineNumbers` — line numbering. Works **only with plain `code` and only without `wrap`**: see below.
- `wrap` — wraps long lines; without it there is horizontal scrolling, and the scroll area is keyboard-focusable.

## Trust boundary: the consumer is fully responsible for the markup

`children` is rendered as is, through the ordinary React path. The caveat is
needed because the main highlighter APIs return an **HTML string**, not nodes:
Shiki `codeToHtml`, Prism `highlight`, highlight.js `highlightAuto().value`.
The only way to put such a string here is `dangerouslySetInnerHTML`.

Then the consumer alone decides whether the markup can be trusted, while `code` in this
component is usually **untrusted**: ADR-0039 itself names its scenarios — an API
response, a webhook body. Sanitization is not part of the highlighter or of
the kit.

The safe path is nodes, not a string: the kit's `highlightCodeNodes`, Shiki's
`codeToHast`, Prism's `Prism.tokenize`. The examples above are written exactly
this way.

## Size limit

`lineNumbers` renders one DOM node per line. Measured: a megabyte of code is 4 nodes without
numbering and more than fifteen thousand with it, and the main thread is
noticeably blocked. On files of thousands of lines, turn numbering off; the consumer
truncates an input that is too large itself: the component is a viewer, not
an editor, and has no virtualization.

## Kit highlighting

`highlightCodeNodes(code, language)` from the `@olddevs/ui/editor/highlight`
entry point colors code with the same grammar and the same theme as the code block in
the [Editor](../inputs/rich-text-editor.md) and [`RichTextView`](rich-text-view.md):
GitHub Light in the `light` theme, GitHub Dark in `dark` and `dim`. The theme
follows the nearest ancestor with `data-theme`, so `CodeView` on a nested light
Paper (`surface="paper"`) inside a dark app is light.

```tsx
// A server component: highlighting does not end up in the client bundle.
import { CodeView } from "@olddevs/ui";
import { highlightCodeNodes } from "@olddevs/ui/editor/highlight";

export function Webhook({ body }: { body: string }) {
  return (
    <CodeView code={body} title="payload.yaml" copyable>
      {highlightCodeNodes(body, "yaml")}
    </CodeView>
  );
}
```

- **Languages** — the same as in the Editor: Python, TypeScript, JavaScript, Go,
  HTML, JSON, YAML, Markdown. Case and spaces do not matter, aliases (`py`, `ts`,
  `js`, `golang`, `htm`, `yml`, `md`) are resolved to the name. For an unknown
  language and for empty code the helper returns `null`: `children` is empty,
  and `CodeView` renders the code as is — with line numbers, if they are on.
- **Nodes, not a string.** Code becomes React text nodes, tokens become `span`
  with `hljs-…` classes; markup inside the code stays text. The helper has no
  hooks and no `"use client"`: it can be called in both a server component and a client
  component.
- **The block background belongs to the highlight theme.** GitHub colors do not
  reach a 4.5:1 contrast ratio on the kit's code background, so under the kit's tokens the code area
  takes the theme background. The helper puts a `data-code-highlight` marker on
  the token root, and `CodeView` turns the background on only when it is present: markup from
  your own highlighter, even with the same `hljs-…` classes, is not recolored.
- **There are no line numbers with highlighting** — by the same rule as for any
  markup (the section below).
- **Cost.** `CodeView` itself and the main `@olddevs/ui` entry point do not import the
  highlighter. Lowlight, the highlight.js core and eight grammars — 22.6 kB
  gzip — are included only for whoever imports `@olddevs/ui/editor/highlight`; you need
  to install `lowlight` and `highlight.js` for it (Editor engine packages,
  not in the kit's manifest).

Why a helper and not a `language` prop: there is no conditional import, and a
prop would keep the highlighter in the main entry point's graph for every consumer of
the kit. The boundary is
ADR-0039,
narrowed by ADR-0052.

Your own highlighter (Shiki, Prism) still goes into `children` — then the
consumer chooses the theme and background, and the kit does not touch them.

## Why `code` is required even with markup

Copying takes the string, not the DOM. Copying from the markup would drag line
numbers and highlight token boundaries into the clipboard — that is, text that
does not compile.

For the same reason the line count is computed from `code`: a gutter that derives its line count
from the markup drifts from the content on the first highlighter that
wraps a line in two elements.

## Line numbers are not supported with markup or wrapping

With `children` the gutter is not rendered at all, and this is deliberate. The
kit does not know where the line boundaries are in third-party markup: a highlighter
is free to wrap a line in any number of elements. A number next to
the wrong line is worse than no number.

With `wrap`, the reason is the same but the mismatch comes from a different source: a
wrapped line takes two or more visual lines in the text and still one in the number
column. The number lands next to the wrong line, and the last line of code is
left without a number altogether.

All trailing line breaks are trimmed when counting: a file read from disk almost
always ends with at least one, sometimes two. Otherwise each such line break would add an extra
number for an empty line at the end.

## What the kit still does

What the highlighter does not solve and what every consumer would otherwise
write from scratch: wrapping or scrolling instead of clipping, line numbering, a
monospaced font from a typography token, and copying with the ready-made
`CopyButton`.

## Accessibility and semantics

- Line numbers are `aria-hidden` and `select-none`: in speech they are noise, because every line would start with a number, and in the clipboard they are junk. The number column sticks to the left edge: otherwise, when scrolling right, it slides off the edge exactly when it is needed most.
- The horizontal scroll area is focusable (`tabindex="0"`): the keyboard cannot reach content that scrolls only with a pointer — the axe rule `scrollable-region-focusable`.
- The token colors of the kit's highlighting are the GitHub theme, shared with the Editor; axe measures the contrast of each token role in all three themes (the `KitHighlighting` story in `src/editor/CodeViewHighlighting.stories.tsx`). The kit does not color the markup of your own highlighter.
- See `src/components/content/CodeView.tsx`, `src/components/content/CodeView.stories.tsx`, `tests/code-view.test.tsx`; the kit's highlighting — `src/editor/features/code/highlightNodes.ts`, `src/editor/CodeViewHighlighting.stories.tsx`, `tests/code-view-highlight.test.tsx`.
