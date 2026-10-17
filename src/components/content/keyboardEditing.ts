export interface KeyboardSelection {
  /** Start of the selection (the caret position when it equals `end`). */
  start: number;
  /** End of the selection. */
  end: number;
}

export interface KeyboardEdit {
  /** The text after the edit. */
  value: string;
  /** The caret position after the edit. */
  selection: KeyboardSelection;
}

function normalizeSelection(value: string, selection: KeyboardSelection): KeyboardSelection {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  return { start, end };
}

export function replaceKeyboardSelection(
  value: string,
  selection: KeyboardSelection,
  text: string
): KeyboardEdit {
  const { start, end } = normalizeSelection(value, selection);
  const caret = start + text.length;

  return {
    value: value.slice(0, start) + text + value.slice(end),
    selection: { start: caret, end: caret },
  };
}

export function deletePreviousKeyboardCodePoint(
  value: string,
  selection: KeyboardSelection
): KeyboardEdit {
  const { start, end } = normalizeSelection(value, selection);
  if (start !== end) return replaceKeyboardSelection(value, { start, end }, "");

  const prefix = value.slice(0, start);
  const previous = Array.from(prefix).pop();
  if (previous == null) return { value, selection: { start, end } };

  const caret = start - previous.length;
  return {
    value: value.slice(0, caret) + value.slice(end),
    selection: { start: caret, end: caret },
  };
}
