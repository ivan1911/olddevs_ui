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
`aria-expanded` also pauses it before disclosure changes height. Enter and Space
are captured before a React Aria disclosure handles the key, so keyboard expansion
does not race with following. The Return to
latest button explicitly resumes following; manually reaching the bottom also
resumes it. The button label is `messages.chatTranscript.returnToLatest`.

## Accessibility and keyboard

The viewport is a focusable named region. Use browser scrolling keys and the
visible Return to latest button. Content updates and disclosure do not move
focus. The region is not an ARIA log and does not announce each response token;
use a separate polite atomic lifecycle status in the consumer.
Activating Return to latest deliberately moves focus to the named viewport
before its return button disappears, so keyboard focus does not fall to the page body.

A delayed programmatic scroll event after Return to latest does not count as
manual reading just because new content has already grown. Upward movement still
pauses following, including small scrollbar movements.

## Volume and limits

The viewport contains positioned descendants, including accessible status helpers
inside message actions. These helpers do not extend the document's scroll area
beyond a bounded transcript.

There is no virtualization or previous-page loader. The integrated production
fixture was measured on 2026-10-31 with minified React, the kit CSS, Chromium
153.0.8010.12, an Apple M5 Pro and Darwin 27.2.0 at 1280×900. Each case had three
warmups and ten retained samples. Mount timing runs from the fixture command to
two animation frames; draft timing measures a forced synchronous React commit.
The latter is CPU/commit work, not end-to-end input latency.

| History fixture                              | Characters |  Mount P50 / P95 | Draft commit P50 / P95 |
| -------------------------------------------- | ---------: | ---------------: | ---------------------: |
| 100 simple-text messages                     |     34,090 |   31.8 / 33.1 ms |           1.1 / 1.1 ms |
| 100 mixed messages with Markdown tables/code |     33,685 |   32.3 / 32.8 ms |           1.1 / 1.3 ms |
| 500 simple messages, stress                  |    170,890 |   61.2 / 63.6 ms |           3.2 / 3.3 ms |
| 1,000 simple messages, stress                |    341,890 | 122.2 / 124.7 ms |          5.9 / 10.3 ms |

The normal history fixture stops at 100 messages / roughly 35,000 characters;
a separate complex Markdown reply was checked at 20,000 characters. These are
measured fixture bounds, not API caps, a throughput SLA or a mobile guarantee.
The narrow 320/390-pixel checks exercise long Russian content and multiline
input separately. Every retained benchmark sample also preserved manual reading
through disclosure, panel resize, Return and immediate manual scrolling.

The consumer memoizes unchanged Markdown bodies. In the same 100-message mixed
fixture, disabling only that optimization increased draft commit P50/P95 from
1.1/1.3 to 8.7/10.4 ms. Changed live answers still require parsing and layout; see
[MarkdownView limits](markdown-view.md#limits-and-anti-patterns). Profile the
actual renderer, source complexity and update frequency in the consumer.

## Anti-patterns

- Placing a whole app header and input inside the scrolling children.
- Calling `scrollIntoView` for every response token in the consumer.
- Setting a live region on the entire history.
- Assuming every custom disclosure can be inferred from arbitrary markup: use
  native details/summary or the semantic `aria-expanded` attribute.

## Verification

Source: `src/components/content/ChatTranscript.tsx`. Semantics:
`tests/chat.test.tsx`; real scrolling, resizing and focus:
`tests-visual/chat.spec.ts`, `tests-visual/chat.tools.spec.ts` and
`tests-visual/chat.integrated.spec.ts`. Storybook: `Content/ChatTranscript`,
`ReadingHistory`. See ADR-0085 and the [chat recipe](../../recipes/chat.md).
