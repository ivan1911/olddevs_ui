---
component: Feedback primitives
exports: [Alert, Banner, Progress, Spinner, Toaster, toast, StatusBadge]
category: actions
status: stable
source: src/components/actions/Alert.tsx
story: src/components/actions/Alert.stories.tsx
---

# Alert, Banner, Progress, Spinner, Toaster, toast and StatusBadge

## Summary for AI

Choose by the kind of information:

- `Alert` is for a lasting state of a _place_;
- `Banner` is for a state of the _app_;
- `toast` is for a brief event that has finished;
- `Progress` is for a known fraction of the work;
- `Spinner` is for an unknown wait;
- `StatusBadge` is for an object's status next to its name.

## When to use

- `Alert`: an important state on a page that must not disappear by itself.
- `Banner`: service degradation, server maintenance, an expired subscription — anything that concerns the whole app and survives navigation.
- `toast`: "saved", "failed to send"; a single `Toaster` goes at the app root.
- `Progress`: the percentage/fraction is known; `value={null}` means indeterminate progress.
- `Spinner`: neither the duration nor the future shape of the content is known.
- `StatusBadge`: a compact domain status, such as a publication or a channel.

## When not to use

- Do not use a `toast` for a lasting error — that is an `Alert`.
- Do not use `Banner` for a message about one block of the page — that is an `Alert`. The line is drawn by place and lifetime: `toast` reports an event, `Alert` describes the state of a place, and `Banner` describes the state of the app.
- Do not show `Progress` at zero when the amount is unknown: pass `null`.
- Do not replace a `Skeleton` with a `Spinner` when the shape of the result is known.
- Do not use `StatusBadge` as a clickable filter — that is a `Chip`.

## Minimal example

```tsx
<Alert tone="danger" title="Publishing is unavailable">Connect a channel.</Alert>
<Progress label="Uploading files" value={64} showValue />
<StatusBadge tone="success">Published</StatusBadge>

// Next to the app root:
<Toaster />
// In a handler:
toast.success("Saved");
```

## Public API

- `Alert`: `tone`, `variant` (`soft`/`outline`), `title`, `icon`, `action`, `onDismiss`, `closeLabel`; `danger` gets `role="alert"` and the other tones get `role="status"`.
- `Banner`: `tone`, `title`, `icon`, `action`, `onDismiss`, `closeLabel`. There is no `variant` — a banner is always a full-width strip with no rounded corners. The role follows the tone, as in `Alert`. A stack is just adjacent banners: the component has no queue.
- `Progress`: required `label`, `value: number | null`, `showValue`; `null` does not set `aria-valuenow`.
- `Spinner`: `size`, `tone`, `label` (from the message catalog: "Загрузка" with `@olddevs/ui/locales/ru`, "Loading" without a provider) and `role="status"`.
- `Toaster`: `position`, `duration` (4000 ms by default), `theme`, `offsetVar`. `offsetVar` is the name of the variable holding the bottom bar height, `--bottombar-h` by default. At the bottom edge toasts sit above the `MobileTabBar` in the `bottomBar` slot of `AppShell` rather than under it; with no bar the offset is unchanged. `toast` has only `success`, `error`, `warning`, `info`, `promise`, `dismiss`.
- **`toast` has four tones and nothing beyond them.** `toast.custom` and toasts with an arbitrary layout, which `sonner` has, are left out of the kit on purpose: a toast that can do everything stops being part of the system, and half a year later the app has five different toasts. The tone, look and layout belong to the kit rather than to the call site; the caller sets only the content: the message, `description` (the second line), `duration` and a single `action` with a label and a handler. If you need more, it is an `Alert` or a dialog. The kit does not parse server errors: the caller prepares the text for `description`, for example `toast.error("Couldn't save", { description: extractErrorMessage(error) })`.
- `StatusBadge`: a non-interactive `span` with `tone`, `size` and an optional status dot; use a clear text label.

## Accessibility and semantics

- The `danger` tone on `Alert` and `Banner` interrupts the screen reader's speech; do not set it for ordinary success.
- `Banner` is not sticky, and the header below it stays at `top: 0`: the `--topbar-h` contract (ADR-0016) is left untouched. The analysis is in ADR-0027.
- `Progress` and `Spinner` must have a name, or a meaningful default.
- Sources: `src/components/actions/Alert.tsx`, `src/components/actions/Progress.tsx`, `src/components/actions/Spinner.tsx`, `src/components/actions/Toaster.tsx`, `src/components/actions/StatusBadge.tsx`; the stories of the same components.
