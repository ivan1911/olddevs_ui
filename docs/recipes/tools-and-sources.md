# Tools and sources in a chat

Compose short operation summaries and source cards under their matching assistant
reply with `Accordion`, `Card` and `Link`. These are consumer recipes, not new
runtime exports. No tool executes and no source is verified by rendering this UI.

## When to use

- Show waiting, running, completed and locally failed operations while an answer grows.
- Offer optional parameters, results or error details without filling the main answer with JSON.
- Put supplied references beneath the answer they support, with a title, URL and optional excerpt disclosure.

## When not to use

- For approval or denial of actions: this recipe has no authorization protocol.
- For an execution engine, network adapter or agent SDK: these belong to the application.
- To imply that every assertion has been verified, or that source cards establish truth.
- For mandatory inline numbered citations: this recipe does not define an annotation protocol.

## Compose existing primitives

```tsx
import { Accordion, AccordionItem, Card, ChatMessage, Link } from "@olddevs/ui";

<ChatMessage author="Assistant" speaker="assistant">
  <p>{answer.text}</p>
  <Accordion multiple>
    {answer.operations.map((operation) => (
      <AccordionItem
        key={operation.id}
        id={operation.id}
        title={`${operation.summary} · ${operation.stateLabel}`}
      >
        <p>{operation.details}</p>
      </AccordionItem>
    ))}
  </Accordion>
  {answer.sources.length > 0 && (
    <section aria-label="Sources">
      <h3>Sources</h3>
      {answer.sources.map((source) => (
        <Card key={source.id} size="sm">
          <Link href={source.href}>{source.title}</Link>
          <Accordion>
            <AccordionItem id={source.id} title={`${source.title} excerpt`}>
              <p>{source.snippet}</p>
            </AccordionItem>
          </Accordion>
        </Card>
      ))}
    </section>
  )}
</ChatMessage>;
```

`answer` is application data. Give each reply a stable ID; store operations and
sources against that reply ID, and each operation/source against its own stable ID.
Do not use array positions as identity. Preserve the same operation ID when its
state changes so an expanded panel and its trigger stay mounted. Local operation
errors update that operation's state and details; they do not remove answer text,
clear other operation results or mark the entire response as failed.

The application supplies summaries, localized state labels, details and excerpts.
Choose short human-readable summaries. Details may contain permitted parameters,
a result, an explanation or optional structured data; JSON is not required.
Validate source URLs at the application's trust boundary. `Link` provides link
semantics; it does not validate the truth or safety of an externally supplied URL.
Do not put a link inside the disclosure title: the link navigates, the disclosure
button expands, and they must remain distinct controls.

## External events and retry

The [Storybook recipe](../../src/recipes/ToolsSources.stories.tsx) uses a separate
[consumer demo](../../.storybook/recipes/ToolsSourcesDemo.tsx) and the shared chat
lifecycle helper. Its local `onStart(text, response)` handler receives a stable
`response.responseId`, `append`, `complete`, `fail`, `operations(records)` and
`sources(records)` callbacks. These demo types are not package exports. A real
consumer provides its own transport, cancellation and identity handling.

Send starts two waiting operations. **Start operations** models running them;
**Resolve operations** supplies one success, one local error and an answer with
an optional source. **Append answer chunk**, **Complete response**, **Stop
response**, **Fail response** and **Reset chat** reproduce lifecycle states
without a backend or timers. The alternate story has no source data and renders
no empty Sources block.

Keep `onRetry` separate from `onStart`. Retrying a failed answer must not replay
completed operations with side effects. The demo's default retry reuses supplied
reference data and creates an answer-only response attempt; the original reply
keeps its operations and sources. A real application decides whether and how a
specific failed operation can be repeated, independently of answer retry. Bind
late events to their originating response and cancel or ignore them after stop,
reset or replacement.

## Reading, keyboard and touch

Place the reply inside [ChatTranscript](../components/content/chat-transcript.md).
The transcript pauses following when a disclosure is activated, including React
Aria keyboard activation. Stream growth then preserves the reading position and
focus; **Return to latest** explicitly resumes following. Keep enough bounded
height for a usable reading viewport and leave the composer outside it.

`Accordion` owns button semantics, `aria-expanded`, panel associations and Enter /
Space activation. `Link` keeps ordinary browser navigation and keyboard behavior.
Source cards use separate excerpt buttons, including on touch. No live region
announces every operation rerender or answer token. The lifecycle demo announces
response boundaries, while detailed source content remains available for reading.
Manual screen-reader listening remains a separate validation obligation.

## Related references

- [Text chat recipe](chat.md)
- [ChatMessage](../components/content/chat-message.md)
- [Accordion](../components/navigation/accordion.md)
- [Card](../components/content/card.md)
- [Typography and links](../components/content/typography.md)
- [Behavior tests](../../tests/chat-tools.test.tsx)
- [Browser interaction, accessibility and visual checks](../../tests-visual/chat.tools.spec.ts)
