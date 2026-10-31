import type { ReactNode } from "react";
import { Button } from "../../src/index.js";

export type VoiceConnectionState = "disconnected" | "connecting" | "ready" | "error";
export type VoiceAgentState = "idle" | "listening" | "processing" | "speaking";

/** Private recipe presentation: all session state and effects come from the consumer. */
export interface VoicePanelPresentationProps {
  assistantName: string;
  connection: VoiceConnectionState;
  agent: VoiceAgentState;
  muted: boolean;
  expanded: boolean;
  visualizer?: ReactNode;
  error?: string;
  onExpandedChange: (expanded: boolean) => void;
  onMuteToggle: () => void;
  onStart: () => void;
  onEnd: () => void;
}
const CONNECTION_LABELS = {
  disconnected: "Off",
  connecting: "Preparing",
  ready: "Ready",
  error: "Error",
} as const;
const AGENT_LABELS = {
  idle: "Idle",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
} as const;

export function VoicePanelPresentation({
  assistantName,
  connection,
  agent,
  muted,
  expanded,
  visualizer,
  error,
  onExpandedChange,
  onMuteToggle,
  onStart,
  onEnd,
}: VoicePanelPresentationProps) {
  const connectionText = CONNECTION_LABELS[connection];
  const agentText = AGENT_LABELS[agent];
  const microphoneText = muted ? "Muted" : "Unmuted";
  return (
    <section
      aria-label="Voice session"
      className="border-line bg-bg-1 flex min-w-0 flex-col gap-2 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fg-0 text-sm font-semibold">{assistantName}</p>
        <div className="flex flex-wrap gap-1">
          {connection === "disconnected" ? (
            <Button size="sm" onClick={onStart}>
              Start voice
            </Button>
          ) : (
            <>
              {connection === "error" && (
                <Button size="sm" onClick={onStart}>
                  Retry voice connection
                </Button>
              )}
              <Button size="sm" aria-pressed={muted} onClick={onMuteToggle}>
                {muted ? "Unmute microphone" : "Mute microphone"}
              </Button>
              <Button size="sm" variant="outline" onClick={onEnd}>
                End voice
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? "Collapse voice panel" : "Expand voice panel"}
          </Button>
        </div>
      </div>
      <div className="text-fg-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>Connection: {connectionText}</span>
        <span>Agent: {agentText}</span>
        <span>Microphone: {microphoneText}</span>
      </div>
      {connection === "error" && (
        <p className="text-danger-strong text-sm">
          {error ?? "Voice connection failed. The conversation is preserved."}
        </p>
      )}
      {expanded && (
        <div className="flex min-w-0 flex-col gap-2">
          {visualizer}
          <p className="text-fg-2 text-xs">
            Simulation only. No microphone capture or audio playback.
          </p>
        </div>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        Voice {connectionText}. Agent {agentText}. Microphone {microphoneText}.
      </div>
    </section>
  );
}
