---
component: RichTextToc
exports: [RichTextToc, RichTextTocProps]
category: content
status: stable
source: src/editor/RichTextToc.tsx
story: src/editor/RichTextToc.stories.tsx
sourceHash: 383d395945cc
---

# RichTextToc

## Summary for AI

`RichTextToc` is the Table of contents of a Document, placed next to the View (`RichTextView`) or an Editor in `readOnly`. Collapsed, it is a strip of strokes, one per heading, with the stroke of the current section highlighted. Hovering the strip expands a list of headings; clicking an item scrolls to the heading and moves focus to it. The component is client-side and opt-in: the screen puts it in its own column and passes `target`, a ref to the View or to the Editor's Handle. Headings are read from the target's DOM; the Document has no anchors or `id` attributes, and the page address does not change. It lives in the `@olddevs/ui/editor` entry point. Decision: ADR-0066.

```tsx
import { RichTextToc, RichTextView } from "@olddevs/ui/editor";
```

## When to use

- A long Document in the View: an article, a policy, a description, where the reader needs to jump to a section without scrolling through the whole page.
- An Editor in `readOnly` shows the same long Document and needs the same navigation.

## When not to use

- A short Document: with fewer than two headings the component renders nothing, and on three or four paragraphs a Table of contents only takes up space.
- Navigation between application pages or sections of a site: use `SideNav` or `Tabs`, not the Table of contents of a Document.
- A link to a section that can be shared: the Table of contents goes to a heading without an anchor (`#slug`), and the page address does not change. A link to a section would need its own ADR about `id` in the Schema.
- A Table of contents as part of the Document itself, a Block inside the text: the Schema has no such Block.

## Minimal example

```tsx
"use client";
import { RichTextToc, RichTextView } from "@olddevs/ui/editor";
import { useRef } from "react";

export function Article({ html }: { html: string }) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-start gap-6">
      {/* The screen sets the column and the stickiness, not the component. */}
      <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
        <RichTextToc target={view} />
      </div>
      <RichTextView ref={view} html={html} className="min-w-0 flex-1" />
    </div>
  );
}
```

`RichTextView` stays server-safe here: only the screen's wrapper is client-side, because it needs the `ref`.

## Public API

| Prop        | Meaning                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `target`    | Required. A ref to a `RichTextView` or to the Handle of a `RichTextEditor` whose headings the Table of contents shows. Headings are read after mounting, so there is no strip before hydration.                                            |
| `offsetVar` | The name of the CSS variable with the height of the screen's sticky header, `--topbar-h` by default (`TopBar` publishes it). A jump places the heading below the header, and the highlight counts a section from the header's bottom edge. |
| `listWidth` | The width of the list: a CSS length or pixels, `240` by default. It is fixed rather than sized to the longest heading; a heading that does not fit is truncated with an ellipsis.                                                          |
| `className` | Classes for the root. The remaining `div` props go to the root.                                                                                                                                                                            |

### Which headings are included

- `h1`–`h4` at the top level of the Document and inside a Wrapper.
- Headings in the columns of a Layout are not included: two headings at the same height in neighboring columns confuse the highlight of the current section. Headings inside custom Blocks and their Islands are not included either: their content is part of the Block, not of the Document's structure.
- With fewer than two headings the component renders nothing, and the screen's column stays empty.

The indent of an item and the length of its stroke depend on the level **relative to the largest heading in the Document**: if the Document starts with `h2`, then `h2` has no indent and the longest stroke. The deeper the level, the shorter the stroke.

### A live Document

The list follows the target: a new `html` of the View, a new value of the Editor or an edit rebuilds it through a `MutationObserver` with a short delay. When a second heading appears, the strip appears; when one goes, it disappears. The Editor's Handle provides the Document only once the engine is ready; until then the Table of contents waits and picks it up on its own.

### A long Document

Every heading gets its own stroke. The strip is never taller than the window: when there is not enough room for the strokes, the step between them shrinks. The list has a limited height and scrolls, and the item of the current section stays within its visible part.

### The strip and the list

- The strip is a button labeled "Table of contents" with `aria-expanded`. The stroke of the current section is in the accent color, thicker and slightly longer than the others.
- The list opens when you hover the strip, after a short delay: a cursor passing by accidentally does not open it. A press, a tap, Enter and Space open it immediately.
- The list sits to the right of the strip, over the text. Clicking an item goes to the heading, and the list **stays open**. It closes when the cursor leaves the strip and the list, on Escape and on a press outside it.
- The current section is highlighted both in the strip and in the list (`aria-current="location"`).

### Jumping to a heading

Clicking an item scrolls to the heading (without animation under `prefers-reduced-motion`) and moves focus to it: the next Tab continues from the heading, and a screen reader reads it. While it has focus, the heading gets `tabindex="-1"`; when focus leaves, the attribute is removed, so the Document keeps no trace. The page address does not change, no `id` attributes appear, and the Schema and `sanitizeRichText` stay as they were.

The heading you jump to is briefly highlighted with an accent-colored background that fades out in about a second and a half: the eye finds where the page has scrolled to, even if the heading did not reach the top edge (the end of the Document). The highlight is a Web Animations animation; it writes neither a class nor a `style` into the Document's markup.

The nearest scrollable ancestor of the target scrolls, or the window if there is none.

**An Editor being edited.** If the Editor is switched from `readOnly` to editing, the Table of contents keeps working: the list is rebuilt on edits, and a jump scrolls to the heading and highlights it. Focus does not move to the heading, though, and the caret stays where the author left it: there is no way to focus a heading inside a `contenteditable` without disturbing the caret. This mode is not covered by the contract.

### Sticky header

The component takes the header's height by the contract of ADR-0016: from the CSS variable whose name `offsetVar` carries. If the variable exists, the heading lands exactly below the header, and a section becomes the current one when its heading reaches the header's bottom edge. If it does not, the offset is the heading's `scroll-margin-top`, which the screen can set itself. There is no numeric offset prop: the header's height depends on the breakpoint, and a constant would leave a gap on a narrow screen.

### Narrow screens

If there is no room to the left of the text, the Table of contents hides itself: a strip that overlaps the Document's text or goes past the left edge of the window becomes invisible (`visibility: hidden`) together with its list. It keeps its space in the column, so the screen layout does not jump. When room appears, the strip comes back. This works both for a column next to the text and for the page margin to the left of a centered column (the `Margin` story).

## Accessibility and keyboard

| Key          | Where | Action                                                   |
| ------------ | ----- | -------------------------------------------------------- |
| Enter, Space | strip | Open the list, focus moves to the current section's item |
| ↓ ↑          | list  | Next and previous item                                   |
| Home, End    | list  | First and last item                                      |
| Enter        | item  | Go to the heading, focus moves to the heading            |
| Escape       | list  | Close the list, focus moves to the strip                 |

The list is a `nav` labeled "Table of contents", and its items are buttons in a `ul` list. The list is an overlay in the Escape stack: nested in another overlay, it closes first. Hover and focus do not take focus away from where it is: the list complements the strip rather than taking over control. Labels come from the kit's message catalog (`editor.toc`): "Оглавление" in `ru`, "Table of contents" in the fallback.

## Anti-patterns

- Pointing `target` at a wrapper that holds the View together with neighboring blocks of the page: other headings end up in the Table of contents. Put the ref on the View itself.
- Hiding the Table of contents on a narrow screen with `display: none` on the column while also relying on its self-hiding: self-hiding is for when the column stays but has no room. A column that should not exist on a phone is removed by the screen itself.
- Adding `id` to headings for the sake of the Table of contents: it does not need them, and the Schema will strip them.

## Related sources and Storybook

- Source: `src/editor/RichTextToc.tsx`; heading collection — `src/editor/features/toc/headings.ts`
- Stories: `src/editor/RichTextToc.stories.tsx`
- Tests: `tests/rich-text-toc.test.tsx`; in the browser — `tests-visual/interactions.spec.ts`, the `RichTextToc` block
- Decision: ADR-0066 "The Table of contents of a Document as a separate `RichTextToc` component"
