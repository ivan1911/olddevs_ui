import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  ChatDemoController,
  DemoResponseControls,
  DemoResponseHandler,
} from "./useChatDemo.js";
import type { VoiceAgentState, VoiceConnectionState } from "./VoicePanelPresentation.js";

/** Private consumer policy over an existing conversation; never creates a second history. */
export function useVoiceDemo(
  chat: ChatDemoController,
  composerRef: RefObject<HTMLTextAreaElement | null>,
  {
    initialConnection = "disconnected",
    initialAgent = initialConnection === "ready" ? "listening" : "idle",
    initialMuted = false,
    initialExpanded = false,
    onInterrupt,
  }: {
    initialConnection?: VoiceConnectionState;
    initialAgent?: VoiceAgentState;
    initialMuted?: boolean;
    initialExpanded?: boolean;
    onInterrupt?: () => void;
  } = {}
) {
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
  const finalVoicePending = useRef(false);
  const changeConnection = (next: VoiceConnectionState) => {
    connectionRef.current = next;
    setConnection(next);
  };
  const receiveRequest: DemoResponseHandler = (_text, next) => {
    textSendPending.current = false;
    if (finalVoicePending.current) {
      finalVoicePending.current = false;
      // The consumer reconciles temporary speech with one accepted canonical message.
      removeInterim();
      chat.updateMessages((items) => {
        const lastUser = items.reduce(
          (last, message, index) => (message.speaker === "user" ? index : last),
          -1
        );
        return items.map((message, index) =>
          index === lastUser ? { ...message, inputMethod: "voice", timestamp: "16:55" } : message
        );
      });
    }
    response.current = next;
    responseMode.current = connectionRef.current === "ready" ? "voice" : "text";
    if (responseMode.current === "voice") setAgent("processing");
  };
  const interrupt = () => {
    onInterrupt?.();
    chat.stop();
  };
  const focusComposer = () => composerRef.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (chat.phase === "idle") {
      textSendPending.current = false;
      finalVoicePending.current = false;
    }
  }, [chat.phase]);
  const removeInterim = () => {
    const id = interimId.current;
    if (id) chat.updateMessages((items) => items.filter((message) => message.id !== id));
    interimId.current = null;
  };
  const showInterim = () => {
    if (connectionRef.current !== "ready" || muted || chat.phase === "accepting") return;
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
    if (connectionRef.current !== "ready" || !interimId.current || chat.phase === "accepting")
      return;
    const unsentDraft = chat.draft;
    focusComposer();
    interrupt();
    // A rejected send keeps the interim transcript, so finalizing can be tried again.
    finalVoicePending.current = true;
    chat.send("I would like to plan a visit tomorrow.");
    // Incoming recognized speech is not submission of the user's independently edited draft.
    chat.setDraft(unsentDraft);
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
    if (connectionRef.current === "ready") interrupt();
    textSendPending.current = true;
    chat.send(text);
  };
  const endVoice = () => {
    focusComposer();
    if (responseMode.current === "voice" || finalVoicePending.current) interrupt();
    removeInterim();
    changeConnection("disconnected");
    setAgent("idle");
  };
  const reset = () => {
    finalVoicePending.current = false;
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
  return {
    connection,
    agent,
    muted,
    expanded,
    setAgent,
    setMuted,
    setExpanded,
    changeConnection,
    receiveRequest,
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
  };
}
