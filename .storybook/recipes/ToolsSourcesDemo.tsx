import { useEffect, useRef, useState } from "react";
import { Button } from "../../src/index.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import { useChatDemo, type DemoResponseControls } from "./useChatDemo.js";

import {
  ToolsSourcesPresentation,
  type DemoOperation,
  type DemoSource,
} from "./ToolsSourcesPresentation.js";
export type { DemoOperation, DemoSource } from "./ToolsSourcesPresentation.js";
export interface ToolsResponse extends DemoResponseControls {
  operations: (operations: DemoOperation[]) => void;
  sources: (sources: DemoSource[]) => void;
}
type Handler = (text: string, response: ToolsResponse) => void | Promise<void>;
export interface ToolsSourcesDemoProps {
  onStart?: Handler;
  onRetry?: Handler;
  withSources?: boolean;
}
const operations: DemoOperation[] = [
  {
    id: "guidance",
    summary: "Search guidance",
    state: "waiting",
    details: "Look for a short guide to weekly planning.",
  },
  {
    id: "availability",
    summary: "Check availability",
    state: "waiting",
    details: "Check whether the reference service is available.",
  },
];
const sources: DemoSource[] = [
  {
    id: "planning-guide",
    title: "Planning guide",
    href: "https://example.com/planning",
    snippet: "Review your goals and select one achievable next step.",
  },
];

/** A modeled request → operations → answer flow. No requests or tools execute here. */
export function ToolsSourcesDemo({ onStart, onRetry, withSources = true }: ToolsSourcesDemoProps) {
  const [records, setRecords] = useState<
    Record<string, { operations: DemoOperation[]; sources: DemoSource[] }>
  >({});
  const active = useRef<string | null>(null);
  const responseRef = useRef<ToolsResponse | null>(null);
  useEffect(
    () => () => {
      active.current = null;
    },
    []
  );
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bind = (response: DemoResponseControls): ToolsResponse => {
    active.current = response.responseId;
    const update = (key: "operations" | "sources", value: DemoOperation[] | DemoSource[]) => {
      if (active.current !== response.responseId) return;
      setRecords((previous) => ({
        ...previous,
        [response.responseId]: {
          operations: [],
          sources: [],
          ...previous[response.responseId],
          [key]: value,
        },
      }));
    };
    const controls: ToolsResponse = {
      ...response,
      complete: () => {
        if (active.current !== response.responseId) return;
        active.current = null;
        response.complete();
      },
      fail: (message) => {
        if (active.current !== response.responseId) return;
        active.current = null;
        response.fail(message);
      },
      operations: (value) => update("operations", value),
      sources: (value) => update("sources", value),
    };
    responseRef.current = controls;
    return controls;
  };
  const chat = useChatDemo({
    onStart: (text, response) => {
      const controls = bind(response);
      if (onStart) return onStart(text, controls);
      response.append("I will look for planning guidance.");
      controls.operations(operations);
    },
    onRetry: (text, response) => {
      const controls = bind(response);
      if (onRetry) return onRetry(text, controls);
      // Answer-only retry: completed operations are never executed again.
      response.append("A weekly review can help you choose the next step.");
      if (withSources) controls.sources(sources);
      controls.complete();
    },
  });
  useEffect(() => {
    if (chat.phase === "idle") active.current = null;
  }, [chat.phase]);
  const current = chat.responseId ? records[chat.responseId] : undefined;
  return (
    <ChatDemoFrame
      chat={chat}
      composerRef={composerRef}
      label="Tools and sources example"
      title="Research assistant"
      description="Modeled operations and supplied references. No tool execution or source verification."
      onReset={() => {
        active.current = null;
        responseRef.current = null;
        setRecords({});
        chat.reset();
      }}
      messageExtras={(message) => {
        const record = records[message.id];
        if (!record) return null;
        return <ToolsSourcesPresentation {...record} />;
      }}
      controls={
        chat.phase === "responding" ? (
          <>
            {current?.operations.some((operation) => operation.state === "waiting") && (
              <Button
                onClick={() =>
                  setRecords((previous) => ({
                    ...previous,
                    [chat.responseId!]: {
                      ...previous[chat.responseId!]!,
                      operations: previous[chat.responseId!]!.operations.map((operation) => ({
                        ...operation,
                        state: "running",
                      })),
                    },
                  }))
                }
              >
                Start operations
              </Button>
            )}
            {current?.operations.some((operation) => operation.state === "running") && (
              <Button
                onClick={() => {
                  const response = responseRef.current!;
                  setRecords((previous) => ({
                    ...previous,
                    [response.responseId]: {
                      operations: [
                        {
                          ...operations[0]!,
                          state: "success",
                          details: "Found one planning guide. Its excerpt is supplied below.",
                        },
                        {
                          ...operations[1]!,
                          state: "error",
                          details:
                            "The availability service did not respond. The received answer is still available.",
                        },
                      ],
                      sources: withSources ? sources : [],
                    },
                  }));
                  response.append("\nA weekly review can help you choose the next step.");
                }}
              >
                Resolve operations
              </Button>
            )}
            <Button
              onClick={() =>
                chat.append(" Review your goals and select one achievable next step. ")
              }
            >
              Append answer chunk
            </Button>
            <Button
              onClick={() => {
                composerRef.current?.focus({ preventScroll: true });
                responseRef.current?.complete();
              }}
            >
              Complete response
            </Button>
            <Button
              onClick={() => {
                active.current = null;
                composerRef.current?.focus({ preventScroll: true });
                chat.stop();
              }}
            >
              Stop response
            </Button>
            <Button
              tone="danger"
              onClick={() => {
                active.current = null;
                composerRef.current?.focus({ preventScroll: true });
                chat.fail();
              }}
            >
              Fail response
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
