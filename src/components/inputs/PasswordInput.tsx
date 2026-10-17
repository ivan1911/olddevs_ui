"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { HiddenIcon, VisibleIcon, WarningIcon } from "../../icons.js";
import { TextControl } from "./TextControl.js";

export interface PasswordInputProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "size"
> {
  /**
   * Label of the show button. One label for both states: the state is announced by
   * `aria-pressed`.
   */
  toggleLabel?: string;
  /**
   * Shows a warning when Caps Lock is on. Enabled by default.
   *
   * The warning about Caps Lock being on. It can be turned off with the prop, because a password
   * field also appears where a hint would be out of place, for example in a confirmation dialog
   * with a single field.
   */
  capsLockWarning?: boolean;
  /** Classes for the framed wrapper: width, corner radius, inner padding. */
  shellClassName?: string;
}

/**
 * A password field: a show button in the slot, and a Caps Lock warning under the field.
 *
 * IT IS BUILT ON `TextControl` SLOTS, not on its own wrapper: `SearchControl` is a direct
 * precedent (ADR-0009). The frame, focus, and the disabled and invalid states stay with
 * `TextControl`. The component draws no frame of its own, otherwise the password field
 * would take focus differently from a neighboring field in the same form.
 *
 * WHAT THE COMPONENT ADDS ON TOP OF THE SLOT: exactly three things, and each one is a reason
 * for it to exist:
 *
 * 1. **Toggling visibility while keeping the caret.** Changing `type` resets the selection
 *    to the end of the value, and a user who reveals the password in the middle of an edit
 *    loses their place. The position is saved before the switch and restored after it,
 *    without moving focus: the button was pressed on purpose, and moving focus away from it
 *    would break a repeated press from the keyboard.
 * 2. **Caps Lock warning.** It is read from `getModifierState` on the keyboard event, not
 *    guessed from the case of the typed characters: a password field does not show the characters,
 *    and "all capitals" is a legitimate password.
 * 3. **`autocomplete` as a prop.** There is no default on purpose: whether this is a sign-in or a
 *    password change is known to the caller, not to the kit. Set
 *    `autoComplete="current-password"` on sign-in and `"new-password"` on a change.
 *
 * THE SHOW BUTTON HAS `aria-pressed`, BUT ITS LABEL IS CONSTANT. Without the flag, a screen reader
 * would not say that the password is visible on screen, which is a security state, not
 * decoration. The label stays the same, because a button whose name and state both change
 * is read as a contradiction: "Hide password, pressed".
 * (the state is already announced by `aria-pressed`).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { toggleLabel, capsLockWarning = true, className, shellClassName, disabled, ...rest },
    ref
  ) {
    const messages = useMessages();
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    // The caret position lives in a `ref`, not in state: it is needed exactly once, right after
    // `type` changes, and an extra render for it is not needed.
    const caret = useRef<[number, number] | null>(null);

    useLayoutEffect(() => {
      const el = innerRef.current;
      const at = caret.current;
      caret.current = null;
      // `setSelectionRange` does not move focus: the field stays where it was,
      // and the pressed button keeps its own.
      if (el && at) el.setSelectionRange(at[0], at[1]);
    }, [visible]);

    // Caps Lock tracking is set up LAZILY: without a warning the handlers do not appear at all,
    // and the field stays the same `TextControl` with its slot.
    const track = capsLockWarning
      ? {
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            setCapsLock(event.getModifierState("CapsLock"));
            rest.onKeyDown?.(event);
          },
          onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => {
            setCapsLock(event.getModifierState("CapsLock"));
            rest.onKeyUp?.(event);
          },
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // Focus left the field: the warning is cleared, because it concerns the input,
            // not the keyboard state in general.
            setCapsLock(false);
            rest.onBlur?.(event);
          },
        }
      : {};

    const control = (
      <TextControl
        ref={innerRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={className}
        shellClassName={shellClassName}
        trailing={
          <button
            type="button"
            disabled={disabled}
            aria-pressed={visible}
            aria-label={toggleLabel ?? messages.passwordInput.toggle}
            onClick={() => {
              const el = innerRef.current;
              caret.current = el ? [el.selectionStart ?? 0, el.selectionEnd ?? 0] : null;
              setVisible((shown) => !shown);
            }}
            className={
              "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs " +
              "transition-colors " +
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
              "disabled:pointer-events-none disabled:opacity-50"
            }
          >
            {visible ? <VisibleIcon size={14} aria-hidden /> : <HiddenIcon size={14} aria-hidden />}
          </button>
        }
        {...rest}
        {...track}
      />
    );

    if (!capsLockWarning) return control;

    return (
      <div className="flex flex-col gap-1">
        {control}
        {/*
          The region is declared EMPTY and always exists: a live region that appears in the markup
          together with its text is not announced by a screen reader:
          it has to be in place before the text appears in it.
          `empty:hidden` removes it from the layout while there is no text.
        */}
        <p role="status" className="text-fg-2 flex items-center gap-1 text-[11px] empty:hidden">
          {capsLock ? (
            <>
              <WarningIcon size={12} aria-hidden />
              {messages.passwordInput.capsLock}
            </>
          ) : null}
        </p>
      </div>
    );
  }
);
