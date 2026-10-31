import { useRef, type ReactNode, type RefObject } from "react";
import {
  Button,
  ChatMessage,
  ChatTranscript,
  CopyButton,
  EmptyState,
  PromptInput,
} from "../../src/index.js";
import { messageDateTime, messageGroupPositions } from "./messageGroups.js";
import type { ChatDemoController, DemoMessage } from "./useChatDemo.js";

/** Internal consumer composition shared by the separate chat recipes. */
export interface ChatDemoFrameProps {
  chat: ChatDemoController;
  label?: string;
  title?: string;
  description?: string;
  controls?: ReactNode;
  messageBody?: (message: DemoMessage) => ReactNode;
  messageExtras?: (message: DemoMessage) => ReactNode;
  composerContent?: ReactNode;
  onSubmit?: (text: string) => void;
  canSubmit?: boolean;
  onReset?: () => void;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
}
export function ChatDemoFrame({
  chat,
  label = "Basic text chat example",
  title = "Planning assistant",
  description = "Simulated conversation. No AI backend or microphone.",
  controls,
  messageBody,
  messageExtras,
  composerContent,
  onSubmit,
  canSubmit,
  onReset,
  composerRef,
}: ChatDemoFrameProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const field = composerRef ?? internalRef;
  const groupPositions = messageGroupPositions(
    chat.messages.map((message) => ({
      authorId: message.authorId ?? "",
      createdAt: message.createdAt,
    }))
  );
  return (
    <section
      aria-label={label}
      className="border-line bg-bg-0 mx-auto flex h-[560px] max-h-[85dvh] w-full max-w-3xl min-w-0 flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-fg-0 font-semibold">{title}</h2>
          <p className="text-fg-2 text-sm">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onReset ?? chat.reset}>
          Reset chat
        </Button>
      </header>
      <ChatTranscript label="Conversation" className="min-h-0 flex-1">
        {!chat.messages.length && (
          <EmptyState
            title="Start a conversation"
            description="Write a message below, then complete the simulated response."
          />
        )}
        {chat.messages.map((message, index) => (
          <div
            key={message.id}
            className={
              groupPositions[index] === "middle" || groupPositions[index] === "last"
                ? "-mt-2"
                : undefined
            }
          >
            <ChatMessage
              groupPosition={groupPositions[index]}
              dateTime={messageDateTime(message.createdAt)}
              author={message.speaker === "user" ? "You" : "Assistant"}
              speaker={message.speaker}
              timestamp={message.timestamp}
              inputMethod={message.inputMethod ?? "text"}
              state={message.state}
              actions={
                message.speaker === "assistant" && message.text.trim() ? (
                  <CopyButton value={message.text} size="sm" />
                ) : undefined
              }
            >
              {messageBody ? (
                messageBody(message)
              ) : (
                <p className="whitespace-pre-wrap">{message.text}</p>
              )}
              {messageExtras?.(message)}
            </ChatMessage>
          </div>
        ))}
        {chat.phase === "responding" &&
          !chat.messages.some((message) => message.id === chat.responseId) && (
            <p className="text-fg-2 text-sm">Waiting for a simulated response…</p>
          )}
      </ChatTranscript>
      {chat.error && <p className="text-danger-strong text-sm">{chat.error}</p>}
      {chat.canRetry && (
        <Button
          className="self-start"
          onClick={() => {
            field.current?.focus({ preventScroll: true });
            chat.retry();
          }}
        >
          Retry response
        </Button>
      )}
      {chat.phase === "accepting" && (
        <Button
          className="self-start"
          onClick={() => {
            field.current?.focus({ preventScroll: true });
            chat.stop();
          }}
        >
          Cancel send
        </Button>
      )}
      {controls && <div className="flex shrink-0 flex-wrap items-center gap-2">{controls}</div>}
      <PromptInput
        ref={field}
        label="Message"
        value={chat.draft}
        onValueChange={chat.setDraft}
        onSubmit={(text) => {
          field.current?.focus({ preventScroll: true });
          (onSubmit ?? chat.send)(text);
        }}
        canSubmit={canSubmit ?? chat.phase === "idle"}
      >
        {composerContent}
      </PromptInput>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {chat.announcement}
      </div>
    </section>
  );
}
