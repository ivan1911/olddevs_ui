"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../actions/Button.js";

export interface ChatTranscriptProps {
  children: ReactNode;
  label: string;
  /** Height and surrounding layout belong to the consumer. */
  className?: string;
  onFollowingChange?: (following: boolean) => void;
}

/** A reading viewport, without a message model, sorting or pagination. */
export const ChatTranscript = forwardRef<HTMLDivElement, ChatTranscriptProps>(
  function ChatTranscript({ children, label, className, onFollowingChange }, ref) {
    const viewport = useRef<HTMLDivElement>(null);
    const labelId = useId();
    const content = useRef<HTMLDivElement>(null);
    const follows = useRef(true);
    const [following, setFollowing] = useState(true);
    const messages = useMessages().chatTranscript;
    useImperativeHandle(ref, () => viewport.current!, []);
    const updateFollowing = useCallback(
      (next: boolean) => {
        if (follows.current === next) return;
        follows.current = next;
        setFollowing(next);
        onFollowingChange?.(next);
      },
      [onFollowingChange]
    );
    const scrollToLatest = useCallback(() => {
      const node = viewport.current;
      if (node) node.scrollTop = node.scrollHeight;
    }, []);
    useLayoutEffect(scrollToLatest, [scrollToLatest]);
    useEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => {
        if (follows.current) scrollToLatest();
      });
      if (content.current) observer.observe(content.current);
      // A compact/expanded voice panel changes the available viewport, not the message content.
      if (viewport.current) observer.observe(viewport.current);
      return () => observer.disconnect();
    }, [scrollToLatest]);
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-col gap-2", className)}>
        <div id={labelId} className="text-fg-0 shrink-0 text-sm font-medium">
          {label}
        </div>
        <div
          ref={viewport}
          role="region"
          aria-labelledby={labelId}
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]"
          onScroll={() => {
            const node = viewport.current!;
            // A small upward movement is still manual reading. Only the actual bottom resumes follow.
            updateFollowing(node.scrollHeight - node.scrollTop - node.clientHeight <= 1);
          }}
          onWheel={(event) => {
            if (event.deltaY < 0) updateFollowing(false);
          }}
          onTouchMove={() => updateFollowing(false)}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              ["ArrowUp", "PageUp", "Home"].includes(event.key)
            )
              updateFollowing(false);
          }}
          onKeyDownCapture={(event) => {
            // React Aria can expand on keydown before a synthesized click reaches capture.
            if (
              ["Enter", " "].includes(event.key) &&
              (event.target as Element).closest("summary,[aria-expanded]")
            )
              updateFollowing(false);
          }}
          onClickCapture={(event) => {
            if ((event.target as Element).closest("summary,[aria-expanded]"))
              updateFollowing(false);
          }}
        >
          <div ref={content} className="flex min-w-0 flex-col gap-3">
            {children}
          </div>
        </div>
        {!following && (
          <div className="flex shrink-0 justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // The return control disappears on activation. Keep keyboard focus in the reading region.
                viewport.current?.focus({ preventScroll: true });
                updateFollowing(true);
                scrollToLatest();
              }}
            >
              {messages.returnToLatest}
            </Button>
          </div>
        )}
      </div>
    );
  }
);
