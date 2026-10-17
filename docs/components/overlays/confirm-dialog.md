---
component: ConfirmDialog
exports: [ConfirmDialog]
category: overlays
status: stable
source: src/components/overlays/ConfirmDialog.tsx
story: src/components/overlays/ConfirmDialog.stories.tsx
---

# ConfirmDialog

## Summary for AI

`ConfirmDialog` confirms a significant or irreversible action. It is already
built on `Dialog` with `role="alertdialog"`, puts the initial focus on the
confirm button, and you do not have to build modality or focus order by hand. For
the most dangerous actions (deleting a workspace, a project, an account) it can
ask for typed confirmation: with `typeToConfirm="Acme"` the confirm button stays
disabled until the user has typed the name.

## When to use

- Deleting, unpublishing, sending immediately and other actions that the user
  must confirm separately.
- A short question in `title`, an explanation in `message` and explicit `onConfirm`/`onClose`.

## When not to use

- Use `Dialog` to collect input in several fields, to view something or to change a neutral setting.
- For a non-critical operation that can be undone after it runs, use an action
  plus a `toast`, not an extra confirmation.
- Do not pick the button color by hand: `kind` sets the meaning.

## Minimal example

```tsx
<ConfirmDialog
  open={deleteOpen}
  onClose={() => setDeleteOpen(false)}
  onConfirm={removeUser}
  title="Delete the user?"
  message="This action cannot be undone."
  confirmLabel="Delete"
/>
```

## Typing the name to confirm

```tsx
<ConfirmDialog
  open={deleteOpen}
  onClose={() => setDeleteOpen(false)}
  onConfirm={removeWorkspace}
  title="Delete the workspace?"
  message="Every project, file and member will be removed."
  confirmLabel="Delete the workspace"
  typeToConfirm={workspace.name}
/>
```

`typeToConfirm` is the string to type. When it is set, the dialog shows a field
labeled `Type “Acme” to confirm` with a hint under it. The initial focus goes
to the field (not to the button), the confirm button stays disabled until the
typed text matches, and pressing Enter in the field confirms only if the typed
text matches.

- **Case matters.** The point is that the user reads the name and
  types exactly that: "acme" instead of "Acme" tells one workspace from another,
  and the hint under the field says so outright.
- **Spaces around the typed text are ignored**, because text pasted from the
  clipboard often comes with extra spaces at the edges; spaces inside the name count. The
  comparison runs in canonical Unicode form (NFC): "é" as one letter and "e"
  with an accent are equal.
- **An empty string is not a name.** `typeToConfirm=""` (or a string of spaces
  only) does not enable the field: the dialog confirms as usual, without the lock field.
- The typed text lives inside the dialog and is not kept after it closes;
  `onConfirm` is called only after the match, so you do not need to check the match
  yourself.
- The label and the hint come from the message catalog
  (`confirmDialog.typeToConfirm`, `confirmDialog.typeToConfirmHint`) with a
  Russian translation and an English fallback. While `loading` is true, the field becomes read-only
  (it keeps focus) and the buttons are blocked.

The dialog stays an `alertdialog`: the field is a lock here, not data entry. If
you need other fields, server-side validation or your own form markup, use
`Dialog`.

## Public API

`open`, `onClose`, `onConfirm`, `title` and `message` are required. The button
labels come from the message catalog (`confirmDialog.confirm`,
`confirmDialog.cancel`): without a provider they are "Confirm" and "Cancel"; with
the Russian locale they are "Подтвердить" and "Отменить". Props override them one by one.
`kind` accepts `danger` (the default), `warning` or `info`: this is the semantics
of the question, not an arbitrary palette. For `info` the confirm button uses
the accent tone; for the other two it is an outline button in the `danger` tone.

`typeToConfirm` is an optional typed-confirmation string, see the section above.

`loading` blocks both buttons and is passed to the base `Dialog`, so the dialog
cannot be closed with the close button, Escape or a click outside the dialog until the operation
finishes.

## Accessibility and keyboard

The component creates an `alertdialog`, not a regular `dialog`, and focuses the
confirm button through `initialFocusRef`; with `typeToConfirm` the focus goes to
the input field instead. The hint under the field is tied to it through
`aria-describedby`, and the question itself remains the dialog's description. Phrase `title` as a question and
`confirmLabel` as a concrete action ("Delete", not "OK"). Do not call `onClose`
from `onConfirm` while the async action is still running: manage `loading` on the
consumer's side instead.

## Good examples

- `kind="danger"`, "Delete", for an irreversible operation.
- `kind="warning"`, "Unpublish", for a noticeable but reversible change.
- `kind="info"`, "Publish", for an explicit confirmation of an ordinary action.

## Anti-patterns

- Confirming every save or toggle.
- Passing the single phrase "Are you sure?" as `message`, without saying what the consequence is.
- Opening a second confirmation while the first one is `loading`.
- Putting `typeToConfirm` on every deletion: the lock belongs where a mistake is
  expensive, otherwise users learn to type without reading.
- Building typed confirmation on `Dialog` with a hand-written comparison — that
  is exactly what `typeToConfirm` does.

## Related sources and Storybook

- `src/components/overlays/ConfirmDialog.tsx`
- `src/components/overlays/ConfirmDialog.stories.tsx`
