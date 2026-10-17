"use client";

import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ChangeEvent,
} from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CloseIcon, KeyboardIcon, SearchIcon } from "../../icons.js";
import { Keyboard, type KeyboardLayout, type KeyboardSelection } from "../content/Keyboard.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TextControl } from "./TextControl.js";

export interface SearchKeyboardConfig {
  /** The current layout is controlled by the consumer, the same way as the search value. */
  layout: KeyboardLayout;
  /**
   * Called when the user switches the layout; the consumer is responsible for saving the new one.
   */
  onLayoutChange: (nextLayout: KeyboardLayout) => void;
  /** Opens the panel on the first render, for a scenario where it is expanded in advance. */
  defaultOpen?: boolean;
  /** Submits the query on the Enter key of the on-screen keyboard. */
  onSubmit?: () => void;
  /**
   * The accessible name of the button that opens the on-screen keyboard. Without it, the name
   * comes from the message catalog.
   */
  triggerLabel?: string;
  /**
   * The accessible name of the on-screen keyboard panel. Without it, the name comes from the
   * message catalog.
   */
  keyboardLabel?: string;
}

export interface SearchControlProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "type" | "size" | "aria-label"
> {
  /** The query text. The field is controlled: the consumer holds the value. */
  value: string;
  /**
   * Called when the text changes; receives the string.
   *
   * Passes a string, not an event. For a search field, the value is the whole point;
   * all five hand-written copies in the frontend first pulled out `e.target.value`.
   */
  onChange: (value: string) => void;
  /**
   * The accessible name. Required, and the compiler enforces it, as with `Toggle`.
   *
   * A placeholder is not a name: it disappears at the first character, and the screen reader is
   * left with an unnamed field exactly when there is something in it to read. If `aria-labelledby`
   * is needed, it passes straight through `...rest`.
   */
  label: string;
  /** The clear button, shown when the field has content. */
  clearable?: boolean;
  /**
   * The accessible name of the clear button. Without it, the name comes from the message catalog.
   */
  clearLabel?: string;
  /** Classes for the bordered shell: width, corner rounding, vertical inner padding. */
  shellClassName?: string;
  /**
   * The height step of the field: `md` is 42 px, `sm` is 36. Forwarded to `TextControl`.
   *
   * The step lives there, not here: search deliberately sits on `TextControl`, and a custom height
   * for search would mean a second way to compute it inside the package itself, exactly the
   * divergence `SearchControl` was created to prevent.
   */
  size?: "sm" | "md";
  /** Adds the on-screen keyboard; without this prop, the search markup does not change. */
  keyboard?: SearchKeyboardConfig;
}

/**
 * Search field: a magnifier on the left, a clear cross on the right.
 *
 * IT SITS ON `TextControl`, NOT ON ITS OWN SHELL, and this is the main decision here.
 * The front end had five hand-written fields of this kind (the category-change dialog, the
 * collections dialog, the wallpaper picker, the library filter, the global search in the header),
 * and all five painted focus in `--tg`, while regular fields via `TextControl` used
 * `--accent-strong`. So search across the whole app was focused differently from the other fields,
 * and this could not be spotted from the code: the divergence is visible only if you open five
 * files side by side. An own shell here would mean a sixth copy, this time inside the package.
 *
 * WHAT THE COMPONENT DELIBERATELY DOES NOT DO:
 *
 * - **Does not intercept Escape.** It is tempting to clear the field on Escape, as the library
 *   filter does. But search most often sits inside a modal dialog, and there Escape closes the
 *   dialog; intercepting it would break the closing exactly when focus is in the search, that is,
 *   almost always. Whoever needs clearing on Escape attaches `onKeyDown` themselves: it passes
 *   straight through.
 *
 * - **Does not debounce calls.** Debounce depends on what sits behind the search: local filtering
 *   of an array in a dialog needs no delay at all, while an API request does. The package does not
 *   know which one it is, and a built-in delay cannot be turned off.
 *
 * CLEARING RETURNS FOCUS TO THE FIELD. The cross unmounts at that moment, and without an explicit
 * return focus moves to `<body>`: a keyboard user loses their place in the dialog and has to start
 * navigating again from the beginning.
 */
export const SearchControl = forwardRef<HTMLInputElement, SearchControlProps>(
  function SearchControl(
    {
      value,
      onChange,
      label,
      clearable = true,
      clearLabel,
      placeholder,
      shellClassName,
      size,
      className,
      disabled,
      keyboard,
      onSelect,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
    const [keyboardOpen, setKeyboardOpen] = useState(() => keyboard?.defaultOpen ?? false);
    const [selection, setSelection] = useState<KeyboardSelection>({
      start: value.length,
      end: value.length,
    });

    const showClear = clearable && value !== "" && !disabled;
    // The layout label comes from the `keyboard.*` key rather than being written out here a second
    // time: until 2.0.0 this same string lived in both `Keyboard.tsx` and here, and the two copies
    // would have drifted apart silently.
    const keyboardLabel =
      keyboard?.keyboardLabel ??
      messages.keyboard.label({ layout: keyboard?.layout === "ru" ? "ru" : "en" });
    /*
      A value change from OUTSIDE moves the position to the end.

      The position was updated by `onChange`, `onSelect` and the trigger button's `onPointerDown`,
      that is, only on pointer interaction. A keyboard user tabbed to the button and pressed Enter:
      `pointerdown` did not fire, and the position stayed at `{0,0}` from mount. The value can be
      non-empty at that point (a restored query), and the first character typed from the on-screen
      keyboard was inserted at the START of the string.

      Reading the position from the DOM instead of state is NOT allowed: when typing with the
      on-screen keyboard, focus stays on its button rather than in the field, and the caret in the
      DOM ends up at the end, so replacing the selection breaks. So state stays the source of truth,
      and synchronization happens only when the value changed NOT by us.
    */
    const ownValue = useRef<string | null>(null);
    useEffect(() => {
      if (ownValue.current === value) return;
      setSelection({ start: value.length, end: value.length });
    }, [value]);

    const emit = (next: string) => {
      ownValue.current = next;
      onChange(next);
    };

    const rememberSelection = (target: HTMLInputElement) => {
      setSelection({ start: target.selectionStart ?? 0, end: target.selectionEnd ?? 0 });
    };
    const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
      rememberSelection(event.currentTarget);
      onSelect?.(event);
    };

    const control = (
      <TextControl
        ref={innerRef}
        // `type="search"` gives the `searchbox` role and the search keyboard on a phone. WebKit's
        // native cross is removed by the class below; otherwise Safari would show two clear
        // buttons,
        // side by side and in different looks.
        type="search"
        value={value}
        onChange={(event) => {
          emit(event.target.value);
          rememberSelection(event.currentTarget);
        }}
        onSelect={handleSelect}
        aria-label={label}
        placeholder={placeholder ?? messages.common.searchPlaceholder}
        disabled={disabled}
        icon={<SearchIcon size={14} aria-hidden />}
        trailing={
          keyboard || showClear ? (
            <div className="flex items-center gap-1">
              {keyboard ? (
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={keyboard.triggerLabel ?? messages.searchControl.openKeyboard}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (innerRef.current) rememberSelection(innerRef.current);
                    }}
                    className={cn(
                      "text-fg-3 hover:text-fg-0 hidden cursor-pointer items-center rounded-xs md:flex",
                      "transition-colors",
                      "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    <KeyboardIcon size={16} aria-hidden />
                  </button>
                </PopoverTrigger>
              ) : null}
              {showClear ? (
                <button
                  type="button"
                  aria-label={clearLabel ?? messages.searchControl.clear}
                  onClick={() => {
                    onChange("");
                    innerRef.current?.focus();
                  }}
                  className={cn(
                    "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs",
                    "transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
                  )}
                >
                  <CloseIcon size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null
        }
        shellClassName={shellClassName}
        size={size}
        className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
        {...rest}
      />
    );

    if (!keyboard) return control;

    return (
      <Popover open={keyboardOpen} onOpenChange={setKeyboardOpen}>
        {control}
        <PopoverContent
          aria-label={keyboardLabel}
          className="pointer-events-none w-auto max-w-[calc(100vw-2rem)] border-0 bg-transparent shadow-none"
          onClickCapture={(event) => {
            if (event.detail !== 0) innerRef.current?.focus();
          }}
          onFocusOutside={(event) => {
            if (event.target === innerRef.current) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <Keyboard
            value={value}
            selection={selection}
            onChange={emit}
            onSelectionChange={setSelection}
            layout={keyboard.layout}
            onLayoutChange={keyboard.onLayoutChange}
            onSubmit={keyboard.onSubmit}
            disabled={disabled}
            preserveFocus
            label={keyboardLabel}
            onRequestClose={() => setKeyboardOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
