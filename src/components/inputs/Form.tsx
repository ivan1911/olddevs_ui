"use client";

import { forwardRef, type FormEvent, type ReactNode } from "react";
import { Form as AriaForm } from "react-aria-components";
import { cn } from "../../lib/cn.js";

export interface FormProps {
  /**
   * Called on submit. The page reload is already canceled. Not called while a request
   * is in progress, that is, while `pending` is set.
   */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /**
   * Submission is in progress.
   *
   * Disables the whole form through `<fieldset disabled>`, rather than iterating over the
   * fields. Iteration would require the form to know its own contents, and it does not know
   * them and should not: the fields arrive in `children`. Also, the native `fieldset` disables
   * even what appears later, without a single line of code.
   */
  pending?: boolean;
  /** Form fields and the submit button. */
  children?: ReactNode;
  /** Classes on the `form` element. */
  className?: string;
}

/**
 * Form wrapper: submission, and locking while the request is in flight.
 *
 * THERE IS NO VALIDATION OF ITS OWN, AND THERE WILL NOT BE. Rules like "name is required",
 * "date not earlier than today", or "channel must be connected" are domain knowledge. A kit
 * that undertook to describe them would turn into a form library, and its vocabulary of tones
 * and sizes has nothing to do with validation.
 *
 * THERE IS NO `validationErrors` PROP HERE, although react-aria accepts one. This is a decision,
 * not an oversight. It distributes errors to fields through its context, so it reaches
 * `Checkbox`, `CheckboxGroup`, `RadioGroup` and `NumberInput`, but not `TextControl` or `Select`.
 * Those are hand-written in the kit and do not read that context. A prop that does nothing for
 * half the fields of a form, and does so silently, is worse than no prop at all: the consumer
 * would find out in production.
 *
 * Errors are therefore passed explicitly, through props. This is already the package's idiom:
 * `FormField error`, `CheckboxGroup errorMessage`, `RadioGroup errorMessage`. One channel instead
 * of two, and the compiler sees both ends.
 *
 * What the kit does take on: showing the error in the right place, announcing it to the screen
 * reader, and not letting the form be submitted twice.
 *
 * `validationBehavior="aria"`, not the native `native`. Browser bubbles appear at the first
 * invalid field, look system-level, are not translated, and cannot be styled. A neatly styled
 * message under the field, placed next to such a bubble, looks like a layout bug, not a decision.
 */
export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { onSubmit, pending, children, className },
  ref
) {
  return (
    <AriaForm
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        // A repeated submission during a request is cut off here, not only by disabling the
        // button: Enter in a text field submits the form past it.
        if (pending) return;
        onSubmit(event);
      }}
      validationBehavior="aria"
      className={cn("flex flex-col gap-4", className)}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </AriaForm>
  );
});
