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

// A popup trigger opens an overlay. Only an inline disclosure changes the transcript's height.
const DISCLOSURE = "summary,[aria-expanded]:not([aria-haspopup])";

/** A reading viewport, without a message model, sorting or pagination. */
export const ChatTranscript = forwardRef<HTMLDivElement, ChatTranscriptProps>(
  function ChatTranscript({ children, label, className, onFollowingChange }, ref) {
    const viewport = useRef<HTMLDivElement>(null);
    const labelId = useId();
    const content = useRef<HTMLDivElement>(null);
    const follows = useRef(true);
    const lastScroll = useRef({ top: 0, contentHeight: 0 });
    const touchY = useRef(0);
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
    const movedUp = useCallback((node: HTMLDivElement) => {
      // The browser clamps the old position when content shrinks or the viewport grows.
      const expectedTop = Math.min(
        lastScroll.current.top,
        Math.max(
          0,
          Math.min(lastScroll.current.contentHeight, node.scrollHeight) - node.clientHeight
        )
      );
      return node.scrollTop < expectedTop;
    }, []);
    // Without room to move, no scroll event follows the intent and nothing would resume following.
    const pauseIfCanMoveUp = useCallback(() => {
      if (viewport.current!.scrollTop > 0) updateFollowing(false);
    }, [updateFollowing]);
    const scrollToLatest = useCallback(() => {
      const node = viewport.current;
      if (node) {
        node.scrollTop = node.scrollHeight;
        lastScroll.current = { top: node.scrollTop, contentHeight: node.scrollHeight };
      }
    }, []);
    useLayoutEffect(scrollToLatest, [scrollToLatest]);
    useEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => {
        if (!follows.current) return;
        const node = viewport.current;
        // A manual scroll may precede its queued scroll event; do not overwrite it on resize.
        if (node && movedUp(node)) updateFollowing(false);
        else scrollToLatest();
      });
      if (content.current) observer.observe(content.current);
      // A compact/expanded voice panel changes the available viewport, not the message content.
      if (viewport.current) observer.observe(viewport.current);
      return () => observer.disconnect();
    }, [scrollToLatest, movedUp, updateFollowing]);
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
            const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= 1;
            // A queued programmatic event can arrive after layout changed. Only movement beyond
            // the expected native clamp is manual reading; the new bottom gap alone is not intent.
            if (atBottom) updateFollowing(true);
            else if (movedUp(node)) updateFollowing(false);
            lastScroll.current = { top: node.scrollTop, contentHeight: node.scrollHeight };
          }}
          onWheel={(event) => {
            if (event.deltaY < 0) pauseIfCanMoveUp();
          }}
          onTouchStart={(event) => {
            touchY.current = event.touches[0]!.clientY;
          }}
          onTouchMove={(event) => {
            const y = event.touches[0]!.clientY;
            if (y > touchY.current) pauseIfCanMoveUp();
            touchY.current = y;
          }}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              ["ArrowUp", "PageUp", "Home"].includes(event.key)
            )
              pauseIfCanMoveUp();
          }}
          onKeyDownCapture={(event) => {
            // React Aria can expand on keydown before a synthesized click reaches capture.
            if (["Enter", " "].includes(event.key) && (event.target as Element).closest(DISCLOSURE))
              updateFollowing(false);
          }}
          onClickCapture={(event) => {
            if ((event.target as Element).closest(DISCLOSURE)) updateFollowing(false);
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
