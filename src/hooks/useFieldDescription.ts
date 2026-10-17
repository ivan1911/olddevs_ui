"use client";

import { createContext, useContext } from "react";

/**
 * The id of the message under the field, a hint or an error, so that the field
 * can refer to it in `aria-describedby`.
 *
 * WHY A CONTEXT AND NOT A PROP. `FormField` renders the message, but the field sits
 * in its `children`: there is no way to put an attribute on a node that belongs to
 * someone else from outside. `cloneElement` breaks on any wrapper, and a field is
 * almost always wrapped, if only by `MaskedInput` inside `TextControl`. So the `id`
 * is minted by the component that renders the message, and the fields pick it up,
 * using the same technique as the layout axis (`FieldLayoutContext`) and the
 * navigation mode (`NavCollapsedContext`).
 *
 * A SEPARATE MODULE, NOT A LINE IN `FormField.tsx`, for the same reason the
 * `UiProvider` context lives in its own module. Otherwise `TextControl` would import
 * `FormField`, and every bare field would pull the form layout into the bundle
 * although it never needs it.
 *
 * Without `FormField`, `undefined` is a legitimate state, not an error: a field can
 * sit outside a form, and there is nothing to describe there.
 */
const FieldDescriptionContext = createContext<string | undefined>(undefined);

/** @internal Set by `FormField` when there is a hint or an error under the field. */
export const FieldDescriptionProvider = FieldDescriptionContext.Provider;

/**
 * The `id` of the message under the field, for `aria-describedby`.
 *
 * @internal Read by the kit's fields. Consumers do not need it: they pass their own
 * `aria-describedby` as a prop, and the field merges it with this value instead of
 * replacing it.
 */
export function useFieldDescribedBy(): string | undefined {
  return useContext(FieldDescriptionContext);
}

/**
 * The field's invalid flag, declared by `FormField`.
 *
 * A separate context next to the description, for the same reason: `FormField`
 * renders the error, but the field sits in its `children`, so there is no way to put
 * `aria-invalid` on a node that belongs to someone else from outside.
 *
 * WHY IT IS NEEDED AT ALL. `FIELD_SHELL_CLASS` paints the border by
 * `has-[input[aria-invalid=true]]`, that is, it reaches an attribute ON THE FIELD
 * ITSELF. But only the description went into the context, and the field did not set
 * the attribute: `<FormField error="…"><TextControl/></FormField>` drew red text under
 * the field and a plain border around it. For the border to turn red, the consumer had
 * to pass `aria-invalid` itself, and the string `aria-invalid` appeared in no file under
 * `docs/`, so there was no way to learn about this obligation.
 */
const FieldInvalidContext = createContext(false);

/** @internal Set by `FormField` when there is an error under the field. */
export const FieldInvalidProvider = FieldInvalidContext.Provider;

/**
 * Whether the form layout declares the field invalid.
 *
 * @internal Read by the kit's fields and merged with their own prop. An explicit
 * `aria-invalid` from the consumer wins, because it knows more about its own field
 * than the form does.
 */
export function useFieldInvalid(): boolean {
  return useContext(FieldInvalidContext);
}

/**
 * Field description: a MERGE of the consumer's own and the one declared by the form.
 *
 * Overriding gets it wrong in both directions, and both happened in the kit:
 *
 * - a spread `{...rest}` AFTER the conditional: the consumer's `aria-describedby`
 *   overwrote the context one, and the form error was never announced;
 * - a spread BEFORE the conditional: the context one overwrote the consumer's, and
 *   the consumer's hint was lost.
 *
 * Merging removes the question of order entirely: both ids go into the attribute,
 * and the screen reader reads both. The technique was described in `TextControl` and
 * `TagInput` but never extracted, and five components connected to the context later
 * each repeated it in their own way.
 */
export function useDescribedBy(own?: string): string | undefined {
  const fromField = useContext(FieldDescriptionContext);
  /*
    The ids must not DUPLICATE either.

    The same `id` arrives twice when a library passes the group's description down to
    one of its inner nodes and we add that very same id (react-aria's `Slider` does this
    with its thumb). The screen reader would read the hint twice in a row.
  */
  const ids = `${own ?? ""} ${fromField ?? ""}`.trim().split(/\s+/).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}

/**
 * The `id` of the `FormField` label, for fields that cannot be named with `<label for>`.
 *
 * The browser ties `for` only to labelable elements (`input`, `textarea`, `select`,
 * and so on). `contenteditable` is not one of them, so it stays unnamed no matter how
 * you set `htmlFor`. Such a field refers to the label through `aria-labelledby`, and
 * the label's `id` is minted by the component that renders it, using the same technique
 * as the description above. Previously the field looked up the label in the DOM by `for`
 * and added the `id` itself, so the rule lived on a node that belonged to someone else
 * and broke under any wrapper between them.
 *
 * Without `FormField`, the value is `undefined`: there is no label, and the field is
 * named by its own `aria-label`.
 */
const FieldLabelContext = createContext<string | undefined>(undefined);

/** @internal Always set by `FormField`, which requires a label. */
export const FieldLabelProvider = FieldLabelContext.Provider;

/**
 * The `id` of the enclosing `FormField`'s label.
 *
 * @internal Read by fields that are not named through `<label for>` (currently
 * `RichTextEditor`). The rest get by with `htmlFor`.
 */
export function useFieldLabelId(): string | undefined {
  return useContext(FieldLabelContext);
}
