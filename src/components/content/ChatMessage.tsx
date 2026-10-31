"use client";

import { useId, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";

export interface ChatMessageProps {
  author: ReactNode;
  speaker: "user" | "assistant";
  timestamp?: ReactNode;
  dateTime?: string;
  inputMethod?: "text" | "voice";
  state?: "complete" | "streaming" | "provisional" | "interrupted";
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** One presented message; identity, order, retries and persistence stay outside. */
export function ChatMessage({
  author,
  speaker,
  timestamp,
  dateTime,
  inputMethod,
  state = "complete",
  children,
  actions,
  className,
}: ChatMessageProps) {
  const authorId = useId();
  const messages = useMessages().chatMessage;
  return (
    <article
      aria-labelledby={authorId}
      data-speaker={speaker}
      data-state={state}
      className={cn(
        "border-line min-w-0 rounded-lg border p-4",
        speaker === "user" ? "bg-bg-2" : "bg-bg-1",
        className
      )}
    >
      <header className="text-fg-2 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span id={authorId} className="text-fg-0 font-semibold">
          {author}
        </span>
        {timestamp != null &&
          (dateTime ? <time dateTime={dateTime}>{timestamp}</time> : <span>{timestamp}</span>)}
        {inputMethod && (
          <span>{inputMethod === "voice" ? messages.voiceInput : messages.textInput}</span>
        )}
        {state !== "complete" && <span>{messages[state]}</span>}
      </header>
      <div className="text-fg-0 min-w-0 [overflow-wrap:anywhere]">{children}</div>
      {actions != null && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </article>
  );
}
