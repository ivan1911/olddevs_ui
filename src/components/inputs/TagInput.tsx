"use client";

import { useState, type KeyboardEvent } from "react";
import { Button as AriaButton, Label, Tag, TagGroup, TagList } from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";
import { TAG_CLASS, TAG_REMOVE_CLASS } from "../../lib/tag.js";

export interface TagInputProps {
  /** The current tags. */
  value: string[];
  /** Called when a tag is added or removed; receives the new array. */
  onChange: (value: string[]) => void;
  /**
   * The visible label above the field; it also serves as the accessible name when there is no
   * `aria-label`.
   */
  label?: string;
  /** Placeholder in the empty input field. */
  placeholder?: string;
  /** The maximum number of tags. Once it is reached, the input is turned off. */
  max?: number;
  /** Disables the tag input field. */
  disabled?: boolean;
  /** Classes for the root element. */
  className?: string;
  /** The field's accessible name when there is no visible `label`. */
  "aria-label"?: string;
  /**
   * The input's own description. Merged with the `FormField` description, not replacing it.
   */
  "aria-describedby"?: string;
}

/**
 * Tag input: you type, and Enter turns the text into a tag.
 *
 * Three decisions that the component makes on the consumer's behalf, because otherwise every screen
 * would decide them its own way:
 *
 * 1. **Enter in an empty input does nothing.** The temptation to submit the form is strong, but the
 *    tag field almost always sits inside a form, and "Enter in an empty field submits" would mean an
 *    accidental submit halfway through: you type three tags, pause, press Enter out of habit, and the
 *    form is gone.
 * 2. **Duplicates are not added.** A repeated tag means nothing, and on screen it looks like an input
 *    error. We ignore it silently: reporting "already exists" would scold the person for an action that
 *    broke nothing.
 * 3. **Backspace in an empty input removes the last tag.** A convention familiar from email clients; without
 *    it, removing tags means clicking each tag's remove button.
 *
 * A space is NOT a separator: tags can have two words ("night city"), and splitting on space would forbid
 * them altogether. A comma is: it never occurs in a tag, and pasting a list from the clipboard comes
 * through it.
 */
export function TagInput({
  value,
  onChange,
  label,
  placeholder,
  max,
  disabled,
  className,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: TagInputProps) {
  const messages = useMessages();

  /**
   * The field's description from `FormField`, plus the consumer's own if they passed one.
   *
   * The same approach as in `TextControl` and `NumberInput`: the values are MERGED, not replacing each
   * other.
   *
   * The target is the INPUT FIELD, not the `TagGroup`. The description under the field explains what to
   * type; it does not describe the set of tags already added. For the same reason, `aria-describedby` is
   * taken out of the spread: two elements with one id would make the screen reader read the hint twice in
   * one pass.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy = [ariaDescribedBy, fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const [draft, setDraft] = useState("");
  const full = max != null && value.length >= max;

  const add = (raw: string) => {
    /*
      Comma parsing lives HERE, not in the key handler: a list from the clipboard ("sky,sea,forest")
      arrives by paste, bypassing the keyboard, and used to become one tag with commas inside.
    */
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length || full) return;

    const next = [...value];
    for (const tag of parts) {
      if (max != null && next.length >= max) break;
      // Duplicates are ignored silently: a repeated tag means nothing, and scolding for an action that
      // broke nothing is just noise.
      if (!next.includes(tag)) next.push(tag);
    }
    setDraft("");
    if (next.length !== value.length) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      /*
        The event is ALWAYS prevented, including on empty input — this is the very decision from the
        JSDoc. Letting an empty Enter through would submit the form from the tag field: you type three
        tags, pause, press Enter out of habit, and the form is gone. This used to be the opposite, and
        the JSDoc promise did not match the code.
      */
      e.preventDefault();
      if (draft.trim()) add(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <TagGroup
      {...rest}
      aria-label={rest["aria-label"] ?? label}
      className={cn("flex flex-col gap-1.5", className)}
      onRemove={(keys) => onChange(value.filter((t) => !keys.has(t)))}
    >
      {label ? <Label className="text-fg-2 text-caption">{label}</Label> : null}

      <div className={cn(FIELD_SHELL_CLASS, "flex flex-wrap items-center gap-1.5 py-1.5")}>
        <TagList items={value.map((t) => ({ id: t }))} className="contents">
          {(item) => (
            <Tag id={item.id} textValue={item.id} className={TAG_CLASS}>
              {item.id}
              {/*
                The button MUST be react-aria's `Button`, not a plain `<button>`. The removal behavior is
                wired through `ButtonContext`, and a bare button does not read it: `slot="remove"` on it
                looks correct, the markup is valid, axe is happy — and a press does NOTHING. Tags were
                removed only with Backspace, that is, from the keyboard; with the mouse, not at all.

                The same trap as `FileTrigger` with file selection. The rule is one: if react-aria promises
                a behavior to a descendant, the descendant takes it from react-aria.

                The button needs its own name — react-aria does not invent a caption, it does not know the
                app's language. But the tag's name must NOT be inserted: react-aria appends its own tag
                caption to the button's name by itself, and "Remove tag alpha" was read as "Remove tag alpha
                alpha". Found by the wave 18 review by computing the accessible name — the markup alone does
                not show it.
              */}
              <AriaButton
                slot="remove"
                aria-label={messages.tagInput.remove}
                className={TAG_REMOVE_CLASS}
              >
                <CloseIcon size={12} />
              </AriaButton>
            </Tag>
          )}
        </TagList>

        <input
          type="text"
          value={draft}
          aria-describedby={describedBy}
          disabled={disabled}
          /*
            The set is full — the field becomes READ-ONLY, not disabled.

            `disabled` on the field that holds the caret removes focus from it: the user typed the last tag
            and pressed Enter, and focus flew to the document and the form's tab order started over. Backspace
            for removing the last tag also stopped working: a disabled field receives no events at all.
          */
          readOnly={full || undefined}
          placeholder={full ? undefined : placeholder}
          data-disable-focus-ring="true"
          /*
            The field has its OWN name, not the group's shared one. The label "Tags" belongs to the tag set
            (`TagGroup`), and putting the same label on the field would give the screen reader two different
            targets with one name: "Tags, list" and "Tags, input field". A test caught this.
          */
          aria-label={
            rest["aria-label"]
              ? messages.tagInput.addTo({ label: String(rest["aria-label"]) })
              : label
                ? messages.tagInput.addTo({ label: String(label) })
                : messages.tagInput.add
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          // The input continues along the rest of the line rather than taking all of it: the tags and
          // the field sit in one flow, and `w-full` would push the field onto a new line even with a
          // single short tag.
          /*
            Focus leaving WITHIN the tag field does not commit the draft. Otherwise a click on the cross of a
            neighboring tag would first add the typed text as a new tag: the user asked to remove a tag and got
            an extra one. We check where focus went: if it went to the same shell, this is not the end of input.
          */
          onBlur={(e) => {
            if (e.currentTarget.parentElement?.contains(e.relatedTarget)) return;
            add(draft);
          }}
          className={cn(FIELD_INPUT_CLASS, "min-w-[80px] flex-1 py-0.5")}
        />
      </div>
    </TagGroup>
  );
}
