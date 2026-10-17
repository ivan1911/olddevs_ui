---
component: UploadQueue
exports: [UploadQueue, UploadItem, ProgressStatus]
category: inputs
status: stable
source: src/components/inputs/UploadQueue.tsx
story: src/components/inputs/UploadQueue.stories.tsx
---

# UploadQueue

## Summary for AI

An upload manager: what has been sent, what is in progress and what failed. **Presentation
only** — the kit has no transport. Items and handlers come as props; the outcome of the
queue is announced to the screen reader through a live region.

## When to use

- The user sends several files and has to see what happened to each.
- Some files may fail while others go through: partial success must be possible.
- You need actions on an item: retry, cancel, remove from the queue.

## When not to use

- To **choose** a file, use `FileDropzone`. The boundary is simple: the area
  supplies files, the queue shows what happened to them. On the screen they sit
  side by side, and that is exactly why they get confused.
- For a single file without progress and without errors — a queue of one row says
  nothing that the file name next to the field would not say.
- For a feed of already completed events, use `Timeline`: there a step has no
  actions, and the order is set by the process, not by the user.

## Minimal example

```tsx
import { UploadQueue, type UploadItem } from "@olddevs/ui";

const [items, setItems] = useState<UploadItem[]>([]);

<UploadQueue items={items} empty={<EmptyState title="The queue is empty" />} />;
```

## Props

| Prop         | Default        | Purpose                                                        |
| ------------ | -------------- | -------------------------------------------------------------- |
| `items`      | —              | The queue items. The consumer keeps the state.                 |
| `empty`      | —              | What to show for an empty queue. If omitted, nothing is shown. |
| `aria-label` | "Upload queue" | The accessible name of the list.                               |

An `UploadItem` has these fields: `id`, `name`, `size`, `preview`, `state`, `progress`,
`statusLabel`, `tone`, `meta`, `actions`.

## The kit has no transport

Sending, retrying, canceling and polling jobs on the server are the consumer's
concern: URLs, response formats and retry rules belong to the application.
The kit provides the item shape, progress, states and the announcement of the outcome.

This is the same division of responsibilities as with the table
(ADR-0023): the kit
provides the shape of the state; the consumer owns it. The decision on the queue is
ADR-0027.

## State is mechanics, label and tone are domain

`state` takes four values: `pending`, `running`, `success`, `failed`. This
describes what happened to the job, not the application domain — the same vocabulary as in `Timeline`. An
unknown value (the backend added a fifth) does not break the queue: the
tone falls back to neutral.

"Duplicate", "Pending moderation", "Limit exceeded" are consumer labels; they arrive in
`statusLabel` and are rendered as a badge. Making them kit states is not allowed: the
kit does not know the application's domain (photos, publications). `StatusBadge` is built the same
way: it was brought into the kit from the source app without a dictionary of 11 domain statuses.

**`statusLabel` changes only the badge text, not its color.** The color is derived
from `state`: `pending` is neutral, `running` is accent, `success` is green, `failed`
is red. As long as the label agrees with the state ("Done" on `success`, "Queued" on
`pending`), this is enough.

### A domain status over the mechanical one: `tone`

The label and the state diverge where the application knows more than the transport.
An example is "Duplicate": the file reached the server, that is `state="success"`, but
there is no good news, and a green badge would be misleading. For this an item
has `tone` (`neutral | accent | success | warning | danger`) — it overrides the tone
derived from `state`:

```tsx
const items: UploadItem[] = [
  { id: "1", name: "report.pdf", state: "success", statusLabel: "Done" },
  {
    id: "2",
    name: "report-copy.pdf",
    state: "success",
    statusLabel: "Duplicate",
    tone: "warning",
  },
];
```

- **Without `tone` nothing changes:** the color still comes from `state`.
- **`tone` colors the badge and the progress bar.** They sit in one row, and a
  green bar next to a yellow "Duplicate" would send two different messages about one item.
- **The `meta` text of a failed item ignores `tone`** — it follows `state`: the
  sending failed, whatever the domain says. And conversely, a red `tone` on a
  `success` item does not make it count as a failure: the outcome in the live region is
  computed from `state`.
- **The tone does not replace the label.** Color without a word is read neither by a
  screen reader nor by a color-blind person: "Duplicate" stays in `statusLabel`, and
  `tone` only decides which color it is shown in.
- An unknown `tone` value (a typo, or a consumer dictionary that has drifted from the kit)
  is ignored, as if it were not set: the tone is derived from `state`.

The file size also comes **already formatted**: "2,4 МБ" and "2.4 MB" differ by more
than the decimal separator, and the choice of units (MB or MiB) is the application's
decision.

## The outcome is announced, not only shown

A partial success — "9 of 12 uploaded, 1 failed" — is visible to the eye by the color
of the rows. A screen reader user who sent a dozen files will not learn about the
single failed one at all unless it is announced.

That is why under the list there is a live region that is **always mounted**: a region
inserted into the document together with its message is announced unreliably — some
screen readers manage to miss it. This is the same technique, used for the same reason, as in
`FileDropzone`.

Pluralization ("1 error", "2 errors") is done by the locale file through
`Intl.PluralRules`: the locale knows the rules, not the component.

## Progress: `null` is not zero

`progress: null` means "the total amount of work is unknown": the bar shows indeterminate
progress and `aria-valuenow` is absent. `progress: 0` means "started and nothing done yet".
If `progress` is not set, there is no bar at all.

The bar name is built from the file name: in a queue of a dozen rows the same
"Uploading" on every row does not say which file it refers to.

## Anti-patterns

- Keeping the queue inside the component. It does not keep it — and will not:
  the state belongs to whoever runs the sending.
- Introducing a new `state` for a domain case instead of `statusLabel` and `tone`.
- Leaving `statusLabel` empty so that a "Duplicate" badge does not turn green:
  the color is set by `tone`, the label does not need to be touched for that.
- Expressing meaning by color only: `tone` without `statusLabel` renders no badge at all,
  and the color of the bar does not replace words.
- Showing `progress: 0` where the length of the response is unknown: that is untrue.

## Related sources and tests

- Source: `src/components/inputs/UploadQueue.tsx`
- Tests: `tests/upload-queue.test.tsx`
- Showcase: `src/components/inputs/UploadQueue.stories.tsx`
