"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TextControl } from "./TextControl.js";

export interface InlineEditProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children" | "defaultValue"
> {
  /** The confirmed value. The component does not store it. */
  value: string;
  /** Confirms an edit. Called only when the value has changed. */
  onChange: (value: string) => void;
  /**
   * The accessible name of the field. Required, and checked by the compiler: without it,
   * in-place editing gives a field with no name at the very moment of typing. The button's name
   * is built from the value and the word "edit" from the message catalog.
   */
  label: string;
  /** Edit mode. If the prop is omitted, the component manages it itself. */
  editing?: boolean;
  /** Called on entering and leaving edit mode, and receives the new state. */
  onEditingChange?: (editing: boolean) => void;
  /** What to show on the button when the value is empty. */
  placeholder?: string;
  /** Disables editing: the value button does not open the field. */
  disabled?: boolean;
}

/**
 * In-place value editing: the value button → the field → confirmation.
 *
 * THE CONFIRMED VALUE IS NOT STORED. Only the edit draft lives inside: what is being typed
 * right now. The confirmation goes out, and on the next frame the value arrives as a prop.
 * A component that stored the confirmed value would keep showing its own after the server
 * refused to save.
 *
 * CANCELLING WITH ESCAPE IS A REQUIREMENT, NOT A CONVENIENCE. Without it, a user who started
 * editing by mistake cannot leave without saving: a click outside confirms, Enter confirms,
 * and there is no way out without writing.
 *
 * FOCUS IS THE MAIN THING HERE, and so it is checked in a live browser:
 *
 * - opening places the caret in the field, rather than leaving it on the button: otherwise
 *   a keyboard user opens the field and types into nothing;
 * - Escape returns both the value and the focus to the button;
 * - Enter confirms and also returns focus to the button: the field disappears, and without
 *   the return the focus would drop to `<body>`;
 * - a click outside confirms and does NOT take focus back: the user has moved on
 *   to where they wanted to go.
 *
 * The edit mode can be driven from outside (`editing` + `onEditingChange`), the same way
 * as collapsing in `SideNav`. Without the prop, the component manages it itself: three lines
 * of state repeated by each consumer would not be "state in the consumer": it would be a
 * component rewritten in every screen.
 */
export function InlineEdit({
  value,
  onChange,
  label,
  editing,
  onEditingChange,
  placeholder,
  disabled,
  className,
  ...rest
}: InlineEditProps) {
  const messages = useMessages();
  const [uncontrolled, setUncontrolled] = useState(false);
  const isControlled = editing !== undefined;
  const open = isControlled ? editing : uncontrolled;

  const [draft, setDraft] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  // Focus is NOT always returned: after a click outside, taking focus back
  // would pull it away from where the user has just gone.
  const returnFocus = useRef(false);
  // Escape clears the mode itself, and the confirmation on focus loss must not
  // fire right after it.
  const cancelling = useRef(false);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    onEditingChange?.(next);
  };

  useLayoutEffect(() => {
    if (open) {
      /*
        The draft is taken from the value on EVERY opening, not only in `start()`.

        `start()` is the button's handler, and opening from outside (`editing` as a prop, a
        documented scenario: editing from a row menu) never reached it.
        The field kept the draft from mount: a value that came from the server was not picked up,
        and blur confirmed the stale text over the new one: a silent rollback.
        Text cancelled with Escape came back the same way.
      */
      setDraft(value);
      cancelling.current = false;
      /*
        The value is written to the DOM SYNCHRONOUSLY, before `select()`.

        `setDraft` is a render request, not a write: by the time `select()` runs, the field
        still holds the old text, and React flushes the new one right after the effect,
        collapsing the selection to the end. This shows up exactly in the scenario the sync was added for:
        opening from outside while the value has changed in the meantime.
        On the usual path (a click on the button) `setDraft` is a no-op,
        so there is no render, and the selection survives by accident.
      */
      if (fieldRef.current) fieldRef.current.value = value;
      fieldRef.current?.focus();
      fieldRef.current?.select();
      return;
    }
    if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
    // The dependency is ONLY `open`, on purpose: an external change of the value while the form
    // is already open must not overwrite what the user has typed.
    // The effect fires on a change of mode, not on a change of value.
  }, [open]);

  const start = () => setOpen(true);

  const confirm = (withFocus: boolean) => {
    returnFocus.current = withFocus;
    setOpen(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    cancelling.current = true;
    returnFocus.current = true;
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirm(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div className={cn("min-w-0", className)} {...rest}>
      {open ? (
        <TextControl
          ref={fieldRef}
          aria-label={label}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (cancelling.current) {
              cancelling.current = false;
              return;
            }
            confirm(false);
          }}
          shellClassName="w-full"
        />
      ) : (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={start}
          className={
            "text-fg-0 rounded-control hover:bg-bg-2 flex w-full cursor-pointer items-center " +
            "px-2 py-[10px] text-left text-[13px] leading-5 transition-colors " +
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {value === "" ? (
            <span className="text-fg-3">{placeholder ?? messages.inlineEdit.empty}</span>
          ) : (
            value
          )}
          {/*
            The button's name is built from its content: the value must be part of the name.
            An `aria-label` would replace it, and a screen reader would announce "edit
            name" without reading what is written there.
          */}
          <span className="sr-only">, {messages.inlineEdit.edit}</span>
        </button>
      )}
    </div>
  );
}
