import { useVoiceDemo } from "./useVoiceDemo.js";
import { VoicePanelPresentation } from "./VoicePanelPresentation.js";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Accordion, AccordionItem, Button, Checkbox, Select } from "../../src/index.js";
import { MarkdownView } from "../../src/markdown.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import {
  ToolsSourcesPresentation,
  type DemoOperation,
  type DemoSource,
} from "./ToolsSourcesPresentation.js";
import {
  MARKDOWN_FRAGMENTS,
  SHRINK_LINK_FRAGMENT,
  OPERATIONS,
  SOURCES,
  RUSSIAN_TEXT,
  scenarioMessages,
  type IntegratedScenario,
} from "./integratedFixtures.js";
import { useChatDemo, type DemoMessage, type DemoResponseControls } from "./useChatDemo.js";

// Unchanged replies are not reparsed when the next draft or session controls change.
const AssistantMarkdown = memo(MarkdownView);

type RecordData = { operations: DemoOperation[]; sources: DemoSource[] };
export interface IntegratedChatDemoProps {
  initialScenario?: IntegratedScenario;
  initialMessages?: DemoMessage[];
  assistantName?: string;
  visualizer?: ReactNode;
}
/** One modeled conversation. The fixtures perform no network, tool or device work. */
export function IntegratedChatDemo({
  initialScenario = "empty",
  initialMessages,
  assistantName = "Guide",
  visualizer,
}: IntegratedChatDemoProps) {
  const [scenario, setScenario] = useState(initialScenario);
  const [revision, setRevision] = useState(0);
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3">
      <Select
        aria-label="Scenario"
        placeholder="Scenario"
        value={scenario}
        clearable={false}
        highlightSelected={false}
        triggerClassName="[--select-label-max:none]"
        items={[
          { id: "empty", label: "Empty conversation" },
          { id: "reading", label: "Reading history" },
          { id: "narrow", label: "Long Russian content" },
          { id: "groups", label: "Bubble time boundaries" },
        ]}
        onChange={(value) => {
          if (value) setScenario(value as IntegratedScenario);
        }}
      />
      <IntegratedConversation
        key={`${scenario}-${revision}`}
        initialMessages={initialMessages ?? scenarioMessages(scenario)}
        onReset={() => setRevision((value) => value + 1)}
        focusAfterReset={revision > 0}
        assistantName={assistantName}
        visualizer={visualizer}
      />
    </div>
  );
}
function IntegratedConversation({
  initialMessages,
  onReset,
  focusAfterReset,
  assistantName,
  visualizer,
}: {
  initialMessages: DemoMessage[];
  onReset: () => void;
  focusAfterReset: boolean;
  assistantName: string;
  visualizer?: ReactNode;
}) {
  const [records, setRecords] = useState<Record<string, RecordData>>({});
  const [runs, setRuns] = useState(0);
  const [withSources, setWithSources] = useState(true);
  const [hold, setHold] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const response = useRef<DemoResponseControls | null>(null);
  const active = useRef<string | null>(null);
  const fragment = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      active.current = null;
      pending.current?.reject(new Error("Example closed"));
    },
    []
  );
  const stamp = () =>
    chat.updateMessages((items) =>
      items.map((message, index) =>
        message.createdAt === undefined
          ? {
              ...message,
              createdAt: Date.parse("2026-10-31T13:00:00Z") + index * 60000,
              authorId: message.speaker === "user" ? "demo-user" : "demo-assistant",
            }
          : message
      )
    );
  const begin = (next: DemoResponseControls, retry = false): void => {
    stamp();
    voice.receiveRequest("", next);
    active.current = next.responseId;
    response.current = next;
    fragment.current = 0;
    if (retry) {
      next.append("An **answer-only retry** preserves completed operations.");
      stamp();
      next.complete();
      if (voice.connection === "ready") voice.setAgent("listening");
      active.current = null;
    } else
      setRecords((previous) => ({
        ...previous,
        [next.responseId]: { operations: OPERATIONS.map((item) => ({ ...item })), sources: [] },
      }));
  };
  const chat = useChatDemo({
    initialMessages,
    accept: () => {
      if (hold)
        return new Promise<void>((resolve, reject) => {
          pending.current = { resolve, reject };
        });
    },
    onStart: (_text, next) => begin(next),
    onRetry: (_text, next) => begin(next, true),
  });
  const voice = useVoiceDemo(chat, composerRef, {
    onInterrupt: () => {
      active.current = null;
    },
  });
  const focus = () => composerRef.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (focusAfterReset) composerRef.current?.focus({ preventScroll: true });
  }, [focusAfterReset]);
  const terminate = (action: () => void) => {
    active.current = null;
    focus();
    action();
    if (voice.connection === "ready") voice.setAgent("listening");
  };
  const append = () => {
    response.current?.append(MARKDOWN_FRAGMENTS[fragment.current++ % MARKDOWN_FRAGMENTS.length]!);
    const id = response.current?.responseId;
    if (voice.connection === "ready") {
      voice.setAgent("speaking");
      chat.updateMessages((items) =>
        items.map((message) => (message.id === id ? { ...message, inputMethod: "voice" } : message))
      );
    }
    stamp();
  };
  const current = chat.responseId ? records[chat.responseId] : undefined;
  const update = (updater: (record: RecordData) => RecordData) => {
    const id = active.current;
    if (id)
      setRecords((previous) => ({
        ...previous,
        [id]: updater(previous[id] ?? { operations: [], sources: [] }),
      }));
  };
  return (
    <>
      <Accordion>
        <AccordionItem id="events" title="Simulation events">
          <section
            aria-label="Simulation controls"
            className="border-line bg-bg-1 flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-3"
          >
            <p className="text-fg-2 basis-full text-xs">
              Explicit simulated events. No AI backend, tool execution, microphone or audio.
            </p>
            <Button
              size="sm"
              onClick={() => {
                focus();
                chat.setDraft(RUSSIAN_TEXT.repeat(3));
              }}
            >
              Load long draft
            </Button>
            <Checkbox checked={hold} onCheckedChange={setHold}>
              Hold acceptance
            </Checkbox>
            <Checkbox
              checked={withSources}
              onCheckedChange={(value) => {
                setWithSources(value);
                update((record) => ({ ...record, sources: value ? SOURCES : [] }));
              }}
            >
              Include sources
            </Checkbox>
            <span className="text-fg-2 text-xs">Operation runs: {runs}</span>
            <Button
              size="sm"
              disabled={chat.phase !== "accepting"}
              onClick={() => {
                focus();
                pending.current?.resolve();
                pending.current = null;
              }}
            >
              Accept send
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "accepting"}
              onClick={() => {
                focus();
                pending.current?.reject(new Error("Simulated failure"));
                pending.current = null;
              }}
            >
              Reject send
            </Button>
            <Button size="sm" disabled={chat.phase !== "responding"} onClick={append}>
              Append Markdown fragment
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => {
                response.current?.append(SHRINK_LINK_FRAGMENT);
                stamp();
              }}
            >
              Append unfinished link
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => response.current?.append(")")}
            >
              Close link
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => response.current?.append("   ")}
            >
              Append whitespace
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => terminate(() => response.current?.complete())}
            >
              Complete response
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => terminate(chat.stop)}
            >
              Stop response
            </Button>
            <Button
              size="sm"
              disabled={chat.phase !== "responding"}
              onClick={() => terminate(() => response.current?.fail())}
            >
              Fail response
            </Button>
            <Button
              size="sm"
              disabled={
                !current?.operations.some((item) => item.state === "waiting") ||
                chat.phase !== "responding"
              }
              onClick={() => {
                setRuns((value) => value + 1);
                update((record) => ({
                  ...record,
                  operations: record.operations.map((item) => ({ ...item, state: "running" })),
                }));
              }}
            >
              Start operations
            </Button>
            <Button
              size="sm"
              disabled={
                !current?.operations.some((item) => item.state === "running") ||
                chat.phase !== "responding"
              }
              onClick={() =>
                update((record) => ({
                  operations: record.operations.map((item, index) => ({
                    ...item,
                    state: index ? "error" : "success",
                    details: index
                      ? "The service did not respond. The received answer is preserved."
                      : "Found a planning guide.",
                  })),
                  sources: withSources ? SOURCES : [],
                }))
              }
            >
              Resolve operations
            </Button>
          </section>
          <section
            aria-label="Voice simulation controls"
            className="border-line bg-bg-1 flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-3"
          >
            <Button
              size="sm"
              disabled={voice.connection !== "connecting"}
              onClick={() => {
                focus();
                voice.changeConnection("ready");
                voice.setAgent("listening");
              }}
            >
              Connection ready
            </Button>
            <Button
              size="sm"
              disabled={voice.connection === "disconnected" || voice.connection === "error"}
              onClick={() => {
                if (voice.responseMode.current === "voice") terminate(chat.stop);
                else focus();
                voice.changeConnection("error");
                voice.setAgent("idle");
              }}
            >
              Connection failed
            </Button>
            <Button
              size="sm"
              disabled={voice.connection !== "ready" || voice.muted || chat.phase === "accepting"}
              onClick={voice.showInterim}
            >
              Show interim transcript
            </Button>
            <Button
              size="sm"
              disabled={
                voice.connection !== "ready" ||
                !voice.interimId.current ||
                chat.phase === "accepting"
              }
              onClick={voice.finalizeTranscript}
            >
              Finalize transcript
            </Button>
            <Button
              size="sm"
              disabled={
                voice.connection !== "ready" ||
                !chat.messages.some((message) => message.speaker === "assistant")
              }
              onClick={() => voice.setAgent("speaking")}
            >
              Simulate audio playback
            </Button>
            <Button
              size="sm"
              disabled={voice.connection !== "ready" || voice.agent !== "speaking"}
              onClick={() => voice.setAgent("listening")}
            >
              Playback finished
            </Button>
          </section>
        </AccordionItem>
      </Accordion>
      <ChatDemoFrame
        className="h-[680px] max-h-[calc(100dvh-144px)] min-h-[600px]"
        maxDraftRows={3}
        chat={chat}
        onSubmit={voice.sendText}
        canSubmit={
          chat.phase !== "accepting" && (chat.phase === "idle" || voice.connection === "ready")
        }
        composerContent={
          <VoicePanelPresentation
            assistantName={assistantName}
            visualizer={visualizer}
            connection={voice.connection}
            agent={voice.agent}
            muted={voice.muted}
            expanded={voice.expanded}
            onExpandedChange={voice.setExpanded}
            onMuteToggle={() => voice.setMuted((value) => !value)}
            onStart={() => {
              focus();
              voice.changeConnection("connecting");
              voice.setAgent("idle");
              voice.setMuted(false);
            }}
            onEnd={voice.endVoice}
          />
        }

        composerRef={composerRef}
        onReset={onReset}
        label="Integrated conversation example"
        title="Planning conversation"
        description="One history for modeled text, voice, operations and references."
        messageBody={(message) =>
          message.speaker === "assistant" ? (
            <AssistantMarkdown content={message.text} streaming={message.state === "streaming"} />
          ) : (
            <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{message.text}</p>
          )
        }
        messageExtras={(message) =>
          records[message.id] ? <ToolsSourcesPresentation {...records[message.id]!} /> : null
        }
      />
    </>
  );
}
