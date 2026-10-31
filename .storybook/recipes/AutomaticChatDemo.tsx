import { useEffect, useRef } from "react";
import { Button } from "../../src/index.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import { useChatDemo, type DemoMessage, type DemoResponseHandler } from "./useChatDemo.js";

const HISTORY: DemoMessage[] = Array.from({ length: 20 }, (_, index) => ({
  id: `history-${index}`,
  speaker: index % 2 ? "assistant" : "user",
  timestamp: "16:40",
  inputMethod: "text",
  text: `Message ${index + 1}. ${"A previous part of the conversation remains readable. ".repeat(5)}`,
}));
const CHUNKS = Array.from(
  { length: 12 },
  () => "A simulated streamed sentence arrives without changing the lifecycle announcement. "
);

/** A local timer fixture for reading/focus checks; no media or model connection. */
export function AutomaticChatDemo() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const clearTimers = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  };
  useEffect(() => () => clearTimers(), []);
  const stream: DemoResponseHandler = (_text, response) => {
    CHUNKS.forEach((chunk, index) => {
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          response.append(chunk);
          if (index === CHUNKS.length - 1) response.complete();
        },
        400 * (index + 1)
      );
      timers.current.add(timer);
    });
  };
  const chat = useChatDemo({ initialMessages: HISTORY, onStart: stream, onRetry: stream });
  return (
    <ChatDemoFrame
      chat={chat}
      composerRef={composerRef}
      label="Streaming history example"
      description="Local timer fixtures simulate text streaming. No network or microphone."
      onReset={() => {
        clearTimers();
        chat.reset();
      }}
      messageExtras={(message) => (
        <details>
          <summary className="mt-2 cursor-pointer">Details for {message.id}</summary>
          <p>{"Additional reading context. ".repeat(30)}</p>
        </details>
      )}
      controls={
        chat.phase === "responding" && (
          <Button
            onClick={() => {
              composerRef.current?.focus({ preventScroll: true });
              clearTimers();
              chat.stop();
            }}
          >
            Stop response
          </Button>
        )
      }
    />
  );
}
