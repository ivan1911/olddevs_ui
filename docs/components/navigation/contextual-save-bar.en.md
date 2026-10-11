---
component: ContextualSaveBar
exports: [ContextualSaveBar]
category: navigation
status: stable
source: src/components/navigation/ContextualSaveBar.tsx
story: src/components/navigation/ContextualSaveBar.stories.tsx
sourceHash: 87d7081dd3f9
---

# ContextualSaveBar

## Summary for AI

A bar for unsaved changes: it appears with the first edit of a form, shows "there are unsaved changes" (or their count) and two buttons — save and cancel. It sticks to the bottom edge of the viewport — above the application's bottom bar, if there is one (`--bottombar-h`). It knows nothing about the form data: it takes a flag for unsaved edits (`visible`), the number of edits and two handlers. The bar appearing and the progress of saving are announced to the screen reader, not just rendered.

## When to use

- A long form or settings page where edits accumulate and are submitted at once.
- Editing is possible right in a list or table, and saving is shared by all the edits.
- The user needs to see that something is unsaved, even when the changed field has scrolled out of view.

## When not to use

- **For selecting objects**, use `SelectionBar`: "12 selected" and actions on them.
- **For application state** ("maintenance in progress", "subscription is expiring"), use `Banner`: it survives navigation and does not belong to the current form.
- **For a message about something that has already happened** ("saved"), use a `toast`.
- For a form with a single "Submit" button at the bottom: the bar would duplicate it.

In short: `SelectionBar` is about selection, `Banner` is about the application, `ContextualSaveBar` is about the current form.

## Minimal example

```tsx
import { ContextualSaveBar } from "@olddevs/ui";

export function GroupSettings() {
  const [value, setValue] = useState(saved);
  const dirty = value !== saved;

  return (
    <form>
      {/* form fields */}
      <ContextualSaveBar
        visible={dirty}
        onSave={() => save(value)}
        onCancel={() => setValue(saved)}
      />
    </form>
  );
}
```

## Props

| Prop                        | Type                          | Meaning                                                                                              |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `visible`                   | `boolean`                     | Whether anything is unsaved. When `false` the bar is not rendered                                    |
| `count`                     | `number`                      | The number of edits. Without it, "there are unsaved changes"; with it, the count is shown            |
| `message`                   | `ReactNode`                   | Your own wording instead of the default. Replaces `count` as well                                    |
| `onSave`                    | `() => void`                  | Required: the bar exists for it                                                                      |
| `onCancel`                  | `() => void`                  | Cancel. **Without a handler there is no button at all**                                              |
| `saving`                    | `boolean`                     | Saving is in progress: the button shows progress, cancel is disabled                                 |
| `error`                     | `ReactNode`                   | The text of a failure. Shown in the bar and announced                                                |
| `saveLabel` / `cancelLabel` | `ReactNode`                   | Your own button labels                                                                               |
| `sticky`                    | `boolean` (`true` by default) | Stick to the bottom of the viewport                                                                  |
| `offsetVar`                 | `string` (`"--bottombar-h"`)  | The variable holding the bottom bar height: the bar is offset above the viewport edge by that height |

The component does not store form state. What counts as an edit is the consumer's decision: a comparison with the original value, a field-touch counter or a server response.

## Why at the bottom, not the top

The bar sticks to the bottom edge of the **nearest scroll area**: the browser window, if the page scrolls, and the container, if the work area has its own `overflow` — as in most admin panels. This is ordinary `position: sticky` semantics, and you should know it: an ancestor with `overflow: auto` that does not itself scroll cancels stickiness to the window.

The application header and `SelectionBar` already sit at the top, and both measure stickiness from `--topbar-h` (ADR-0016, ADR-0019). A third sticky layer at the top would need a second height variable and a revision of the contract — a price out of proportion to the task. The bottom is free, and users are used to seeing such a bar there in admin panels.

## Above the phone's bottom bar

On a phone the bottom edge of the viewport is taken by `MobileTabBar` in the `bottomBar` slot of `AppShell`. The shell publishes the slot height as `--bottombar-h` (at `md` and wider there is no bar and the value is `0px`), and the bar sticks that far above the viewport edge — the same way `SelectionBar` measures its stickiness from `--topbar-h`. There is no need to offset the bar with `max-md:bottom-14` by eye: a hard-coded number drifts from the real bar height (notch inset, wrapped labels).

`offsetVar` changes the variable name if the shell publishes it under a different name (`bottomBarHeightVar` on `AppShell`) or the application publishes the bottom bar itself. The offset is a class that reads this variable, not an inline `bottom`, so a `className` with `bottom-*` overrides it: your own bottom bar outside `AppShell` sets the offset the same way as with an inline `bottom`. With no published variable the offset is `0px`.

## Accessibility and keyboard

- The bar has the `group` role and an accessible name: for a screen reader it is a set of actions on the form, not buttons in the middle of the page.
- The bar appearing, the progress of saving and a failure are announced by a `role="status"` live region. The region is always mounted and only its content is swapped: a live region inserted into the tree together with its text is announced unreliably.
- The role is `status`, not `alert`, even on failure: the failure comes with visible text in the bar itself, and there is no need to interrupt speech.
- The buttons are ordinary `Button` components: Tab, Enter, Space. While saving, cancel is disabled and the save button shows progress.

**A known cost.** The bar's text gets into the accessibility tree twice: as a visible line and as a live region. In browse mode it is read twice in a row. The trade-off is deliberate: if the bar's appearance is announced unreliably, that is worse than an extra repeat. The same question is open for `MaskedInput` (ADR-0026) and is closed by one run with NVDA and VoiceOver — for both components at once.

## Anti-patterns

- **Intercepting navigation away from the page inside the kit.** The bar knows nothing about the router and should not; a warning about leaving the page is the application's business.
- **Keeping a third and fourth button in the bar.** The bar is about one decision: save or cancel. Everything else belongs in the form.
- **Showing the bar always, with a disabled button.** A permanent bar stops meaning "something is unsaved" and takes space from the content.
- **Replacing a page-level error message with the bar.** A save failure is fine; for an unavailable service, use `Banner`.

## Links

- Source: [`src/components/navigation/ContextualSaveBar.tsx`](../../../src/components/navigation/ContextualSaveBar.tsx)
- Tests: [`tests/contextual-save-bar.test.tsx`](../../../tests/contextual-save-bar.test.tsx)
- Story: [`src/components/navigation/ContextualSaveBar.stories.tsx`](../../../src/components/navigation/ContextualSaveBar.stories.tsx)
- Neighbors at the boundary: [SelectionBar](selection-bar.md), [Banner](../actions/feedback.md)
