import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../src/index.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import {
  useChatDemo,
  type DemoMessage,
  type DemoResponseControls,
  type DemoResponseHandler,
} from "./useChatDemo.js";
import {
  VoicePanelPresentation,
  type VoiceAgentState,
  type VoiceConnectionState,
} from "./VoicePanelPresentation.js";

export interface VoiceChatDemoProps {
  assistantName?: string;
  visualizer?: ReactNode;
  initialConnection?: VoiceConnectionState;
  initialAgent?: VoiceAgentState;
  initialMuted?: boolean;
  initialExpanded?: boolean;
  initialMessages?: DemoMessage[];
}

/** Explicit consumer fixtures: no speech recognition, audio playback or device access. */
export function VoiceChatDemo({
  assistantName = "Guide",
  visualizer,
  initialConnection = "disconnected",
  initialAgent = initialConnection === "ready" ? "listening" : "idle",
  initialMuted = false,
  initialExpanded = false,
  initialMessages,
}: VoiceChatDemoProps) {
  const [connection, setConnection] = useState(initialConnection);
  const [agent, setAgent] = useState(initialAgent);
  const [muted, setMuted] = useState(initialMuted);
  const [expanded, setExpanded] = useState(initialExpanded);
  const connectionRef = useRef(connection);
  const interimId = useRef<string | null>(null);
  const voiceSequence = useRef(0);
  const partialCount = useRef(0);
  const response = useRef<DemoResponseControls | null>(null);
  const responseMode = useRef<"text" | "voice">("text");
  // Acceptance is guarded synchronously, before React updates the composer availability.
  const textSendPending = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const changeConnection = (next: VoiceConnectionState) => {
    connectionRef.current = next;
    setConnection(next);
  };
  const receiveRequest: DemoResponseHandler = (_text, next) => {
    textSendPending.current = false;
    response.current = next;
    responseMode.current = connectionRef.current === "ready" ? "voice" : "text";
    if (responseMode.current === "voice") setAgent("processing");
  };
  const chat = useChatDemo({ initialMessages, onStart: receiveRequest, onRetry: receiveRequest });
  const focusComposer = () => composerRef.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (chat.phase === "idle") textSendPending.current = false;
  }, [chat.phase]);
  const removeInterim = () => {
    const id = interimId.current;
    if (id) chat.updateMessages((items) => items.filter((message) => message.id !== id));
    interimId.current = null;
  };
  const showInterim = () => {
    if (connectionRef.current !== "ready" || muted) return;
    const id = interimId.current ?? `voice-interim-${++voiceSequence.current}`;
    interimId.current = id;
    const text = partialCount.current++ ? "I would like to plan a visit" : "I would like to";
    chat.updateMessages((items) =>
      items.some((message) => message.id === id)
        ? items.map((message) => (message.id === id ? { ...message, text } : message))
        : [
            ...items,
            {
              id,
              speaker: "user",
              text,
              timestamp: "16:55",
              inputMethod: "voice",
              state: "provisional",
            },
          ]
    );
  };
  const finalizeTranscript = () => {
    if (connectionRef.current !== "ready" || !interimId.current) return;
    const unsentDraft = chat.draft;
    focusComposer();
    chat.stop();
    removeInterim();
    // The consumer reconciles temporary speech with one accepted canonical message.
    chat.send("I would like to plan a visit tomorrow.");
    // Incoming recognized speech is not submission of the user's independently edited draft.
    chat.setDraft(unsentDraft);
    chat.updateMessages((items) => {
      const lastUser = items.reduce(
        (last, message, index) => (message.speaker === "user" ? index : last),
        -1
      );
      return items.map((message, index) =>
        index === lastUser ? { ...message, inputMethod: "voice", timestamp: "16:55" } : message
      );
    });
    partialCount.current = 0;
  };
  const appendVoiceAnswer = () => {
    if (
      connectionRef.current !== "ready" ||
      chat.phase !== "responding" ||
      responseMode.current !== "voice"
    )
      return;
    response.current?.append("We can continue this conversation by voice or text. ");
    const id = response.current?.responseId;
    chat.updateMessages((items) =>
      items.map((message) => (message.id === id ? { ...message, inputMethod: "voice" } : message))
    );
    setAgent("speaking");
  };
  const finishVoiceAnswer = () => {
    if (
      connectionRef.current !== "ready" ||
      chat.phase !== "responding" ||
      responseMode.current !== "voice"
    )
      return;
    focusComposer();
    if (!chat.messages.some((message) => message.id === response.current?.responseId))
      appendVoiceAnswer();
    response.current?.complete();
    setAgent("listening");
  };
  const sendText = (text: string) => {
    if (!text.trim() || textSendPending.current || chat.phase === "accepting") return;
    if (chat.phase !== "idle" && connectionRef.current !== "ready") return;
    if (connectionRef.current === "ready") chat.stop();
    textSendPending.current = true;
    chat.send(text);
  };
  const endVoice = () => {
    focusComposer();
    if (responseMode.current === "voice") chat.stop();
    removeInterim();
    changeConnection("disconnected");
    setAgent("idle");
  };
  const reset = () => {
    textSendPending.current = false;
    chat.reset();
    interimId.current = null;
    response.current = null;
    partialCount.current = 0;
    changeConnection(initialConnection);
    setAgent(initialAgent);
    setMuted(initialMuted);
    setExpanded(initialExpanded);
  };
  const voiceResponding =
    connection === "ready" && chat.phase === "responding" && responseMode.current === "voice";
  const hasVoiceAnswer = chat.messages.some(
    (message) => message.speaker === "assistant" && message.inputMethod === "voice"
  );
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3">
      <section
        aria-label="Voice simulation controls"
        className="border-line bg-bg-1 flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-3"
      >
        <p className="text-fg-2 basis-full text-xs">
          Simulated events; these controls do not connect a microphone or play audio.
        </p>
        <Button
          size="sm"
          disabled={connection !== "connecting"}
          onClick={() => {
            focusComposer();
            changeConnection("ready");
            setAgent("listening");
          }}
        >
          Connection ready
        </Button>
        <Button
          size="sm"
          disabled={connection === "disconnected" || connection === "error"}
          onClick={() => {
            focusComposer();
            if (responseMode.current === "voice") chat.stop();
            changeConnection("error");
            setAgent("idle");
          }}
        >
          Connection failed
        </Button>
        <Button size="sm" disabled={connection !== "ready" || muted} onClick={showInterim}>
          Show interim transcript
        </Button>
        <Button
          size="sm"
          disabled={connection !== "ready" || !interimId.current}
          onClick={finalizeTranscript}
        >
          Finalize transcript
        </Button>
        <Button size="sm" disabled={!voiceResponding} onClick={appendVoiceAnswer}>
          Append voice answer
        </Button>
        <Button size="sm" disabled={!voiceResponding} onClick={finishVoiceAnswer}>
          Finish voice answer
        </Button>
        <Button
          size="sm"
          disabled={connection !== "ready" || !hasVoiceAnswer}
          onClick={() => setAgent("speaking")}
        >
          Simulate audio playback
        </Button>
        <Button
          size="sm"
          disabled={connection !== "ready" || agent !== "speaking"}
          onClick={() => setAgent("listening")}
        >
          Playback finished
        </Button>
      </section>
      <ChatDemoFrame
        chat={chat}
        label="Voice and text conversation example"
        title={`${assistantName} conversation`}
        description="One simulated conversation. No AI backend, microphone or audio."
        composerRef={composerRef}
        onReset={reset}
        onSubmit={sendText}
        canSubmit={chat.phase !== "accepting" && (chat.phase === "idle" || connection === "ready")}
        controls={
          chat.phase === "responding" &&
          responseMode.current === "text" && (
            <Button
              onClick={() => {
                focusComposer();
                response.current?.append("Text can continue the same conversation.");
                response.current?.complete();
              }}
            >
              Complete text response
            </Button>
          )
        }
        composerContent={
          <VoicePanelPresentation
            assistantName={assistantName}
            connection={connection}
            agent={agent}
            muted={muted}
            expanded={expanded}
            visualizer={visualizer}
            onExpandedChange={setExpanded}
            onMuteToggle={() => setMuted((value) => !value)}
            onStart={() => {
              focusComposer();
              changeConnection("connecting");
              setAgent("idle");
              setMuted(false);
            }}
            onEnd={endVoice}
          />
        }
      />
    </div>
  );
}
