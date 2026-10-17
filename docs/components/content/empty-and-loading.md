---
component: EmptyAndLoading
exports: [EmptyState, ErrorState, Skeleton]
category: content
status: stable
source: src/components/content/EmptyState.tsx, src/components/content/ErrorState.tsx, src/components/content/Skeleton.tsx
story: src/components/content/EmptyState.stories.tsx, src/components/content/ErrorState.stories.tsx, src/components/content/Skeleton.stories.tsx
---

# EmptyState, ErrorState and Skeleton

## Summary for AI

Three screen states that have no content, and they are not interchangeable:
Show `Skeleton` while the result is not known yet, `EmptyState` when the request
succeeded and returned nothing, and `ErrorState` when the request failed. Do not show "Nothing
found" while the request is still running, and do not show it in place of a
failure: an empty list is a result, a failure is an event.

## When to use

- `EmptyState` — after a successful load of an empty list, no results, or a
  first launch with no objects yet.
- `ErrorState` — the request ended in failure: a network failure, a 5xx response,
  an unavailable backend. Almost always together with a "Try again" action.
- `Skeleton` — while the result is unknown and it is already clear where the future data will
  appear. Match its shape to the future content: a line, an avatar, a
  button, a preview.

## When not to use

- Do not use `EmptyState` for a network error — `ErrorState` exists for that.
- Do not use `ErrorState` for a message inside an already rendered screen: an
  `Alert` fits better there (it lives in the content flow), while `ErrorState`
  takes the place **of** the content.
- Do not use `ErrorState` for a field validation error — that is `FormField`.
- Do not use `Skeleton` as a permanent decorative block or as a progress
  indicator. For short work of unknown length use `Spinner`, and for known
  progress use `Progress`.
- Do not add business logic to `EmptyState`: `action` takes a ready-made node,
  usually a `Button`, not a callback.

## Minimal example

```tsx
import { Button, EmptyState, Skeleton } from "@olddevs/ui";

{
  isLoading ? (
    <Skeleton width={240} height={16} borderRadius={4} />
  ) : items.length === 0 ? (
    <EmptyState
      title="Nothing found"
      description="Try changing your query or resetting the filters."
      action={
        <Button variant="soft" onPress={resetFilters}>
          Reset filters
        </Button>
      }
    />
  ) : (
    <Results items={items} />
  );
}
```

## Public API

### `EmptyState`

| Prop          | Default | Meaning                                                                      |
| ------------- | ------- | ---------------------------------------------------------------------------- |
| `title`       | —       | A required short description of the empty state.                             |
| `description` | —       | An extra explanation or the next step.                                       |
| `icon`        | —       | A ready-made decorative node; the component hides it from the screen reader. |
| `action`      | —       | A ready-made action node, for example a `Button`.                            |
| `size`        | `md`    | `sm` — a picker or dropdown; `md` — a page or section.                       |

### `ErrorState`

| Prop          | Default                  | Meaning                                                                                                                                         |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | from the message catalog | A general wording of the failure; the default (`errorState.title`) is "Failed to load" without a provider, "Ошибка загрузки" with `locales/ru`. |
| `description` | —                        | What exactly failed: "Could not load the collections".                                                                                          |
| `action`      | —                        | A ready-made node, usually a `Button` with "Try again".                                                                                         |
| `icon`        | `ErrorIcon`              | A custom icon; `null` removes it entirely.                                                                                                      |
| `size`        | `md`                     | `sm` — a panel or picker; `md` — in place of the page content.                                                                                  |

`EmptyState` and `ErrorState` share their geometry, which lives in
`src/lib/state.ts`; they differ in tone and in their role in the accessibility
tree.

### `Skeleton`

| Prop                 | Default       | Meaning                                                               |
| -------------------- | ------------- | --------------------------------------------------------------------- |
| `width`, `height`    | —             | A number is pixels, a string is a CSS value.                          |
| `borderRadius`       | `var(--r-md)` | A number or a CSS value. For example, `"50%"` for an avatar.          |
| `className`, `style` | —             | Standard `div` attributes; `style` is merged with the computed sizes. |

## Accessibility and state

`EmptyState` renders its text as ordinary visible content: an empty list is a
result, and there is no need to announce it immediately. The icon is always
decorative.

`ErrorState`, by contrast, has `role="alert"`: a failure has to be announced,
otherwise a screen reader user is left with silence instead of an answer. Hence
the rule of use: do not keep `ErrorState` in the markup permanently and hide it
with CSS: it must appear at the moment of the failure, otherwise the
announcement does not fire. `Skeleton` does not report the end of loading on its
own: the owner of the state must switch it to the actual data or a status for the screen reader.

## Anti-patterns

```tsx
// Bad: the user is told there is nothing, though the request is still running.
return <EmptyState title="Nothing found" />;

// Good: the shape of the future data comes first.
return isLoading ? <Skeleton width="100%" height={120} /> : <EmptyState title="Nothing found" />;
```

```tsx
// Bad: a failure is presented as an empty result — the user thinks there is no data.
if (isError) return <EmptyState title="Nothing found" />;

// Good: a failure is called a failure and offers a retry.
if (isError)
  return (
    <ErrorState
      description="Could not load the collections."
      action={
        <Button icon={<RefreshIcon />} onClick={refetch}>
          Try again
        </Button>
      }
    />
  );
```

## Related sources and Storybook

- Sources: `src/components/content/EmptyState.tsx`, `src/components/content/ErrorState.tsx`,
  `src/components/content/Skeleton.tsx`.
- Stories: `src/components/content/EmptyState.stories.tsx`, `src/components/content/ErrorState.stories.tsx`,
  `src/components/content/Skeleton.stories.tsx`.
- Tests: `tests/error-state.test.tsx`.
