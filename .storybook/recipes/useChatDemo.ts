import { useEffect, useRef, useState } from "react";
import type { ChatMessageProps } from "../../src/index.js";

/** Consumer fixture data. None of these types is a package runtime export. */
export interface DemoMessage {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  timestamp: string;
  /** Actual epoch milliseconds; never inferred from the display caption. */
  createdAt?: number;
  /** Stable consumer identity; an unknown identity never creates a group. */
  authorId?: string;
  inputMethod?: "text" | "voice";
  state?: ChatMessageProps["state"];
}
export interface DemoResponseControls {
  /** Stable key for consumer-owned tool/source data associated with this response attempt. */
  readonly responseId: string;
  append: (delta: string) => void;
  complete: () => void;
  fail: (message?: string) => void;
}
export type DemoResponseHandler = (
  text: string,
  response: DemoResponseControls
) => void | Promise<void>;
interface Options {
  accept?: (text: string) => void | Promise<void>;
  onStart?: DemoResponseHandler;
  onRetry?: DemoResponseHandler;
  initialMessages?: DemoMessage[];
}
interface Snapshot {
  draft: string;
  messages: DemoMessage[];
  phase: "idle" | "accepting" | "responding";
  error: string | null;
  canRetry: boolean;
  announcement: string;
  responseId: string | null;
}

/** Local recipe lifecycle with generation-bound fixture events; not an AI runtime. */
export function useChatDemo(options: Options = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    draft: "",
    messages: options.initialMessages ?? [],
    phase: "idle",
    announcement: "",
    responseId: null,
    error: null,
    canRetry: false,
  }));
  const current = useRef(snapshot);
  const generation = useRef(0);
  const sequence = useRef(0);
  const draftRevision = useRef(0);
  const lastRequest = useRef<string | null>(null);
  const mounted = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const publish = (next: Snapshot) => {
    current.current = next;
    setSnapshot(next);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  const setDraft = (draft: string) => {
    draftRevision.current += 1;
    publish({ ...current.current, draft });
  };
  const updateMessages = (update: (messages: DemoMessage[]) => DemoMessage[]) =>
    publish({ ...current.current, messages: update(current.current.messages) });
  const controls = (run: number, id: string): DemoResponseControls => {
    const valid = () =>
      mounted.current && run === generation.current && current.current.phase === "responding";
    return {
      responseId: id,
      append(delta) {
        if (!valid() || !delta) return;
        const state = current.current;
        const found = state.messages.some((message) => message.id === id);
        publish({
          ...state,
          messages: found
            ? state.messages.map((message) =>
                message.id === id ? { ...message, text: message.text + delta } : message
              )
            : [
                ...state.messages,
                {
                  id,
                  speaker: "assistant",
                  authorId: "demo-assistant",
                  text: delta,
                  timestamp: "16:50",
                  inputMethod: "text",
                  state: "streaming",
                },
              ],
        });
      },
      complete() {
        if (!valid()) return;
        const state = current.current;
        publish({
          ...state,
          phase: "idle",
          announcement: "Assistant response complete.",
          messages: state.messages
            .filter((message) => message.id !== id || !!message.text.trim())
            .map((message) => (message.id === id ? { ...message, state: "complete" } : message)),
        });
      },
      fail(message = "Response failed. Received text is preserved.") {
        if (!valid()) return;
        const state = current.current;
        publish({
          ...state,
          phase: "idle",
          canRetry: true,
          error: message,
          announcement: message,
          messages: state.messages
            .filter((message) => message.id !== id || !!message.text.trim())
            .map((message) => (message.id === id ? { ...message, state: "interrupted" } : message)),
        });
      },
    };
  };
  const invoke = (
    handler: DemoResponseHandler | undefined,
    text: string,
    response: DemoResponseControls
  ) => {
    try {
      const result = handler?.(text, response);
      if (result) void result.catch(() => response.fail());
    } catch {
      response.fail();
    }
  };
  const send = (text: string) => {
    if (current.current.phase !== "idle" || !text.trim()) return;
    const run = ++generation.current;
    const submittedRevision = draftRevision.current;
    publish({
      ...current.current,
      phase: "accepting",
      responseId: null,
      canRetry: false,
      error: null,
      announcement: "Sending message.",
    });
    const accepted = () => {
      if (!mounted.current || run !== generation.current || current.current.phase !== "accepting")
        return;
      const user: DemoMessage = {
        id: `message-${++sequence.current}`,
        speaker: "user",
        authorId: "demo-user",
        text,
        timestamp: "16:54",
        inputMethod: "text",
      };
      const responseId = `message-${++sequence.current}`;
      lastRequest.current = text;
      publish({
        ...current.current,
        draft: draftRevision.current === submittedRevision ? "" : current.current.draft,
        messages: [...current.current.messages, user],
        responseId,
        phase: "responding",
        announcement: "Assistant response started.",
      });
      invoke(optionsRef.current.onStart, text, controls(run, responseId));
    };
    const rejected = () => {
      if (!mounted.current || run !== generation.current || current.current.phase !== "accepting")
        return;
      publish({
        ...current.current,
        phase: "idle",
        error: "Send failed. Your draft is preserved.",
        announcement: "Send failed. Your draft is preserved.",
      });
    };
    try {
      const result = optionsRef.current.accept?.(text);
      if (result) void result.then(accepted, rejected);
      else accepted();
    } catch {
      rejected();
    }
  };
  const stop = () => {
    if (current.current.phase === "idle") return;
    generation.current += 1;
    const state = current.current;
    publish({
      ...state,
      phase: "idle",
      canRetry: state.phase === "responding",
      announcement: state.phase === "responding" ? "Response interrupted." : "Send canceled.",
      messages: state.messages
        .filter((message) => message.id !== state.responseId || !!message.text.trim())
        .map((message) =>
          message.id === state.responseId ? { ...message, state: "interrupted" } : message
        ),
    });
  };
  const reset = () => {
    generation.current += 1;
    lastRequest.current = null;
    publish({
      draft: "",
      messages: optionsRef.current.initialMessages ?? [],
      phase: "idle",
      announcement: "",
      responseId: null,
      error: null,
      canRetry: false,
    });
  };
  const retry = () => {
    const state = current.current;
    const text = lastRequest.current;
    if (state.phase !== "idle" || !state.canRetry || text === null) return;
    const run = ++generation.current;
    const responseId = `message-${++sequence.current}`;
    publish({
      ...state,
      responseId,
      phase: "responding",
      canRetry: false,
      error: null,
      announcement: "Retry response started.",
    });
    // Deliberately separate from onStart: retry does not replay a recipe's completed tools.
    invoke(optionsRef.current.onRetry, text, controls(run, responseId));
  };
  const activeControls = controls(generation.current, snapshot.responseId ?? "");
  return {
    ...snapshot,
    setDraft,
    updateMessages,
    send,
    stop,
    reset,
    retry,
    append: activeControls.append,
    complete: activeControls.complete,
    fail: activeControls.fail,
  };
}

export type ChatDemoController = ReturnType<typeof useChatDemo>;
