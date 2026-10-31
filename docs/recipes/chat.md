# Text chat recipe

The `Recipes/Chat` → `BasicTextChat` story composes `PromptInput`, `ChatMessage`
and `ChatTranscript` with existing `Button` and `EmptyState` primitives.
The runnable consumer is `.storybook/recipes/BasicChatDemo.tsx`; it is not a
public runtime export or a monolithic chat component.

## Run the example

Type a draft and send with Enter or Send. Complete response supplies a fixed
plain-text answer; Reset chat returns to the empty conversation. This sequence
is simulated and needs no network, model keys, microphone or voice SDK. The
optional example `request(text): Promise<string>` demonstrates where an external
handler can supply an answer. This helper is consumer example code, not a package API.

### Streaming, Stop and recovery

`StreamingResponse` provides explicit fixture events. Send a message, append
response chunks, then complete, stop or fail the response. The next draft stays
editable while a response runs; sending waits for completion or Stop. There is
no queued next message. Stop and failure retain received text with the
interrupted label. An empty or whitespace-only answer leaves no empty bubble.

Use Fail next send to exercise acceptance failure: no message is accepted and
the draft stays intact. Delay acceptance exposes Accept send, Reject send and
Cancel send. Edits made while acceptance is pending survive a later acceptance;
only the unchanged submitted draft is cleared. Duplicate acceptance is guarded
synchronously before React disables Send. Reset rejects late results from an
old acceptance or response.

Copy is available on assistant messages. Retry response is available only for
the latest stopped or failed response, until another send starts. A retry adds
a new response attempt without duplicating the user message or removing the
previous partial answer. It invokes a separate external `onRetry` handler and
never automatically calls the ordinary `onStart` handler or replays tools.
Without an external handler, fixture buttons explicitly supply the new answer.

`ReadingDuringStream` uses a local timer and twenty previous fixture messages.
Write a draft, read older messages or open their details while tokens arrive.
Content updates preserve focus and manual reading position; Return to latest
explicitly resumes following. This timer is a demonstration fixture, not a
runtime requirement.

## Compose the screen

Keep the header and composer outside `ChatTranscript` in a bounded flex column.
Pass consumer messages as ordered keyed children. This example deliberately
shows a user time of 16:54 followed by an assistant time of 16:50: display time
does not reorder a sequence. Author and input method stay visible.

```tsx
import { ChatMessage, ChatTranscript, PromptInput } from "@olddevs/ui";

<section className="flex h-[560px] min-w-0 flex-col gap-3">
  <header>{conversationTitle}</header>
  <ChatTranscript label="Conversation" className="min-h-0 flex-1">
    {messages.map((message) => (
      <ChatMessage
        key={message.id}
        author={message.author}
        speaker={message.speaker}
        inputMethod={message.inputMethod}
      >
        <p>{message.text}</p>
      </ChatMessage>
    ))}
  </ChatTranscript>
  <PromptInput
    label="Message"
    value={draft}
    onValueChange={setDraft}
    canSubmit={!responding}
    onSubmit={acceptMessage}
  />
  <div role="status" aria-live="polite" aria-atomic="true">
    {lifecycleSummary}
  </div>
</section>;
```

## Consumer responsibilities

The example guards acceptance synchronously before React updates the Send
button. It clears an unchanged accepted draft; it never asks the primitives to
store messages, call a backend or clear content. Generation-bound response
callbacks reject late tokens/completion/errors after Stop, Reset, unmount or a
new attempt. A canceled acceptance cannot alter a previous completed response.
Synchronous throws and rejected promises in an external response handler become
recoverable response errors.

The separate polite atomic status changes only for lifecycle transitions:
sending, response start, completion, interruption, cancellation or error. It
does not repeat every token or reannounce the history. Explicit terminal
controls and Retry return focus to the composer before the activated button
disappears; passive updates do not move it.

The internal `.storybook/recipes/useChatDemo.ts` helper keeps this consumer
state reusable across the independent recipes. Its `accept`, `onStart` and
`onRetry` callbacks receive fixture events, not SDK messages. A response exposes
`append`, `complete` and `fail`; each callback is bound to its attempt.
`ChatDemoFrame.tsx` supplies message-body, message-extras, controls and composer
slots. Neither helper is exported from the package or shipped as a chat runtime.

Conversation persistence, tools, sources and voice belong to their consumer
recipes. These simulations establish no real AI or media capabilities. The kit
does not deduplicate SDK messages or reconcile interim speech. See the family
pages for their independent contracts.

## Validation limits

The keyboard/browser checks cover controlled submission, sequence, reset and
reading behavior. Synthetic composition events and axe cannot establish real
OS IME behavior or what a screen reader actually speaks; those require manual
validation with the final consumer and assistive technology.

## Bubble groups

`ChatMessage` receives `groupPosition` from the consumer. The shared demo frame
uses the recipe-only `messageGroups.ts` helper, not a new package runtime engine.
The demo message's optional `createdAt` is actual epoch milliseconds and
`authorId` is a stable author identity; `timestamp` is only a display caption.
Missing time or identity never groups a message. Generated events without an
actual timestamp remain single even if their visible captions match.

The helper compares each adjacent pair in input order: same author, two valid
finite timestamps, and a nonnegative gap no larger than 300,000 ms. It never
sorts or infers time from a caption. The frame supplies single/first/middle/last
and reduces the visual gap within a group; the component handles shape only.
See `Content/ChatMessage/Bubbles` for equal and exactly-five-minute times,
larger gaps, different authors, unknown/invalid/backward times and narrow
Markdown/table/code bodies. The helper lives outside the shipped runtime and
is illustrative consumer code, not an import path for applications.
