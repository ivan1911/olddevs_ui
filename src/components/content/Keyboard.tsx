"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CloseIcon, DragHandleIcon, EnterIcon, LanguageIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import type { UiMessages } from "../../i18n/messages.js";
import {
  type KeyboardSelection,
  deletePreviousKeyboardCodePoint,
  replaceKeyboardSelection,
} from "./keyboardEditing.js";

export type KeyboardLayout = "en" | "ru";
export type { KeyboardSelection } from "./keyboardEditing.js";

export interface KeyboardProps {
  /** Current text of the field that the keyboard controls. */
  value: string;
  /** Caret position or the selected range in `value`. */
  selection: KeyboardSelection;
  /** Called with the new text after a key press or a character deletion. */
  onChange: (nextValue: string) => void;
  /** Called with the new caret position or selection after input. */
  onSelectionChange: (next: KeyboardSelection) => void;
  /** Keyboard layout: `en` or `ru`. */
  layout: KeyboardLayout;
  /** Called with the new layout when the user switches the language. */
  onLayoutChange: (nextLayout: KeyboardLayout) => void;
  /** Submits the entered query without synthesizing a DOM event. */
  onSubmit?: () => void;
  /** Disables all keys, the move handle and the close button. Defaults to `false`. */
  disabled?: boolean;
  /** With a pointer, does not move focus away from the external text field. */
  preserveFocus?: boolean;
  /** Accessible name and heading of the panel; without it, the standard name for the layout is used. */
  label?: string;
  /** Accessible name of the close button; without it, the standard label is used. */
  closeLabel?: string;
  /**
   * Called when the close button is pressed. Without this handler the close button is not rendered.
   */
  onRequestClose?: () => void;
}

type KeyAction =
  "backspace" | "layout" | "shift" | "space" | "submit" | "symbols" | "symbolShift" | "text";

interface KeyboardKey {
  action: KeyAction;
  label: string;
  text?: string;
  ariaLabel?: string;
  icon?: "enter" | "language";
  letter?: boolean;
  space?: boolean;
  wide?: boolean;
}

interface DragStart {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  positionX: number;
  positionY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface PanelBounds {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function constrainPosition(position: { x: number; y: number }, bounds: PanelBounds) {
  const minX = Math.min(-bounds.originX, window.innerWidth - bounds.width - bounds.originX);
  const maxX = Math.max(-bounds.originX, window.innerWidth - bounds.width - bounds.originX);
  const minY = Math.min(-bounds.originY, window.innerHeight - bounds.height - bounds.originY);
  const maxY = Math.max(-bounds.originY, window.innerHeight - bounds.height - bounds.originY);

  return {
    x: Math.min(maxX, Math.max(minX, position.x)),
    y: Math.min(maxY, Math.max(minY, position.y)),
  };
}

const LETTER_ROWS: Record<KeyboardLayout, [string[], string[], string[]]> = {
  en: [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ],
  ru: [
    ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х", "Ъ"],
    ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
    ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю"],
  ],
};

const NUMBER_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

const SHIFTED_NUMBER_ROWS: Record<KeyboardLayout, string[]> = {
  en: ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ru: ["!", '"', "№", ";", "%", ":", "?", "*", "(", ")"],
};

/*
  The character on a key is input DATA, while its spoken name is UI. That is why this holds
  a message catalog key rather than a ready label: the "," key types a comma in any language,
  but it is named differently in each.
*/
type PunctuationKeyName =
  "keyComma" | "keyPeriod" | "keyLess" | "keyGreater" | "keySemicolon" | "keyColon";

const DEFAULT_PUNCTUATION: readonly { label: string; key: PunctuationKeyName }[] = [
  { label: ",", key: "keyComma" },
  { label: ".", key: "keyPeriod" },
];

const SHIFTED_PUNCTUATION: Record<
  KeyboardLayout,
  readonly { label: string; key: PunctuationKeyName }[]
> = {
  en: [
    { label: "<", key: "keyLess" },
    { label: ">", key: "keyGreater" },
  ],
  ru: [
    { label: ";", key: "keySemicolon" },
    { label: ":", key: "keyColon" },
  ],
};

const SYMBOL_ROWS: Record<KeyboardLayout, [string[], string[]]> = {
  en: [
    ["@", "#", "$", "_", "&", "-", "+", "(", ")", "/"],
    ["=", "*", '"', "'", ":", ";", "!", "?", "%", "~"],
  ],
  ru: [
    ["@", "#", "₽", "_", "&", "-", "+", "(", ")", "/"],
    ["Ё", "*", '"', "'", ":", ";", "!", "?"],
  ],
};

const SECONDARY_SYMBOL_ROWS: [string[], string[], string[]] = [
  ["~", "`", "|", "•", "√", "π", "÷", "×", "§", "Δ"],
  ["£", "€", "$", "¢", "^", "°", "=", "{", "}", "\\"],
  ["%", "©", "®", "™", "✓", "[", "]"],
];

const KEY_CLASS =
  "border-line-soft bg-bg-2 text-fg-0 hover:bg-bg-3 h-8 w-8 min-w-8 rounded-sm border p-1 text-xs font-semibold focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

const KEYBOARD_MOVE_OFFSETS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/*
  THE LAYOUT IS DATA, NOT TRANSLATION. The `LETTER_ROWS.ru` arrays stay in Cyrillic whatever the
  UI language is: they say which characters the keyboard TYPES, not which language its keys are
  labeled in. So `layout` and the provider's locale are independent: a Russian layout in an English
  UI is a normal case, not a bug. The "no literals" gate knows this exception by name.
*/
function panelTitle(layout: KeyboardLayout, messages: UiMessages) {
  return messages.keyboard.label({ layout });
}

function textKeys(texts: string[], letter = false): KeyboardKey[] {
  return texts.map((text) => ({ action: "text", label: text, text, letter }));
}

function punctuationKeys(
  layout: KeyboardLayout,
  shifted: boolean,
  messages: UiMessages
): KeyboardKey[] {
  const punctuation = shifted ? SHIFTED_PUNCTUATION[layout] : DEFAULT_PUNCTUATION;
  return punctuation.map(({ label, key }) => ({
    action: "text",
    label,
    text: label,
    ariaLabel: messages.keyboard[key],
  }));
}

function keyboardRows(
  layout: KeyboardLayout,
  uppercase: boolean,
  shifted: boolean,
  symbols: boolean,
  symbolShifted: boolean,
  messages: UiMessages
): KeyboardKey[][] {
  const letters = LETTER_ROWS[layout].map((row) =>
    row.map((key) => (uppercase ? key : key.toLowerCase()))
  );
  const characterRows = symbols
    ? [
        textKeys(symbolShifted ? SECONDARY_SYMBOL_ROWS[1] : SYMBOL_ROWS[layout][0]),
        [
          {
            action: "symbolShift" as const,
            label: symbolShifted ? "?123" : "=\\<",
            ariaLabel: symbolShifted
              ? messages.keyboard.showPrimarySymbols
              : messages.keyboard.showExtraSymbols,
          },
          ...textKeys(
            symbolShifted ? SECONDARY_SYMBOL_ROWS[2] : (SYMBOL_ROWS[layout][1] ?? []).slice(1)
          ),
        ],
      ]
    : [
        ...letters.slice(0, 2).map((row) => textKeys(row, true)),
        [
          { action: "shift" as const, label: "⇧", ariaLabel: "Shift", wide: true },
          ...textKeys(letters[2] ?? [], true),
        ],
      ];

  return [
    [
      ...textKeys(
        symbolShifted
          ? SECONDARY_SYMBOL_ROWS[0]
          : shifted
            ? SHIFTED_NUMBER_ROWS[layout]
            : NUMBER_ROW
      ),
      { action: "backspace", label: "⌫", ariaLabel: messages.keyboard.backspace, wide: true },
    ],
    ...characterRows,
    [
      {
        action: "symbols",
        label: symbols ? (layout === "ru" ? "АБВ" : "ABC") : "?123",
        ariaLabel: symbols
          ? messages.keyboard.showLetters({ layout })
          : messages.keyboard.showSymbols,
      },
      {
        action: "layout",
        label: messages.keyboard.switchLayout,
        // The layout is SWITCHED to the other one, so the label names the layout that
        // the press switches to, not the current one.
        ariaLabel: messages.keyboard.switchLayoutTo({ layout: layout === "ru" ? "en" : "ru" }),
        icon: "language",
      },
      {
        action: "space",
        label: messages.keyboard.space,
        ariaLabel: messages.keyboard.space,
        space: true,
      },
      ...punctuationKeys(layout, shifted, messages),
      {
        action: "submit",
        label: "↵",
        ariaLabel: messages.keyboard.submit,
        icon: "enter",
        wide: true,
      },
    ],
  ];
}

function keyClassName(key: KeyboardKey) {
  return [
    KEY_CLASS,
    key.wide && "w-14 min-w-14 px-2",
    (key.action === "symbols" || key.action === "symbolShift") && "w-14 min-w-14 rounded-full px-2",
    key.space && "w-[8.75rem] max-w-full flex-none",
    key.icon && "inline-flex items-center justify-center",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The on-screen keyboard controls the value and selection of the field that opened it, but not its
 * DOM ref.
 */
export function Keyboard({
  value,
  selection,
  onChange,
  onSelectionChange,
  layout,
  onLayoutChange,
  onSubmit,
  disabled = false,
  preserveFocus = false,
  label,
  closeLabel,
  onRequestClose,
}: KeyboardProps) {
  const [shifted, setShifted] = useState(false);
  const [capsLocked, setCapsLocked] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const [symbolShifted, setSymbolShifted] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const buttons = useRef<HTMLButtonElement[]>([]);
  const panel = useRef<HTMLElement>(null);
  const dragStart = useRef<DragStart | null>(null);
  const focusFirstLetterAfterLayoutChange = useRef(false);
  const focusSymbolsAfterChange = useRef(false);
  const focusSymbolShiftAfterChange = useRef(false);
  const messages = useMessages();
  const rows = keyboardRows(
    layout,
    shifted || capsLocked,
    shifted,
    symbols,
    symbolShifted,
    messages
  );
  const firstLetter = (rows[0] ?? []).length;
  const symbolsIndex = rows.flat().findIndex((key) => key.action === "symbols");
  const symbolShiftIndex = rows.flat().findIndex((key) => key.action === "symbolShift");
  const [activeIndex, setActiveIndex] = useState(firstLetter);

  /*
    The tab stop is ALWAYS inside the current key set.

    `activeIndex` is state of the markup, not of focus, and the number of keys changes together with
    the layout and the mode: ru letters — 50, en letters — 44, ru symbols — 35. The restore effects
    below used to exit on `preserveFocus` BEFORE `setActiveIndex`, so a position taken from the long
    set stayed in the short one: NO button got `tabIndex={0}`, and the whole panel dropped out of the
    tab order — for a component that exists for the keyboard.
  */
  const keyCount = rows.flat().length;
  useEffect(() => {
    setActiveIndex((current) => {
      // Clamp on BOTH sides: a negative index passed the `current < keyCount` check straight through.
      // And we fall back to the FIRST key, not the last one: the last one is submit, and after an
      // external layout change the tab stop moved to Enter instead of a letter.
      if (current >= 0 && current < keyCount) return current;
      return Math.min(firstLetter, Math.max(0, keyCount - 1));
    });
  }, [keyCount, firstLetter]);

  useEffect(() => {
    if (!focusFirstLetterAfterLayoutChange.current) return;
    focusFirstLetterAfterLayoutChange.current = false;
    // The tab stop always moves; under `preserveFocus` only the focus move itself is skipped,
    // because taking focus away from the input field is not allowed there.
    setActiveIndex(firstLetter);
    if (preserveFocus) return;
    buttons.current[firstLetter]?.focus();
  }, [firstLetter, layout, preserveFocus]);

  useEffect(() => {
    if (!focusSymbolsAfterChange.current) return;
    focusSymbolsAfterChange.current = false;
    // The tab stop always moves; under `preserveFocus` only the focus move itself is skipped,
    // because taking focus away from the input field is not allowed there.
    setActiveIndex(symbolsIndex);
    if (preserveFocus) return;
    buttons.current[symbolsIndex]?.focus();
  }, [preserveFocus, symbols, symbolsIndex]);

  useEffect(() => {
    if (!focusSymbolShiftAfterChange.current) return;
    focusSymbolShiftAfterChange.current = false;
    if (symbolShiftIndex < 0) return;
    setActiveIndex(symbolShiftIndex);
    if (preserveFocus) return;
    buttons.current[symbolShiftIndex]?.focus();
  }, [preserveFocus, symbolShifted, symbolShiftIndex]);

  const apply = (text: string) => {
    const next = replaceKeyboardSelection(value, selection, text);
    onChange(next.value);
    onSelectionChange(next.selection);
    if (shifted) setShifted(false);
  };

  const toggleShift = () => {
    if (capsLocked) {
      setCapsLocked(false);
      setShifted(false);
      return;
    }
    setShifted((current) => !current);
  };

  const lockShift = () => {
    setCapsLocked(true);
    setShifted(false);
  };

  const activate = (key: KeyboardKey) => {
    switch (key.action) {
      case "text":
        apply(key.text ?? key.label);
        return;
      case "space":
        apply(" ");
        return;
      case "backspace": {
        const next = deletePreviousKeyboardCodePoint(value, selection);
        onChange(next.value);
        onSelectionChange(next.selection);
        return;
      }
      case "shift":
        toggleShift();
        return;
      case "symbols":
        focusSymbolsAfterChange.current = true;
        setShifted(false);
        setSymbolShifted(false);
        setSymbols((current) => !current);
        return;
      case "symbolShift":
        focusSymbolShiftAfterChange.current = true;
        setShifted(false);
        setSymbolShifted((current) => !current);
        return;
      case "layout":
        focusFirstLetterAfterLayoutChange.current = true;
        setShifted(false);
        setSymbols(false);
        setSymbolShifted(false);
        onLayoutChange(layout === "ru" ? "en" : "ru");
        return;
      case "submit":
        onSubmit?.();
    }
  };

  const moveFocus = (from: number, key: string) => {
    let row = 0;
    let rowStart = 0;
    for (; row < rows.length; row++) {
      const current = rows[row] ?? [];
      if (from < rowStart + current.length) break;
      rowStart += current.length;
    }
    row = Math.min(row, rows.length - 1);
    const currentRow = rows[row] ?? [];
    const column = from - rowStart;
    let next = from;
    if (key === "ArrowLeft") next = Math.max(rowStart, from - 1);
    if (key === "ArrowRight") next = Math.min(rowStart + currentRow.length - 1, from + 1);
    if (key === "Home") next = rowStart;
    if (key === "End") next = rowStart + currentRow.length - 1;
    if (key === "ArrowUp" || key === "ArrowDown") {
      const targetRow = Math.max(0, Math.min(rows.length - 1, row + (key === "ArrowUp" ? -1 : 1)));
      const targetStart = rows
        .slice(0, targetRow)
        .reduce((count, current) => count + current.length, 0);
      next = targetStart + Math.min(column, (rows[targetRow] ?? []).length - 1);
    }
    setActiveIndex(next);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"].includes(event.key)) {
      event.preventDefault();
      moveFocus(index, event.key);
    }
  };

  const preserveExternalFocus = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (preserveFocus) event.preventDefault();
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || panel.current == null) return;

    const rect = panel.current.getBoundingClientRect();
    dragStart.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: position.x,
      positionY: position.y,
      originX: rect.left - position.x,
      originY: rect.top - position.y,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (start == null || start.pointerId !== event.pointerId || event.buttons !== 1) return;

    setPosition(
      constrainPosition(
        {
          x: start.positionX + event.clientX - start.pointerX,
          y: start.positionY + event.clientY - start.pointerY,
        },
        start
      )
    );
    event.preventDefault();
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    dragStart.current = null;
    setDragging(false);
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.shiftKey ? 64 : 24;
    const direction = KEYBOARD_MOVE_OFFSETS[event.key];
    const offset = direction && { x: direction.x * delta, y: direction.y * delta };
    if (offset == null || panel.current == null) return;

    event.preventDefault();
    setPosition((current) => {
      const rect = panel.current!.getBoundingClientRect();
      return constrainPosition(
        { x: current.x + offset.x, y: current.y + offset.y },
        {
          originX: rect.left - current.x,
          originY: rect.top - current.y,
          width: rect.width,
          height: rect.height,
        }
      );
    });
  };

  let index = 0;
  return (
    <section
      ref={panel}
      role="group"
      aria-label={label ?? panelTitle(layout, messages)}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      className="bg-bg-1 pointer-events-auto hidden w-[28rem] max-w-full flex-none flex-col gap-1 rounded-md p-2 md:flex"
    >
      <div
        data-keyboard-drag-handle
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`flex touch-none items-center justify-between gap-2 pb-0.5 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            aria-label={messages.keyboard.move}
            onKeyDown={moveWithKeyboard}
            className="text-fg-3 hover:text-fg-0 focus-visible:outline-accent-strong flex shrink-0 rounded-xs p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <DragHandleIcon size={16} aria-hidden />
          </button>
          <p className="text-fg-2 m-0 text-base font-semibold">
            {label ?? panelTitle(layout, messages)}
          </p>
        </div>
        {onRequestClose ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={closeLabel ?? messages.keyboard.close}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRequestClose}
            className="text-fg-3 hover:text-fg-0 focus-visible:outline-accent-strong flex rounded-xs p-1 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <CloseIcon size={18} aria-hidden />
          </button>
        ) : null}
      </div>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap justify-center gap-1">
          {row.map((key) => {
            const keyIndex = index++;
            return (
              <button
                key={`${rowIndex}-${keyIndex}-${key.label}`}
                ref={(node) => {
                  if (node != null) buttons.current[keyIndex] = node;
                }}
                type="button"
                disabled={disabled}
                tabIndex={activeIndex === keyIndex ? 0 : -1}
                aria-label={key.ariaLabel}
                aria-pressed={
                  key.action === "shift"
                    ? shifted || capsLocked
                    : key.action === "symbols"
                      ? symbols
                      : key.action === "symbolShift"
                        ? symbolShifted
                        : undefined
                }
                data-keyboard-letter={key.letter || undefined}
                onPointerDown={preserveExternalFocus}
                onFocus={() => setActiveIndex(keyIndex)}
                onKeyDown={(event) => onKeyDown(event, keyIndex)}
                onClick={() => activate(key)}
                onDoubleClick={key.action === "shift" ? lockShift : undefined}
                className={keyClassName(key)}
              >
                {key.icon === "language" ? (
                  <LanguageIcon size={18} aria-hidden />
                ) : key.icon === "enter" ? (
                  <EnterIcon size={18} aria-hidden />
                ) : (
                  key.label
                )}
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
