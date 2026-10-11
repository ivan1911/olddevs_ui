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
}

/**
 * Окно «Вставить таблицу»: столбцы и строки числами, до 20 × 50.
 *
 * ЗАЧЕМ ОКНО, ЕСЛИ ЕСТЬ СЕТКА. Сетка в подменю — до 10 × 10, и это её
 * достоинство: размер виден глазу. Таблица больше сетки и точный размер с
 * клавиатуры без двадцати нажатий стрелки — работа полей. В меню полям не
 * место: фокус в поле ввода внутри `Menu` react-aria закрывает меню, а Tab в
 * меню не ходит. Отсюда окно, как у TinyMCE.
 *
 * `Dialog` КИТА: ловушка фокуса, Escape по слоям и возврат фокуса тому, кто
 * открыл. Открывает его пункт меню, который перед этим возвращает фокус в
 * документ, — и окно при закрытии отдаёт его туда же: после «Вставить» —
 * в первую ячейку новой таблицы, после «Отмена» — на прежнее место каретки.
 *
 * ENTER ВСТАВЛЯЕТ из любого поля — поля в `<form>`, и отправка формы и есть
 * «Вставить». Значения читаются из ref, а не из состояния: `NumberInput`
 * отдаёт набранное на Enter, и тем же нажатием форма уже отправляется —
 * состояние React к этому моменту ещё не обновилось бы.
 *
 * Пустое поле выбор не меняет: «Вставить» берёт последнее допустимое значение.
 */
export function TableInsertDialog({ editor, open, onClose }: TableInsertDialogProps) {
  const messages = useMessages().editor;
  const fieldsRef = useRef<HTMLDivElement>(null);
  /*
    Фокус при открытии — в поле «Столбцы», а не на крестик (умолчание окна).
    `NumberInput` отдаёт ссылку на рамку, а не на поле, поэтому ссылка здесь —
    геттер, который находит поле внутри в тот момент, когда окно его спросит.
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
      className="w-full max-w-[340px]"
    >
      {/* Содержимое монтируется на каждое открытие: поля берут последний размер заново. */}
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
