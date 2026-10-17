"use client";

import { posToDOMRect, type Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/overlays/Popover.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { devError } from "../../lib/dev-warn.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import { ariaShortcut, isApple } from "../core/shortcuts.js";
import type { TextCardRecord as TextCardEntry } from "../core/toolDescriptor.js";

/*
  The text card (ADR-0058, items 7.6–7.11): the fourth kind of UI contribution of a custom
  Tool, for example a comment card under a Mark. The Tool describes it with `rangeAt`
  (the range) and `render` (the body). The kit handles everything else.

  WHICH CARD IS OPEN IS DECIDED BY ONE FUNCTION, `evaluate`. It runs on every transaction,
  focus, blur and click in the Document, not on hover. The caret is a collapsed selection.
  An expanded selection closes the card (the bubble menu works there). At most one card is
  open: the narrowest range under the caret. If the widths are equal, the entry that comes
  earlier in the list wins, that is, the Tool that comes earlier in `tools`.

  ABOVE THE DOCUMENT, BUT NOT MODAL. The frame is the kit's `Popover`: a layer in the
  Escape stack (ADR-0041), which flips at the edge. Focus stays in the Document on open, so
  typing is not interrupted. `Alt+F10` moves focus into the card, and Escape returns the
  caret and hides the card. A hidden card is in the `dismissed` state. The state is lifted
  when the caret leaves the range of this entry, or by a click on the range.

  READ-ONLY. Such a field has no caret (the Document does not take focus into the text), so
  a click opens the card. The click position is remembered and follows the edits. Focus is
  not required. A click outside the field, Escape or a mouse selection closes the card.
*/

/** The open card: the entry's index and its range in the current state. */
interface Shown {
  index: number;
  from: number;
  to: number;
}

/** What `RichTextEditor` asks of the card from outside: `Alt+F10` leads into it. */
export interface TextCardControl {
  /** Move focus into the open card. `false` means there is no card or it is dismissed. */
  focus: () => boolean;
}

/**
 * Entries that have a range at `pos`. A response that cannot be trusted (outside the
 * Document, `from > to`, not numbers) is dropped. An exception thrown in `rangeAt` is
 * dropped too: a foreign function must not break the field.
 */
function rangesAt(editor: Editor, entries: readonly TextCardEntry[], pos: number): Shown[] {
  const { state } = editor;
  const size = state.doc.content.size;
  const found: Shown[] = [];
  entries.forEach((entry, index) => {
    try {
      const range = entry.rangeAt(state, pos);
      if (
        range &&
        Number.isInteger(range.from) &&
        Number.isInteger(range.to) &&
        range.from >= 0 &&
        range.from <= range.to &&
        range.to <= size
      ) {
        found.push({ index, from: range.from, to: range.to });
      }
    } catch (error) {
      devError(`RichTextEditor: text card "${entry.id}" threw in rangeAt`, error);
    }
  });
  return found;
}

/** The narrowest range. With equal widths, the earlier entry wins (`found` is in order). */
const narrowest = (found: readonly Shown[]): Shown | null =>
  found.reduce<Shown | null>(
    (best, item) => (best && best.to - best.from <= item.to - item.from ? best : item),
    null
  );

export interface TextCardProps {
  editor: Editor;
  entries: readonly TextCardEntry[];
  /** The field is disabled or in Source mode: there are no cards. */
  enabled: boolean;
  readOnly: boolean;
  /** The field root: a click inside it does not by itself close the card. */
  rootRef: RefObject<HTMLElement | null>;
  controlRef: MutableRefObject<TextCardControl | null>;
}

export function TextCard({
  editor,
  entries,
  enabled,
  readOnly,
  rootRef,
  controlRef,
}: TextCardProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const [shown, setShown] = useState<Shown | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** The entry whose card was dismissed. `null` means no card was dismissed. */
  const dismissed = useRef<number | null>(null);
  /** `readOnly`: the position of the last click. It follows the edits. */
  const pinned = useRef<number | null>(null);
  const latest = useRef({ entries, enabled, readOnly });
  latest.current = { entries, enabled, readOnly };

  const evaluateRef = useRef<(settled?: boolean) => void>(() => {});
  /** Recalculate one tick later: by then focus has already moved to its new place. */
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const later = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => evaluateRef.current(true), 0);
  };
  evaluateRef.current = (settled = false) => {
    const { entries: list, enabled: on, readOnly: reading } = latest.current;
    let next: Shown | null = null;
    if (on && !editor.isDestroyed) {
      const { selection } = editor.state;
      const pos = reading ? pinned.current : selection.empty ? selection.head : null;
      const card = cardRef.current;
      // The caret lives where focus is: in the Document or in the card itself.
      const focused =
        reading ||
        editor.view.hasFocus() ||
        (card != null && card.contains(card.ownerDocument.activeElement));
      // Focus has left in the middle of a transition: the active element has not blurred
      // yet. The recalculation one tick later decides. Until then the card stays as it was.
      if (!focused && !settled && shownRef.current !== null) return later();
      if (pos !== null && focused) {
        let found = rangesAt(editor, list, pos);
        if (dismissed.current !== null) {
          // Dismissed while the caret is inside this entry's range: neither it nor
          // its neighbours pop up.
          if (found.some((item) => item.index === dismissed.current)) found = [];
          else dismissed.current = null;
        }
        next = narrowest(found);
      }
    }
    const previous = shownRef.current;
    if (
      previous?.index === next?.index &&
      previous?.from === next?.from &&
      previous?.to === next?.to
    ) {
      return;
    }
    shownRef.current = next;
    setShown(next);
  };

  /** Hide until the caret leaves. Focus from the card goes to the Document; the caret stays put. */
  const dismiss = () => {
    const card = cardRef.current;
    if (card?.contains(card.ownerDocument.activeElement)) editor.view.focus();
    dismissed.current = shownRef.current?.index ?? null;
    shownRef.current = null;
    setShown(null);
  };

  useEffect(() => {
    const evaluate = () => evaluateRef.current();
    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean; mapping: { map: (pos: number) => number } };
    }) => {
      if (pinned.current !== null && transaction.docChanged) {
        pinned.current = transaction.mapping.map(pinned.current);
      }
      evaluate();
    };
    const onClick = (event: MouseEvent) => {
      const { enabled: on, readOnly: reading, entries: list } = latest.current;
      if (!on || editor.isDestroyed) return;
      const { view } = editor;
      // The click position comes from the coordinates. Without a layout (jsdom), it is the
      // start of the node under the click.
      let pos: number | undefined;
      try {
        pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
      } catch {
        // The coordinates cannot be measured; the fallback below takes over.
      }
      try {
        if (pos === undefined && event.target instanceof Node) pos = view.posAtDOM(event.target, 0);
      } catch {
        // The node is outside the Document: the click did not name a position.
      }
      if (pos === undefined) return;
      if (reading) {
        // A mouse selection (a double click on a word) is not an open action.
        const selection = view.dom.ownerDocument.getSelection();
        if (selection && !selection.isCollapsed) {
          pinned.current = null;
          return evaluate();
        }
        pinned.current = pos;
      }
      // A click on the range of a dismissed card opens it again.
      if (dismissed.current !== null) {
        const entry = list[dismissed.current];
        if (entry && rangesAt(editor, [entry], pos).length > 0) dismissed.current = null;
      }
      evaluate();
    };
    editor.on("transaction", onTransaction);
    editor.on("focus", evaluate);
    editor.on("blur", later);
    editor.view.dom.addEventListener("click", onClick);
    // A different entry, mode or field gets its own recalculation.
    evaluate();
    return () => {
      clearTimeout(timer.current);
      editor.off("transaction", onTransaction);
      editor.off("focus", evaluate);
      editor.off("blur", later);
      editor.view.dom.removeEventListener("click", onClick);
    };
  }, [editor]);

  useEffect(() => {
    if (!enabled) pinned.current = null;
    evaluateRef.current();
  }, [entries, enabled, readOnly]);

  useEffect(() => {
    controlRef.current = {
      focus: () => {
        const card = cardRef.current;
        if (!card || shownRef.current === null) return false;
        (card.querySelector<HTMLElement>(FOCUS_TARGET) ?? card).focus();
        return true;
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  const entry = shown ? entries[shown.index] : undefined;
  const label = entry?.label(messages, locale) ?? "";
  // The anchor is measured on every position recalculation: the card follows the range.
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          try {
            return posToDOMRect(editor.view, shown?.from ?? 0, shown?.to ?? 0);
          } catch {
            return editor.view.dom.getBoundingClientRect();
          }
        },
        contextElement: editor.view.dom,
      },
    }),
    [editor, shown?.from, shown?.to]
  );

  return (
    <>
      {/* The live region is always mounted: the screen reader announces a change,
          not an appearance. */}
      <div role="status" className="sr-only">
        {entry
          ? messages.textCardShown({ label, shortcut: ariaShortcut(["alt", "F10"], isApple()) })
          : ""}
      </div>
      {shown && entry && (
        <Popover key={shown.index} open onOpenChange={(open) => !open && dismiss()}>
          <PopoverAnchor virtualRef={anchor} />
          <PopoverContent
            ref={cardRef}
            aria-label={label}
            side="bottom"
            align="start"
            collisionPadding={8}
            // The Editor's popover glass: the card lies above the Document.
            className={cn(
              GLASS_PANEL_CLASS,
              "max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-2"
            )}
            // Focus stays in the Document: the card is non-modal, so typing continues.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // Radix does not close the card; the rules above do: Escape, `close`, the caret
            // leaving the range, a click outside the field. A click and focus inside the
            // field are the recalculation's job.
            onFocusOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => {
              event.preventDefault();
              const target = event.target;
              if (target instanceof Node && rootRef.current?.contains(target)) return;
              pinned.current = null;
              shownRef.current = null;
              setShown(null);
            }}
            onBlur={later}
          >
            {entry.render({ editor, range: shown, close: dismiss })}
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
