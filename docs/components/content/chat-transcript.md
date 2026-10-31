---
component: ChatTranscript
exports: [ChatTranscript]
category: content
status: stable
source: src/components/content/ChatTranscript.tsx
story: src/components/content/ChatTranscript.stories.tsx
---

# ChatTranscript

## Summary for AI

`ChatTranscript` is a named scrollable reading viewport. It follows growing
content while the user is at the latest message, pauses for manual reading or
disclosure, and provides an explicit Return to latest action. The consumer owns
message data and surrounding screen layout.

## When to use

- A conversation grows while the user may be reading earlier messages.
- The header and composer must stay outside the scrolling history.

## When not to use

- An ordinary scrollable panel: use [ScrollArea](layout-primitives.md).
- A virtualized history or pagination: neither is provided in this wave.
- Message storage, transport, ordering or reconciliation: keep these outside.

## Minimal example

```tsx
import { ChatMessage, ChatTranscript } from "@olddevs/ui";

<ChatTranscript label="Conversation" className="h-[400px]">
  {messages.map((message) => (
    <ChatMessage key={message.id} author={message.author} speaker={message.speaker}>
      {message.text}
    </ChatMessage>
  ))}
</ChatTranscript>;
```

## Public API and following

`children` and the visible region `label` are required. Children keep their supplied DOM order;
there is no timestamp sorting. `className` styles the outer flex column; give it
a bounded height or `min-h-0 flex-1` inside a bounded layout. The ref points to
the actual scrollable `HTMLDivElement`, not the outer composition.

`onFollowingChange(following)` reports changes to the viewport's following
behavior, not domain response state. Growth and available-height changes are
observed: an expanding voice panel changes the viewport independently of the
content. Following uses immediate scroll movement, without animated scrolling.

Scrolling upward pauses following. Activating a `summary` or an element with
`aria-expanded` also pauses it before disclosure changes height. The Return to
latest button explicitly resumes following; manually reaching the bottom also
resumes it. The button label is `messages.chatTranscript.returnToLatest`.

## Accessibility and keyboard

The viewport is a focusable named region. Use browser scrolling keys and the
visible Return to latest button. Content updates and disclosure do not move
focus. The region is not an ARIA log and does not announce each response token;
use a separate polite atomic lifecycle status in the consumer.
Activating Return to latest deliberately moves focus to the named viewport
before its return button disappears, so keyboard focus does not fall to the page body.

## Volume and limits

The viewport contains positioned descendants, including accessible status helpers
inside message actions. These helpers do not extend the document's scroll area
beyond a bounded transcript.

There is no virtualization or previous-page loader. The first-wave browser
fixture uses 20 messages with expandable paragraphs. The technical prototype
also measured 100/500/1000 simple messages, but these are not a throughput or
Markdown-volume guarantee. Profile the actual body renderer and data volume in
the consumer; large code blocks and tables can dominate DOM and layout work.

## Anti-patterns

- Placing a whole app header and input inside the scrolling children.
- Calling `scrollIntoView` for every response token in the consumer.
- Setting a live region on the entire history.
- Assuming every custom disclosure can be inferred from arbitrary markup: use
  native details/summary or the semantic `aria-expanded` attribute.

## Verification

Source: `src/components/content/ChatTranscript.tsx`. Semantics:
`tests/chat.test.tsx`; real scrolling, resizing and focus:
`tests-visual/chat.spec.ts`. Storybook: `Content/ChatTranscript`,
`ReadingHistory`. See ADR-0085 and the [chat recipe](../../recipes/chat.md).
