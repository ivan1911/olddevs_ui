---
component: PromptInput
exports: [PromptInput]
category: inputs
status: stable
source: src/components/inputs/PromptInput.tsx
story: src/components/inputs/PromptInput.stories.tsx
---

# PromptInput

## Summary for AI

`PromptInput` is a controlled message draft on `TextControl`. It owns the sending
keyboard contract and a Send button; the consumer owns acceptance, clearing,
duplicate protection, requests and the current response.

## When to use

- A message can be sent by Enter or a visible button.
- The user must keep editing the next draft while sending is unavailable.

## When not to use

- A general multiline form field: use [TextControl](text-control.md).
- Formatted document authoring: use [RichTextEditor](rich-text-editor.md).
- A complete conversation runtime: compose the [chat recipe](../../recipes/chat.md)
  with your own history and handlers.

## Minimal example

```tsx
import { useState } from "react";
import { PromptInput } from "@olddevs/ui";

function Composer() {
  const [draft, setDraft] = useState("");
  return (
    <PromptInput
      label="Message"
      value={draft}
      onValueChange={setDraft}
      onSubmit={(text) => acceptMessage(text)}
      canSubmit={!responding}
    />
  );
}
```

## Public API and events

- `value`, `onValueChange(value)` and `onSubmit(value)` are required. Submission
  receives the unchanged draft, including intentional surrounding whitespace.
  Empty or whitespace-only drafts cannot be submitted.
- `label` is the required visible field label and accessible name. Its native
  label is linked to the generated field id, or to the supplied `id`.
- `canSubmit` defaults to true. False disables Send and Enter submission while
  leaving the field editable. `disabled` disables both editing and sending.
- `rows` defaults to 2; `maxRows` defaults to 6. TextControl autosizes the textarea
  between these limits. `placeholder`, `maxLength`, `id`, `name` and
  `aria-describedby` pass to the field. `className` styles the outer composition.
- `actions` places consumer controls beside Send. `children` adds content below
  the field, such as a voice panel. Consumers set these controls' availability.
- The ref points to the actual `HTMLTextAreaElement`.

The consumer decides when acceptance succeeds and the draft clears. Guard
duplicate acceptance synchronously in the consumer, before its next React
render; `canSubmit` alone is not a request lock. Preserve edits made while an
asynchronous acceptance is pending. The component does not await callbacks,
clear the draft, queue messages or stop a response.

## Accessibility and keyboard

Enter submits eligible text; Shift+Enter keeps the browser's newline behavior.
Composition Enter and native key code 229 are left to the input method. There is
no timing heuristic after composition completion. The Send button uses the same
submission guard and supports keyboard and touch activation. Its text comes from
`messages.promptInput.send`; the English fallback is “Send”.

Synthetic composition checks do not replace testing the real operating system
IME, especially event ordering in Safari. The component does not announce each
keystroke or response token.

## Anti-patterns

- Disabling the whole field while a response runs: use `canSubmit={false}`.
- Clearing the draft before the consumer accepts a send.
- Implementing a second framed textarea just to change geometry.
- Storing voice/media/runtime state inside the component.

## Verification

Source: `src/components/inputs/PromptInput.tsx`. Behavior:
`tests/chat.test.tsx`; keyboard/touch: `tests-visual/chat.spec.ts`. Storybook:
`Inputs/PromptInput` (`Playground`, `NextDraft`, `Disabled`). Composition and
responsibility follow ADR-0085.
