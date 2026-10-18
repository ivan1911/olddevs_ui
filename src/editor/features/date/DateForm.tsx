"use client";

import type { Editor } from "@tiptap/core";
import { useId, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { Calendar } from "../../../components/date-time/Calendar.js";
import { Checkbox } from "../../../components/inputs/Checkbox.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { maskTime, normalizeTime } from "../../../lib/time.js";
import { composeDatetime, dateOf, isoDate, timeOf } from "./dateCompose.js";
import { insertDate } from "./dateCommands.js";
import { removeDate, updateDate } from "./dateEdit.js";

export interface DateFormProps {
  editor: Editor;
  /**
   * Position of the mention being edited. Without it, the form inserts a new mention at the caret.
   */
  pos?: number;
  /** Closes the popover the same way Escape does. */
  close: () => void;
}

/** Today in the browser's zone as `YYYY-MM-DD`, and the current time as `HH:MM`. */
function now(): { date: string; time: string } {
  const moment = new Date();
  const two = (value: number) => String(value).padStart(2, "0");
  return {
    date: isoDate(moment.getFullYear(), moment.getMonth() + 1, moment.getDate()),
    time: `${two(moment.getHours())}:${two(moment.getMinutes())}`,
  };
}

/**
 * Content of the date mention popover (ADR-0079, items 7 and 8), the lazy chunk of the `date`
 * Tool: the `Calendar` of the kit with the focus on today, the "Time" switch with a time field, and,
 * for an existing mention, "Remove time" and "Delete". The kit renders the frame (`SelectionPopover`):
 * a `Popover` in the layer stack; its name is the Slash menu item's label, and focus returns to the
 * Document.
 *
 * TWO MODES, SET BY `pos`, as in the formula popover. With `pos`, the form edits the mention at that
 * position; without it, it inserts a new one at the caret.
 *
 * PICKING A DAY WITHOUT A TIME APPLIES AT ONCE. Enter on the focused today inserts today, and a click
 * on a day in an existing mention changes it, in one edit. With the "Time" switch on, a day and a time
 * are two inputs, and the button (or Enter in the time field) applies them together.
 *
 * THE OFFSET IS NOT ASKED FOR. A value with a time gets the browser's UTC offset at that moment
 * (`composeDatetime`): the author's zone is the only one the kit knows, and it does not recalculate it.
 */
export function DateForm({ editor, pos, close }: DateFormProps) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const [existing] = useState(() =>
    pos === undefined ? null : String(editor.state.doc.nodeAt(pos)?.attrs.datetime ?? "")
  );
  const [date, setDate] = useState<string | null>(() => (existing ? dateOf(existing) : null));
  const [time, setTime] = useState<string>(() => (existing ? (timeOf(existing) ?? "") : ""));
  const [withTime, setWithTime] = useState(() => time !== "");
  const editing = existing !== null;
  const hadTime = existing !== null && timeOf(existing) !== null;

  const commit = (value: string | null) => {
    if (value !== null) {
      if (pos === undefined) insertDate(editor, value);
      else updateDate(editor, pos, value);
    }
    close();
  };

  /** The value from the form: the chosen day (today if none was chosen) and, with the switch on, the time. */
  const current = (day: string | null = date, clock: string | null = withTime ? time : null) =>
    composeDatetime(
      day ?? now().date,
      clock === null ? undefined : normalizeTime(clock, now().time)
    );

  const toggleTime = (on: boolean) => {
    setWithTime(on);
    // A switch turned on offers the current time, so that the field is never an empty box.
    if (on && time === "") setTime(now().time);
  };

  const onTimeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An Enter that the IME uses to confirm a word is not "apply".
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    commit(current());
  };

  const onTimeBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.target.value !== "") setTime(normalizeTime(event.target.value));
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <Calendar
        autoFocus
        // The footer row can be wider than the grid (the Russian labels are): the grid stays in the middle.
        className="self-center p-1"
        value={date}
        onChange={(_value, iso) => {
          setDate(iso);
          // No time: the choice is the whole mention.
          if (!withTime) commit(current(iso, null));
        }}
      />
      <div className="flex items-center gap-3 px-1">
        <Checkbox size="sm" checked={withTime} onCheckedChange={toggleTime}>
          {messages.dateTime}
        </Checkbox>
        {withTime && (
          <TextControl
            id={fieldId}
            size="sm"
            inputMode="numeric"
            autoComplete="off"
            placeholder={messages.dateTimePlaceholder}
            aria-label={messages.dateTimeField}
            shellClassName="w-24"
            value={time}
            onChange={(event) => setTime(maskTime(event.target.value))}
            onBlur={onTimeBlur}
            onKeyDown={onTimeKeyDown}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing && hadTime && (
          <Button type="button" size="sm" variant="ghost" onClick={() => commit(dateOf(existing))}>
            {messages.dateRemoveTime}
          </Button>
        )}
        {editing && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            tone="danger"
            onClick={() => {
              if (pos !== undefined) removeDate(editor, pos);
              close();
            }}
          >
            {messages.dateRemove}
          </Button>
        )}
        {withTime && (
          <Button
            type="button"
            size="sm"
            variant="solid"
            tone="accent"
            onClick={() => commit(current())}
          >
            {editing ? messages.dateApply : messages.dateInsert}
          </Button>
        )}
      </div>
    </div>
  );
}
