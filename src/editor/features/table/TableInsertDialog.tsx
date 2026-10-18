"use client";

import type { Editor } from "@tiptap/react";
import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Button } from "../../../components/actions/Button.js";
import { Dialog } from "../../../components/overlays/Dialog.js";
import { NumberInput } from "../../../components/inputs/NumberInput.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { insertTableOfSize } from "../../core/insertItems.js";
import {
  lastTableSize,
  rememberTableSize,
  TABLE_MAX_SIZE,
  type TableSize,
} from "./tableActions.js";

export interface TableInsertDialogProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
  /** The dialog's layer. The Editor raises it above the fullscreen layer (`OVERLAY_LAYER.alert`). */
  zIndex?: string;
}

/**
 * The Insert table dialog: columns and rows as numbers, up to 20 × 50.
 *
 * WHY A DIALOG WHEN THERE IS A GRID. The grid in the submenu goes up to 10 × 10, and
 * that is its strength: the size is visible at a glance. A table bigger than the grid,
 * or an exact size from the keyboard without twenty arrow presses, is the job of fields.
 * There is no room for fields in a menu: focus in an input inside a react-aria `Menu`
 * closes the menu, and Tab does not move through a menu. Hence a dialog, as in TinyMCE.
 *
 * The kit's `Dialog`: focus trap, Escape across overlay layers, and focus return to
 * whoever opened it. The menu item that opens it first returns focus to the Document,
 * and on close the dialog gives focus back there: after Insert, to the first cell of the
 * new table; after Cancel, to the previous caret position.
 *
 * ENTER INSERTS from any field. The fields are in a `<form>`, and form submit is Insert.
 * Values are read from a ref, not from state: `NumberInput` reports what was typed on
 * Enter, and the same keypress submits the form, so React state would not have been
 * updated yet at that moment.
 *
 * An empty field does not change the selection: Insert takes the last valid value.
 */
export function TableInsertDialog({ editor, open, onClose, zIndex }: TableInsertDialogProps) {
  const messages = useMessages().editor;
  const fieldsRef = useRef<HTMLDivElement>(null);
  /*
    Focus on open goes to the Columns field, not to the close button (the dialog default).
    `NumberInput` gives a ref to the frame, not to the field, so the ref here is a getter
    that finds the field inside at the moment the dialog asks for it.
  */
  const firstField = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return fieldsRef.current?.querySelector("input") ?? null;
      },
    }),
    []
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.tableInsertDialogTitle}
      initialFocusRef={firstField}
      zIndex={zIndex}
      className="w-full max-w-[340px]"
    >
      {/* The content mounts on every open: the fields take the last size again. */}
      {open && <TableInsertForm editor={editor} onClose={onClose} fieldsRef={fieldsRef} />}
    </Dialog>
  );
}

function TableInsertForm({
  editor,
  onClose,
  fieldsRef,
}: {
  editor: Editor;
  onClose: () => void;
  fieldsRef: RefObject<HTMLDivElement | null>;
}) {
  const messages = useMessages().editor;
  const [draft, setDraft] = useState<{ cols: number | null; rows: number | null }>(() =>
    lastTableSize(editor)
  );
  const size = useRef<TableSize>(lastTableSize(editor));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    rememberTableSize(editor, size.current);
    insertTableOfSize(editor, size.current.cols, size.current.rows);
    onClose();
  };

  const field = (key: keyof TableSize, label: string, max: number) => (
    <label className="text-fg-2 text-caption flex min-w-0 flex-1 flex-col gap-1">
      <span aria-hidden="true">{label}</span>
      <NumberInput
        label={label}
        value={draft[key]}
        onChange={(value) => {
          setDraft((current) => ({ ...current, [key]: value }));
          if (value !== null) size.current = { ...size.current, [key]: value };
        }}
        min={1}
        max={max}
        step={1}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
      <div ref={fieldsRef} className="flex gap-3">
        {field("cols", messages.tableColumns, TABLE_MAX_SIZE.cols)}
        {field("rows", messages.tableRows, TABLE_MAX_SIZE.rows)}
      </div>
      <div className="flex items-center justify-end gap-2.5">
        <Button type="button" variant="ghost" onClick={onClose}>
          {messages.tableCancel}
        </Button>
        <Button type="submit" variant="solid" tone="accent">
          {messages.tableInsert}
        </Button>
      </div>
    </form>
  );
}
