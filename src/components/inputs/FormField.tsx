"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  FieldDescriptionProvider,
  FieldInvalidProvider,
  FieldLabelProvider,
} from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

/** Field layout: the label above the field, or in a column on the left. */
export type FieldLayout = "stack" | "side";

/**
 * The layout axis, supplied by `FormLayout`.
 *
 * @internal `FormLayout` sets the provider. Consumers do not need it directly:
 * the field reads the axis from the nearest layout, and an explicit prop overrides it.
 */
const FieldLayoutContext = createContext<FieldLayout | null>(null);

/** @internal */
export const FieldLayoutProvider = FieldLayoutContext.Provider;

export interface FormFieldProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** The label above the field. */
  label: ReactNode;
  /**
   * The `id` of the field the label belongs to.
   *
   * Without it the label is just text: a click on it does not focus the field,
   * and a screen reader does not announce the field by its label. The prop is optional because
   * only the caller knows the `id`, and there is no way to generate it here with `useId`:
   * the field sits inside `children`, so this component cannot set the attribute on it.
   */
  htmlFor?: string;
  /** The hint below the field. */
  hint?: ReactNode;
  /**
   * The error message. By default it replaces `hint`; with `hintPersistent` the hint
   * stays, and the error appears below it.
   *
   * Two lines under the field, one contradicting the other, are a source of noise:
   * the hint says how to fill in the field, the error says what is wrong, and together
   * they force the reader to read both to tell which one still applies.
   */
  error?: ReactNode;
  /**
   * The hint stays under the field even when there is an error; the error goes below it.
   *
   * For a hint that is a RULE (a format or a constraint, such as "8–64 characters, a digit and
   * a letter"), hiding it exactly when the user made a mistake takes the instruction away
   * at the moment it is needed most. An explanatory hint ("how to address the user") is
   * still replaced by the error: that is the default
   * (ADR-0065).
   */
  hintPersistent?: boolean;
  /**
   * A required-field marker next to the label.
   *
   * Only a marker: it does not enable or replace validation. The kit shows
   * the form state, but the consumer computes it: the rules for what is required are
   * domain knowledge.
   */
  required?: boolean;
  /**
   * Layout: `stack` puts the label above the field, `side` puts it in a column on the left.
   *
   * The axis lives HERE, not in `FormLayout`, because this field draws the label:
   * it cannot be moved to the left column from outside, since it sits inside
   * the component's own flex container. See ADR-0025.
   *
   * Without the prop, the axis comes from the nearest `FormLayout`, and without one it is `stack`,
   * and the markup does not change at all.
   */
  layout?: FieldLayout;
  /** The field the label belongs to. */
  children?: ReactNode;
}

/**
 * The label, the field and the hint as one block.
 *
 * THE LABEL IS LINKED TO THE FIELD VIA `htmlFor`, and it should always be set:
 *
 *     <FormField label="Name" htmlFor="cat-name">
 *       <TextControl id="cat-name" … />
 *     </FormField>
 *
 * There was no link before, and nothing to fake it with, which is why the previous
 * doc comment said "only the caller can link them". That is still true: the `id`
 * still comes from outside. What changed is that there is now a prop for it,
 * not only the advice to wrap the whole block in a `<label>` on the caller's side.
 *
 * THE LABEL COLUMN WIDTH IS THE `--form-label-w` VARIABLE, NOT `subgrid`.
 * `subgrid` would align the labels on a shared track, but it requires the field to be
 * a direct child of an outer grid with a known number of tracks, and with two
 * columns and a full-width row there are sometimes two tracks and sometimes four. A variable
 * also works outside `FormLayout`: a field with `layout="side"` stands on its own.
 *
 * A long label wraps INSIDE its own column and does not move the field; that is what
 * the requirement "does not break the neighboring row" means.
 *
 * The previous version also exported `inputStyle`, an object of inline styles
 * for the field. It was not carried over: an audit found zero uses across the front end,
 * so the export existed only for its own sake.
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { label, htmlFor, hint, error, hintPersistent, required, layout, children, className, ...rest },
  ref
) {
  const inherited = useContext(FieldLayoutContext);
  const side = (layout ?? inherited ?? "stack") === "side";

  /*
    One message, one `id`: by default there is exactly one line under the field;
    the error REPLACES the hint. A second `id` is needed only for a hint that
    stays next to the error (`hintPersistent`).
  */
  const messageId = useId();
  const hintId = useId();
  const keepHint = hintPersistent === true && error != null && Boolean(hint);
  // The label's `id` goes into the context: a field that cannot be named through
  // `<label for>` (`contenteditable`) references it with `aria-labelledby`.
  const labelId = useId();

  const message =
    error != null ? (
      // `role="alert"`: without it, a screen reader would not announce the error at all;
      // it appears after submit, when focus is no longer on this field.
      //
      // The role and `aria-describedby` do not overlap; they split the duties. The role
      // announces the error WHEN IT APPEARS, the description is read when focus enters the field
      // later. Without the second, a user who returns to the field with Tab will not
      // hear what is wrong with it.
      <div id={messageId} role="alert" className="text-danger-strong text-[11px]">
        {error}
      </div>
    ) : hint ? (
      <div id={messageId} className="text-fg-3 text-[11px]">
        {hint}
      </div>
    ) : null;

  /*
    With no description, `undefined` goes into the context, and the field gets no
    `aria-describedby` at all. An empty string or a dangling `id` pointing at a missing
    node is worse than no attribute: a screen reader silently skips the reference to nowhere, and
    the defect is visible neither in the markup nor in a test.
  */
  const describedBy =
    message != null ? (keepHint ? `${hintId} ${messageId}` : messageId) : undefined;
  // The hint above the error: it is read first, and the error is read last.
  const messages = keepHint ? (
    <>
      <div id={hintId} className="text-fg-3 text-[11px]">
        {hint}
      </div>
      {message}
    </>
  ) : (
    message
  );
  const invalid = error != null;

  return (
    <div
      ref={ref}
      className={cn(
        side
          ? // A fixed-width label column; the field takes the rest.
            // `minmax(0,1fr)` instead of `1fr`: without it, a long value inside the
            // field stretches the track and pushes the field out of the form.
            "grid grid-cols-[var(--form-label-w,12rem)_minmax(0,1fr)] items-start gap-x-4"
          : "flex flex-col gap-1.5",
        className
      )}
      {...rest}
    >
      <label
        id={labelId}
        htmlFor={htmlFor}
        className={cn(
          "text-fg-2 text-[11px] font-bold tracking-wide uppercase",
          // The offset matches the field's top padding (`py-[10px]`): without it the label
          // would hang over the first line of the value instead of beside it.
          side && "pt-2.5"
        )}
      >
        {label}
        {required && (
          // `aria-hidden`: the asterisk is a visual cue, and the requiredness is
          // announced by the field itself via `required`/`aria-required`. Read
          // aloud, it would turn into "asterisk" in the middle of the label.
          <span aria-hidden className="text-danger-strong ml-0.5">
            *
          </span>
        )}
      </label>
      {/*
        The providers add no node: the field's markup without a hint and
        without an error stays exactly the same as it was before descriptions were added.
        The only difference from before is the `id` on the label itself.
      */}
      <FieldLabelProvider value={labelId}>
        <FieldDescriptionProvider value={describedBy}>
          <FieldInvalidProvider value={invalid}>
            {side ? (
              // The field, its hint and its error move into ONE column as a whole, not
              // cell by cell per node. Otherwise a second child (a "from" and "to" range, a field with
              // a button beside it) would land in the next row under the label: the grid
              // places children by cell, not by meaning.
              <div className="flex flex-col gap-1.5">
                {children}
                {messages}
              </div>
            ) : (
              <>
                {children}
                {messages}
              </>
            )}
          </FieldInvalidProvider>
        </FieldDescriptionProvider>
      </FieldLabelProvider>
    </div>
  );
});
