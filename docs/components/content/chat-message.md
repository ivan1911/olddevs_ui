---
component: ChatMessage
exports: [ChatMessage]
category: content
status: stable
source: src/components/content/ChatMessage.tsx
story: src/components/content/ChatMessage.stories.tsx
---

# ChatMessage

## Summary for AI

`ChatMessage` presents one message as an article with author, optional time,
input method, presentation state, body and actions. It accepts React slots and
does not impose a runtime message format. User bubbles align right with a right tail;
assistant bubbles align left with a left tail. Both shrink to their contents.

## When to use

- Present user and assistant messages in one ordered history.
- Keep metadata and actions readable with plain text or another body renderer.

## When not to use

- A process step with an outcome: use [Timeline](timeline.md).
- An unrelated content panel: use [Card](card.md).
- Markdown parsing: use the separate Markdown renderer; this body is a slot.

## Minimal example

```tsx
import { ChatMessage, CopyButton } from "@olddevs/ui";

<ChatMessage
  author="Assistant"
  speaker="assistant"
  timestamp="16:50"
  dateTime="2026-10-31T16:50:00+03:00"
  inputMethod="voice"
  state="interrupted"
  actions={<CopyButton value={answer} />}
>
  <p>{answer}</p>
</ChatMessage>;
```

## Public API

- Required `author: ReactNode` names the article through the visible author.
- Required `speaker` is `user` or `assistant`; it distinguishes presentation.
- `timestamp` is consumer-provided display content. With `dateTime`, it is a
  semantic time element; without it, the component uses a span and invents no
  machine time. Neither value sorts messages.
- Optional `inputMethod` is `text` or `voice`. Its accessible visible label comes
  from the message catalog.
- `state` defaults to `complete`. `streaming`, `provisional` and `interrupted`
  add catalog labels: “Responding”, “Interim transcript”, “Response interrupted”.
- `groupPosition` defaults to `single`; `first`, `middle` and `last` describe a
  group already computed by the consumer. It changes the corners and tail, not
  message identity, ordering or author/time visibility.
- Required `children` is the body; `actions` holds consumer buttons. Actions
  remain visible and reachable without hover. Empty strings and `false` in
  `timestamp` or `actions` omit their wrappers and spacing; numeric `0` remains
  visible. `className` styles the article.

## Bubble shape and grouping

Short messages use intrinsic width, including the author, time and action slots.
Long text and body renderers are bounded by the available width. A wrapper
reserves a gutter on both sides so decorative tails remain inside a transcript;
`className` still styles the article. Do not remove that gutter by negatively
positioning the entire message outside its reading viewport.

The compact decorative tail continues the body outline without an inner seam;
its geometry does not change the bubble's intrinsic width.

The main corners use the kit's radius tokens and follow the nearest `data-radius`
preset. Only the tail side changes within a group:

| Position | Tail-side corners                                                     | Tail |
| -------- | --------------------------------------------------------------------- | ---- |
| `single` | Open bottom corner joins the tail; other corners keep the main radius | Yes  |
| `first`  | Smaller bottom corner                                                 | No   |
| `middle` | Smaller top and bottom corners                                        | No   |
| `last`   | Smaller top corner; open bottom corner joins the tail                 | Yes  |

The consumer groups **adjacent** messages only when stable author identities
match and both actual timestamps are finite, valid times. The time difference
must be between **0 and 300,000 milliseconds inclusive**. Equal times and exactly
five minutes join. A larger gap, unknown/invalid time, time moving backward or a
different author breaks the group. Evaluate every neighboring pair; a longer
chain can span more than five minutes overall. Do not reorder the input.

`ChatMessage` does not read neighbors, clocks, history or the display timestamp.
The strings `12:00` and `12:00` alone cannot establish a group. If the consumer
cannot establish adjacency/identity/time, pass `single` or omit the prop. A
presentation role such as `assistant` is not an author identity when a product
has several assistants. Metadata and actions remain available on every bubble.

The [chat recipe](../../recipes/chat.md#bubble-groups) and the
`Content/ChatMessage/Bubbles` stories show consumer-owned grouping and compact
gaps between the members of a group. Group spacing belongs to that composition,
not to a DOM-neighbor query in the component.

## Accessibility and state ownership

The visible author labels the article. Body and actions remain in ordinary DOM
reading order. Tails are decorative, hidden from assistive technology and never
focusable. There is no token-level live region or focus movement. Announce
response lifecycle once through a separate consumer status, as in the
[chat recipe](../../recipes/chat.md).

The consumer maps interim transcription to a canonical message, removes a
completely empty interrupted answer and keeps a partial answer. Copy/retry
effects and the availability of actions belong to the consumer; repeating an
answer must not implicitly repeat side-effecting tools.

## Anti-patterns

- Using displayed timestamps to reorder or group consumer messages.
- Inferring author identity from a rendered label or a shared presentation role.
- Treating a voice session as a second copy of an assistant answer.
- Hiding actions behind hover alone.
- Rendering an empty interrupted bubble instead of removing it in the consumer.

## Verification

Source: `src/components/content/ChatMessage.tsx`. Tests: `tests/chat.test.tsx` and
`tests-visual/chat.spec.ts`. Storybook: `Content/ChatMessage`, `MessageStates`.
Bubble behavior: `tests/chat-message-bubbles.test.tsx` and
`tests-visual/chat-message-bubbles.spec.ts`. Focused native-pixel/crop regressions:
`tests-visual/chat-message-tail.spec.ts` (both device scales, all themes and radius presets); stories:
`Content/ChatMessage/Bubbles` (SingleBubbles, GroupedBubbles, TimeBoundaries,
NarrowContent and RadiusPresets). The responsibility boundary is ADR-0085.
