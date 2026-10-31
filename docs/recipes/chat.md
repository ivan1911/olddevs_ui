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
handler can supply an answer. Production apps own request errors and retry.

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

The example guards acceptance with a synchronous ref lock before React updates
the Send button. It clears an accepted draft; it never asks the primitives to
store messages, call a backend or clear content. A generation check rejects late
external results after Reset. The lifecycle status changes at response start
and completion; the transcript itself has no token-level live announcements.

Conversation persistence, streaming/Stop/retry, tools, sources and voice belong
to their consumer recipes. This basic path establishes none of those runtime
capabilities. The kit does not deduplicate SDK messages or reconcile interim
speech. See the family pages for their independent contracts.

## Validation limits

The keyboard/browser checks cover controlled submission, sequence, reset and
reading behavior. Synthetic composition events and axe cannot establish real
OS IME behavior or what a screen reader actually speaks; those require manual
validation with the final consumer and assistive technology.
