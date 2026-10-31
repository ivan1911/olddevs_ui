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
  /** Consumer-computed adjacency and time grouping; no grouping is inferred here. */
  groupPosition?: "single" | "first" | "middle" | "last";
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const GROUP_CORNERS = {
  user: {
    single: "rounded-br-none",
    first: "rounded-br-xs",
    middle: "rounded-tr-xs rounded-br-xs",
    last: "rounded-tr-xs rounded-br-none",
  },
  assistant: {
    single: "rounded-bl-none",
    first: "rounded-bl-xs",
    middle: "rounded-tl-xs rounded-bl-xs",
    last: "rounded-tl-xs rounded-bl-none",
  },
} as const;

/** One presented message; identity, order, retries and persistence stay outside. */
export function ChatMessage({
  author,
  speaker,
  timestamp,
  dateTime,
  inputMethod,
  state = "complete",
  groupPosition = "single",
  children,
  actions,
  className,
}: ChatMessageProps) {
  const authorId = useId();
  const messages = useMessages().chatMessage;
  return (
    <div className="min-w-0 px-4 py-px">
      <article
        aria-labelledby={authorId}
        data-speaker={speaker}
        data-state={state}
        data-group-position={groupPosition}
        className={cn(
          "border-line relative w-fit max-w-full min-w-0 rounded-lg border p-4",
          speaker === "user" ? "bg-bg-2 mr-0 ml-auto" : "bg-bg-1 mr-auto ml-0",
          GROUP_CORNERS[speaker][groupPosition],
          className
        )}
      >
        <header className="text-fg-2 mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm [overflow-wrap:anywhere]">
          <span id={authorId} className="text-fg-0 min-w-0 font-semibold">
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
        {(groupPosition === "single" || groupPosition === "last") && (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 24"
            className={cn(
              "pointer-events-none absolute -bottom-px h-6 w-4 overflow-visible",
              speaker === "user" ? "-right-3.5 -scale-x-100" : "-left-3.5"
            )}
          >
            <path
              d="M16 0C16 12 11 21 1 23H16Z"
              className={speaker === "user" ? "fill-bg-2" : "fill-bg-1"}
            />
            <path
              d="M16 0C16 12 11 21 1 23H16"
              fill="none"
              className="stroke-line"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </article>
    </div>
  );
}
