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
does not impose a runtime message format.

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
- Required `children` is the body; `actions` holds consumer buttons. Actions
  remain visible and reachable without hover. `className` styles the article.

## Accessibility and state ownership

The visible author labels the article. Body and actions remain in ordinary DOM
reading order. There is no token-level live region or focus movement. Announce
response lifecycle once through a separate consumer status, as in the
[chat recipe](../../recipes/chat.md).

The consumer maps interim transcription to a canonical message, removes a
completely empty interrupted answer and keeps a partial answer. Copy/retry
effects and the availability of actions belong to the consumer; repeating an
answer must not implicitly repeat side-effecting tools.

## Anti-patterns

- Using displayed timestamps to reorder consumer messages.
- Treating a voice session as a second copy of an assistant answer.
- Hiding actions behind hover alone.
- Rendering an empty interrupted bubble instead of removing it in the consumer.

## Verification

Source: `src/components/content/ChatMessage.tsx`. Tests: `tests/chat.test.tsx` and
`tests-visual/chat.spec.ts`. Storybook: `Content/ChatMessage`, `MessageStates`.
The responsibility boundary is ADR-0085.
