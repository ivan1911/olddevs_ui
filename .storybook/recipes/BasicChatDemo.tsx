import { useRef, useState } from "react";
import { Button, ChatMessage, ChatTranscript, EmptyState, PromptInput } from "../../src/index.js";

/** Demonstration consumer data, deliberately outside the package's runtime API. */
export interface DemoMessage {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface BasicChatDemoProps {
  /** Optional external request handler. Without it, Complete response supplies a fixture. */
  request?: (text: string) => Promise<string>;
}

/** A resettable text path with externally owned history and explicit simulated events. */
export function BasicChatDemo({ request }: BasicChatDemoProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const locked = useRef(false);
  const sequence = useRef(0);
  const generation = useRef(0);
  const finish = (text: string, run: number) => {
    if (run !== generation.current || !locked.current) return;
    locked.current = false;
    setPending(false);
    setMessages((items) => [
      ...items,
      { id: `message-${++sequence.current}`, speaker: "assistant", text, timestamp: "16:50" },
    ]);
    setAnnouncement("Assistant response complete.");
  };
  const submit = (text: string) => {
    if (locked.current) return;
    locked.current = true;
    const run = ++generation.current;
    setMessages((items) => [
      ...items,
      { id: `message-${++sequence.current}`, speaker: "user", text, timestamp: "16:54" },
    ]);
    setDraft("");
    setPending(true);
    setAnnouncement("Assistant response started.");
    if (request)
      void request(text)
        .then((answer) => finish(answer, run))
        .catch(() => {
          if (run !== generation.current) return;
          locked.current = false;
          setPending(false);
          setAnnouncement("The example request failed.");
        });
  };
  return (
    <section
      aria-label="Basic text chat example"
      className="border-line bg-bg-0 mx-auto flex h-[560px] max-h-[85dvh] w-full max-w-3xl min-w-0 flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-fg-0 font-semibold">Planning assistant</h2>
          <p className="text-fg-2 text-sm">Simulated conversation. No AI backend or microphone.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            generation.current += 1;
            locked.current = false;
            setMessages([]);
            setDraft("");
            setPending(false);
            setAnnouncement("");
          }}
        >
          Reset chat
        </Button>
      </header>
      <ChatTranscript label="Conversation" className="min-h-0 flex-1">
        {!messages.length && (
          <EmptyState
            title="Start a conversation"
            description="Write a message below, then complete the simulated response."
          />
        )}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            author={message.speaker === "user" ? "You" : "Assistant"}
            speaker={message.speaker}
            timestamp={message.timestamp}
            inputMethod="text"
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
          </ChatMessage>
        ))}
        {pending && <p className="text-fg-2 text-sm">Waiting for a simulated response…</p>}
      </ChatTranscript>
      {!request && pending && (
        <Button
          className="self-start"
          onClick={() =>
            finish(
              "Choose one clear goal, collect the relevant context, and plan the next small step.",
              generation.current
            )
          }
        >
          Complete response
        </Button>
      )}
      <PromptInput
        label="Message"
        value={draft}
        onValueChange={setDraft}
        onSubmit={submit}
        canSubmit={!pending}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}
