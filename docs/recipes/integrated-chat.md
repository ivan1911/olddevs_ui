# Text, voice and references in one conversation

Compose [PromptInput](../components/inputs/prompt-input.md),
[ChatTranscript](../components/content/chat-transcript.md),
[ChatMessage](../components/content/chat-message.md) and
[MarkdownView](../components/content/markdown-view.md) with the
[tools/source](tools-and-sources.md) and [voice](voice-chat.md) recipes.
The resettable `Recipes/IntegratedChat` showcase demonstrates one consumer-owned
conversation. It makes no requests, executes no tools and accesses no microphone
or audio device.

## When to use

Use this composition to check the joins between a growing answer, manual reading,
operation details, supplied references and a voice panel beside the text draft.
The separate family pages remain their API contracts. There is no public
`AgentChat`, `VoicePanel` or shared conversation store to install.

For a plain text lifecycle start with the [text chat recipe](chat.md). For a real
application, provide your own transport, request acceptance, message identity,
operation execution, transcription reconciliation and media policy.

## One history and external effects

Keep one ordered array of message records. Associate operation/source data with a
stable response ID, rather than appending a separate tools history. Interim speech
updates a provisional record; accepted final speech replaces it with one canonical
user message. Incoming speech must preserve an independently edited text draft.
Assistant text and simulated playback refer to the same reply.

A new response attempt receives generation-bound callbacks. Stop, Cancel, Reset,
End and unmount invalidate obsolete events before another request starts. Retry
calls an answer-only consumer handler; it preserves the completed operation
records and does not execute their effects again. The showcase's operation-run
counter makes that distinction observable.

In text mode, a draft remains editable while the answer grows; Send waits for
completion or explicit Stop. In a ready voice session, submitting text first stops
the current answer synchronously, preserves its received part as interrupted,
then submits the next message. Repeated submission during request acceptance is
gated in both modes. Rejection preserves the draft, including edits made while
acceptance was pending. An empty or whitespace-only interrupted reply is removed.

## Compose the body and surrounding UI

```tsx
import { ChatMessage } from "@olddevs/ui";
import { MarkdownView } from "@olddevs/ui/markdown";

<ChatMessage
  author="Assistant"
  speaker="assistant"
  state={answer.isResponding ? "streaming" : "complete"}
>
  <MarkdownView content={answer.text} streaming={answer.isResponding} />
  {operationSummaries}
  {sourceCards}
</ChatMessage>;
```

The real consumer supplies the array, body, actions and extra presentation. Keep
completed Markdown bodies stable when editing an unrelated draft: the integrated
recipe memoizes those bodies, while changed content and streaming state still
render. This avoids reparsing the entire completed history on each keystroke.
No parser, highlighter or voice SDK enters the ordinary package-root import.

The header and composer sit outside the scrollable transcript. The integrated
example allocates a bounded frame and caps the visible draft at three rows (with
internal field scrolling) so an expanded voice panel and multiline draft cannot
reduce the reading viewport to zero. Simulation
events live in a disclosure outside that frame; collapse them while reading.
The voice name and optional visualizer are supplied by the consumer. Connection,
agent and microphone statuses remain independent and readable without animation.

Group positions also belong to the consumer. Only adjacent messages with the
same explicit author ID and valid real timestamps are eligible. Each forward
gap must be between zero and five minutes inclusive; unknown time, backwards time,
a different author or a larger gap splits a group. Never infer this from formatted
time labels or sort the array to obtain a group. Short bubbles keep their natural
width; tables and code scroll within the available width.

## Reproduce the scenarios

Select a starting scenario, expand **Simulation events**, and use explicit events.
**Reset chat** returns to the selected fixture and invalidates its pending events.
Scenario changes also reset the fixture. Neither operation archives a conversation.

| Scenario                         | Controls and observable result                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1–D2: submit and edit           | Empty conversation; type and Send/Enter, use Shift+Enter for a newline. Hold acceptance, then Accept/Reject send; duplicate Send is gated and newer draft edits survive.                                                                                                                                                                |
| D3–D4: stream and read           | Append Markdown fragment through partial emphasis, a link, table and code. Append unfinished link / Close link also exercises a large height reduction. Reading history supplies old messages. Scroll up, disclose an operation/source or expand the voice panel while growth continues. Return to latest explicitly resumes following. |
| D5–D6: stop and recover          | Stop before content, after Append whitespace, or after a real fragment. Fail response then Retry response. Received text remains readable; completed operations are not replayed.                                                                                                                                                       |
| D7–D8: operations and references | Start operations, Resolve operations. One completes and another has a local error; the answer survives. Include sources controls whether supplied cards appear for the active reply.                                                                                                                                                    |
| D9–D10: voice events             | Start voice, Connection ready/failed, Show interim transcript repeatedly, then Finalize transcript. One final user message replaces the interim. Append/Complete response and Simulate audio playback update one assistant reply.                                                                                                       |
| D11–D12: continue across modes   | During a partial voice response submit text. The received part is interrupted and voice stays ready. Mute leaves the session active; End voice preserves the conversation for text or another voice session.                                                                                                                            |
| D13: constrained layout          | Long Russian content and Load long draft exercise wrapping; the panel can expand/collapse. Bubble time boundaries shows zero, exactly five minutes, larger, reversed and unknown-time gaps.                                                                                                                                             |

Copy actions work for both the whole reply and the original semantic code string,
including its intentional whitespace. Source links and excerpt disclosure are
separate controls. Operations and sources remain beneath their owning reply;
empty data creates no empty Sources region.

## Focus, announcements and validation limits

Passive Markdown growth, metadata changes and panel resizing do not move focus.
Disclosing details pauses following before height changes. Return to latest moves
focus to the named transcript before its own button disappears. Terminal fixture
actions and Reset restore logical focus to the composer; Mute and panel toggles
retain their own focus.

Separate polite statuses announce lifecycle and voice-state transitions, not each
token or the whole history. Provisional text is readable without becoming a token
live region. Axe and DOM/focus checks do not establish what a screen reader says:
a listening pass against the stable final consumer is still required. Actual OS
IME behavior likewise cannot be established by synthetic composition events.
Touch automation uses browser emulation, not a physical device.

The example uses bounded fixtures, not virtualization or history pagination.
See [ChatTranscript volume limits](../components/content/chat-transcript.md#volume-and-limits)
and [MarkdownView limits](../components/content/markdown-view.md#limits-and-anti-patterns)
for the tested configuration and the distinction between normal and stress cases.

## Source and checks

The showcase consumer is `.storybook/recipes/IntegratedChatDemo.tsx`; its private
presentation/policy helpers are development examples, not package entry points.
Behavior is checked through its controls and rendered UI in
`tests/chat-integrated.test.tsx` and `tests-visual/chat.integrated.spec.ts`.
The `Recipes/IntegratedChat` stories include empty, reading, narrow and bubble
boundary fixtures. The separate recipes remain independently resettable.
