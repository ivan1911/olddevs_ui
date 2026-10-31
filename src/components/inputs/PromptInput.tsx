"use client";

import { forwardRef, useId, useRef, type ReactNode, type Ref } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../actions/Button.js";
import { TextControl } from "./TextControl.js";

export interface PromptInputProps {
  /** Controlled draft. Acceptance and clearing belong to the consumer. */
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Visible field label and its accessible name; a placeholder is not a label. */
  label: string;
  /** Blocks sending while leaving the draft editable. Defaults to true. */
  canSubmit?: boolean;
  disabled?: boolean;
  rows?: number;
  maxRows?: number;
  id?: string;
  name?: string;
  placeholder?: string;
  maxLength?: number;
  "aria-describedby"?: string;
  className?: string;
  /** Extra consumer actions beside Send; their policy belongs to the consumer. */
  actions?: ReactNode;
  /** Additional content below the field, such as a status or a voice panel. */
  children?: ReactNode;
}

/** A controlled message draft on TextControl, without a transport or run lifecycle. */
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput(
  {
    value,
    onValueChange,
    onSubmit,
    label,
    canSubmit = true,
    disabled = false,
    rows = 2,
    maxRows = 6,
    actions,
    children,
    className,
    id,
    ...fieldProps
  },
  ref
) {
  const messages = useMessages();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const composing = useRef(false);
  const send = () => {
    if (!disabled && canSubmit && value.trim()) onSubmit(value);
  };
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={fieldId} className="text-fg-0 text-sm font-medium">
        {label}
      </label>
      <TextControl
        {...fieldProps}
        id={fieldId}
        // TextControl's historical ref type is input-only; as="textarea" creates a real textarea.
        ref={ref as unknown as Ref<HTMLInputElement>}
        as="textarea"
        rows={rows}
        autosize
        maxRows={maxRows}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (
            composing.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          )
            return;
          event.preventDefault();
          send();
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        trailing={
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {actions}
            <Button
              tone="accent"
              variant="solid"
              disabled={disabled || !canSubmit || !value.trim()}
              onClick={send}
            >
              {messages.promptInput.send}
            </Button>
          </div>
        }
      />
      {children}
    </div>
  );
});
