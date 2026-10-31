import type { ReactNode } from "react";
import { Button, ChatMessage, ChatTranscript } from "../../src/index.js";
import { messageDateTime, messageGroupPositions, type TimedAuthor } from "./messageGroups.js";

export interface BubbleMessage extends TimedAuthor {
  id: string;
  author: string;
  speaker: "user" | "assistant";
  displayTime?: string;
  text: string;
  body?: ReactNode;
  actionLabel?: string;
}

/** A rendered consumer seam: real fixture times are separate from the visible time captions. */
export function BubbleExample({ messages }: { messages: readonly BubbleMessage[] }) {
  const positions = messageGroupPositions(messages);
  return (
    <ChatTranscript label="Bubble examples" className="max-w-3xl">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={
            positions[index] === "middle" || positions[index] === "last" ? "-mt-2" : undefined
          }
        >
          <ChatMessage
            author={message.author}
            speaker={message.speaker}
            groupPosition={positions[index]}
            timestamp={message.displayTime}
            dateTime={messageDateTime(message.createdAt)}
            actions={
              message.actionLabel ? <Button size="sm">{message.actionLabel}</Button> : undefined
            }
          >
            {message.body ?? message.text}
          </ChatMessage>
        </div>
      ))}
    </ChatTranscript>
  );
}
