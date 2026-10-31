import { useVoiceDemo } from "./useVoiceDemo.js";
import { useRef, type ReactNode } from "react";
import { Button } from "../../src/index.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import { useChatDemo, type DemoMessage } from "./useChatDemo.js";
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chat = useChatDemo({
    initialMessages,
    onStart: (text, next) => voice.receiveRequest(text, next),
    onRetry: (text, next) => voice.receiveRequest(text, next),
  });
  const voice = useVoiceDemo(chat, composerRef, {
    initialConnection,
    initialAgent,
    initialMuted,
    initialExpanded,
  });
  const {
    connection,
    agent,
    muted,
    expanded,
    setAgent,
    setMuted,
    setExpanded,
    changeConnection,
    focusComposer,
    interimId,
    response,
    responseMode,
    showInterim,
    finalizeTranscript,
    appendVoiceAnswer,
    finishVoiceAnswer,
    sendText,
    endVoice,
    reset,
  } = voice;
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
