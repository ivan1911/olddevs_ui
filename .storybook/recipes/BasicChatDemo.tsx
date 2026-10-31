import { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "../../src/index.js";
import { ChatDemoFrame } from "./ChatDemoFrame.js";
import { useChatDemo, type DemoMessage, type DemoResponseHandler } from "./useChatDemo.js";

export type { DemoMessage } from "./useChatDemo.js";
export interface BasicChatDemoProps {
  accept?: (text: string) => void | Promise<void>;
  request?: (text: string) => Promise<string>;
  onStart?: DemoResponseHandler;
  onRetry?: DemoResponseHandler;
  streaming?: boolean;
  initialMessages?: DemoMessage[];
}
/** Resettable consumer events, deliberately outside the package's runtime API. */
export function BasicChatDemo({
  accept,
  request,
  onStart,
  onRetry,
  streaming = false,
  initialMessages,
}: BasicChatDemoProps) {
  const [delayAcceptance, setDelayAcceptance] = useState(false);
  const [failNextSend, setFailNextSend] = useState(false);
  const pendingAcceptance = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(
    null
  );
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      pendingAcceptance.current?.reject(new Error("Example closed"));
    },
    []
  );
  const chat = useChatDemo({
    accept:
      accept ??
      (() => {
        if (failNextSend) {
          setFailNextSend(false);
          throw new Error("Simulated send failure");
        }
        if (delayAcceptance)
          return new Promise<void>((resolve, reject) => {
            pendingAcceptance.current = { resolve, reject };
          });
      }),
    onRetry,
    initialMessages,
    onStart:
      onStart ??
      (request
        ? (text, response) => {
            return request(text).then((answer) => {
              response.append(answer);
              response.complete();
            });
          }
        : undefined),
  });
  const finishAction = (action: () => void) => {
    composerRef.current?.focus({ preventScroll: true });
    action();
  };
  return (
    <ChatDemoFrame
      chat={chat}
      composerRef={composerRef}
      onReset={() => {
        chat.reset();
        pendingAcceptance.current?.reject(new Error("Example reset"));
        pendingAcceptance.current = null;
        setDelayAcceptance(false);
        setFailNextSend(false);
      }}
      controls={
        streaming || chat.phase !== "idle" ? (
          <>
            {streaming && (
              <>
                <Checkbox checked={delayAcceptance} onCheckedChange={setDelayAcceptance}>
                  Delay acceptance
                </Checkbox>
                <Checkbox checked={failNextSend} onCheckedChange={setFailNextSend}>
                  Fail next send
                </Checkbox>
              </>
            )}
            {chat.phase === "accepting" && pendingAcceptance.current && (
              <>
                <Button
                  onClick={() =>
                    finishAction(() => {
                      pendingAcceptance.current?.resolve();
                      pendingAcceptance.current = null;
                    })
                  }
                >
                  Accept send
                </Button>
                <Button
                  onClick={() =>
                    finishAction(() => {
                      pendingAcceptance.current?.reject(new Error("Simulated send failure"));
                      pendingAcceptance.current = null;
                    })
                  }
                >
                  Reject send
                </Button>
              </>
            )}
            {chat.phase === "responding" && (
              <>
                {streaming && (
                  <Button onClick={() => chat.append("A clear plan begins with one small step. ")}>
                    Append response chunk
                  </Button>
                )}
                {((!request && !onStart) || streaming) && (
                  <Button
                    onClick={() =>
                      finishAction(() => {
                        if (!streaming)
                          chat.append(
                            "Choose one clear goal, collect the relevant context, and plan the next small step."
                          );
                        chat.complete();
                      })
                    }
                  >
                    Complete response
                  </Button>
                )}
                {streaming && (
                  <Button onClick={() => finishAction(chat.stop)}>Stop response</Button>
                )}
                {streaming && (
                  <Button tone="danger" onClick={() => finishAction(() => chat.fail())}>
                    Fail response
                  </Button>
                )}
              </>
            )}
          </>
        ) : undefined
      }
    />
  );
}
