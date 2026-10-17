"use client";

import type { Editor } from "@tiptap/core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/overlays/HoverCard.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { watchHandleEditor } from "../../core/handleWatchers.js";
import type { RichTextEditorHandle } from "../../RichTextEditor.js";
import { tocDocumentHeadings } from "./documentHeadings.js";
import { collectHeadings, documentRoot, type TocHeading } from "./headings.js";
import { stickyOffset } from "./stickyOffset.js";

export interface RichTextTocProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Ref to the View (`RichTextView`) or to the Editor's Handle (`RichTextEditor`) whose headings
   * the Table of contents shows. The headings are read from the target's DOM after mount: until
   * hydration there is no strip.
   *
   * The list follows the Document: a new `html` on the View, a new value in the
   * Editor, and an edit in it rebuild the list after a short delay. An Editor with
   * `readOnly` works the same way as the View. An Editor that is being edited is
   * supported too: the list rebuilds, and a jump does not move the caret, but the
   * contract does not promise this mode. The Editor's engine appears after mount,
   * and the table of contents waits for it by itself.
   */
  target: RefObject<HTMLElement | RichTextEditorHandle | null>;
  /**
   * Name of the CSS variable with the height of the sticky top bar ([ADR-0016]). Jumping to a
   * heading places it below the bar, not behind it, and the highlight measures the current section
   * from the bar's bottom edge. Without the variable, the offset is the heading's
   * `scroll-margin-top`. Defaults to `--topbar-h`, which `TopBar` publishes.
   */
  offsetVar?: string;
  /**
   * List width: a CSS length or pixels. It is fixed, not sized to the longest
   * heading, so the list does not change size from Document to Document. A heading
   * that does not fit is cut with an ellipsis; the full text is in the item's tooltip.
   * Defaults to 240px.
   */
  listWidth?: number | string;
  /**
   * Heading levels that go into the Table of contents: a subset of 1–4. Headings of any other level
   * appear neither in the strip nor in the list, and item indents are measured from the largest of
   * the remaining levels. The prop is read every time the list is built, so changing the set of
   * levels rebuilds the list. Defaults to all four.
   */
  levels?: readonly (1 | 2 | 3 | 4)[];
}

/**
 * Stroke length by depth: the deeper the level, the shorter the stroke. There are
 * four steps, one per heading level H1–H4, so each level has its own length.
 */
const STROKE_WIDTH = ["w-3.5", "w-3", "w-2.5", "w-2"] as const;
/**
 * The current section's stroke has the same thickness as the others (a 2px cell),
 * but it is longer than the top-level stroke and uses the accent color. It is
 * visible in the strip at a glance, yet does not stick out of it.
 */
const CURRENT_STROKE = "bg-accent-strong h-0.5 w-4";
/** Text indent of an item by depth. */
const ITEM_INDENT = ["pl-0", "pl-2.5", "pl-5", "pl-7.5"] as const;

const strokeWidth = (depth: number) => STROKE_WIDTH[Math.min(depth, STROKE_WIDTH.length - 1)];
const itemIndent = (depth: number) => ITEM_INDENT[Math.min(depth, ITEM_INDENT.length - 1)];

/*
  Hover delays are shorter than the `HoverCard` defaults (700 and 300 ms). The card
  sits on a link in the middle of the text, and the cursor sweeps over it by accident;
  the table of contents strip stands in its own column, so when someone hovers it,
  they want the list. The mechanism is the same as the card's: the component is built on it.
*/
const OPEN_DELAY = 200;
const CLOSE_DELAY = 300;

/** All heading levels: the table of contents without `levels`. */
const ALL_LEVELS = [1, 2, 3, 4] as const;

/** Pause after the last edit of the Document, after which the list is rebuilt. */
const REBUILD_DELAY = 150;

/**
 * Step between the strip's strokes, and its bounds. A stroke cell is 2px, exactly
 * the stroke's width (see the strip; the owner's decision on the 4.7.0 preview,
 * OLDSUI-289: it was 3px). The gap between cells is 5px. `p-1` gives 4px above and
 * below; the remaining space is margin above and below the strip.
 */
const STRIP_GAP = 5;
const STRIP_CELL = 2;
const STRIP_PADDING = 8;
const STRIP_MARGIN = 16;

/** How long the scroll caused by a jump must stay quiet to count as finished. */
const PIN_SETTLE = 150;

/** Slack below the reference line: a heading that has risen right under the top bar is already current. */
const SPY_SLACK = 8;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Nearest scrollable ancestor of the target; `null` means the window scrolls. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent === document.body || parent === document.documentElement) return null;
    const { overflowY } = getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
  }
  return null;
}

/** How long the jumped-to heading's highlight takes to fade. */
const FLASH_DURATION = 1600;

/**
 * Highlight the heading that was jumped to: its background fades from the accent
 * color to transparent. The eye finds where the page has moved, especially when
 * the heading could not be brought to the top edge (the end of the Document).
 *
 * It uses a Web Animations API animation, not a class: no class and no `style`
 * appears in the Document, so the Schema and the saved HTML stay as they were, and
 * the Editor does not mistake the highlight for an edit. The color is read from a
 * token on the heading itself, so it is correct on the Paper surface and inside a
 * nested theme. Without the Web Animations API, there is no highlight.
 */
/** Easing curve of the motion scale, read from the node; without the token, the default `ease`. */
function scaleCurve(node: HTMLElement, token: string): string {
  return getComputedStyle(node).getPropertyValue(token).trim() || "ease";
}

function flash(heading: HTMLElement) {
  if (typeof heading.animate !== "function") return;
  const accent = getComputedStyle(heading).getPropertyValue("--accent-strong").trim();
  const color = accent ? `color-mix(in srgb, ${accent} 24%, transparent)` : "transparent";
  // The field around the text is a shadow without blur, not `padding`: the
  // heading does not shift by a pixel while the highlight fades.
  heading.animate(
    [
      { backgroundColor: color, boxShadow: `0 0 0 6px ${color}`, borderRadius: "4px" },
      { backgroundColor: "transparent", boxShadow: "0 0 0 6px transparent", borderRadius: "4px" },
    ],
    // The curve is a step of the `--ease-enter` motion scale (ADR-0047): it fades
    // fast and settles slowly. The duration is deliberately outside the scale: this
    // is not a transition between states but a trace the eye should have time to notice.
    { duration: FLASH_DURATION, easing: scaleCurve(heading, "--ease-enter") }
  );
}

/**
 * Jump to a heading: scroll to it and move focus onto it.
 *
 * No anchors: the page address does not change, and no `id`s appear in the
 * Document (ADR-0066). Screen readers and the keyboard need the focus — the next
 * Tab goes from the heading, not from the table of contents. `tabindex="-1"` is
 * set only for the duration of the focus, so no trace is left in the Document
 * after focus moves away.
 */
function jumpTo(
  heading: HTMLElement,
  offset: number | null,
  focusHeading?: (heading: HTMLElement) => boolean
) {
  /*
    In an Editor being edited, the heading sits inside a `contenteditable`, and
    ProseMirror watches its DOM: it would count a foreign `tabindex` as an edit and
    re-render the heading without the attribute, and focus would be lost with it.
    Focus on the heading is not needed here anyway: it cannot be set without moving
    the caret, and the caret stays where the author left it. Scrolling works as usual.
  */
  // The consumer of the field (the Editor's `toc` Tool) may set focus itself, moving
  // the caret into the heading; otherwise focus goes to the heading itself, unless it is being edited.
  if (focusHeading?.(heading)) {
    // Focus was set.
  } else if (!heading.parentElement?.closest('[contenteditable="true"]')) {
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    heading.focus({ preventScroll: true });
  }
  // The highlight is an animation with no trace in the DOM, so it also suits an Editor being edited.
  flash(heading);

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const scroller = scrollParent(heading);
  if (offset === null) {
    // Without a top bar, the offset is set by the heading's `scroll-margin-top`
    // (ADR-0016). The browser scrolls the window. But `scrollIntoView` also moves
    // every scrollable ancestor, so with the Document in its own scroll container
    // the page itself would move too. That is why the container is scrolled on its
    // own and the window is left alone.
    if (!scroller) {
      heading.scrollIntoView({ behavior, block: "start" });
      return;
    }
    const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
    const edge = scroller.getBoundingClientRect().top;
    const top = heading.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + top - edge - margin, behavior });
    return;
  }
  const top = heading.getBoundingClientRect().top;
  if (scroller) {
    const edge = scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + top - edge, behavior });
  } else {
    window.scrollTo({ top: window.scrollY + top - offset, behavior });
  }
}

/**
 * Current section: the last heading that has risen to the reference line, which is
 * the bottom edge of the top bar or the top of the scroll container. If none has
 * risen, the first heading is current. If the Document is scrolled to the end, the
 * current one is the last visible heading: short final sections never reach the
 * reference line on their own.
 */
function currentIndex(headings: TocHeading[], offset: number | null): number {
  const first = headings[0];
  if (!first) return -1;
  const scroller = scrollParent(first.element);
  const edge = scroller ? scroller.getBoundingClientRect().top : (offset ?? 0);
  const line = edge + SPY_SLACK;

  const atEnd = scroller
    ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;

  let current = 0;
  headings.forEach((heading, index) => {
    const top = heading.element.getBoundingClientRect().top;
    if (top <= line || (atEnd && top < bottom)) current = index;
  });
  return current;
}

/** Scroll `box` by exactly as much as needed for `item` to be fully visible. */
function keepVisible(item: HTMLElement | undefined, box: HTMLElement | null) {
  if (!item || !box) return;
  const itemRect = item.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  if (itemRect.top < boxRect.top) box.scrollTop -= boxRect.top - itemRect.top;
  else if (itemRect.bottom > boxRect.bottom) box.scrollTop += itemRect.bottom - boxRect.bottom;
}

/**
 * The Document element behind the target's ref. For the View, it is the element
 * itself; for the Editor, it is the root ProseMirror node of its engine: the Toolbar
 * and the status line around it are not part of the Document. If the engine does
 * not exist yet (or is destroyed), returns `null`.
 */
function resolveTarget(target: RefObject<HTMLElement | RichTextEditorHandle | null>) {
  const value = target.current;
  if (!value) return null;
  if (!("editor" in value)) return value;
  const { editor } = value;
  return editor && !editor.isDestroyed ? editor.view.dom : null;
}

/** The same set of headings: editing text outside the headings must not re-render anything. */
function sameHeadings(a: TocHeading[], b: TocHeading[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (heading, index) =>
        heading.element === b[index]!.element &&
        heading.text === b[index]!.text &&
        heading.depth === b[index]!.depth
    )
  );
}

/**
 * Step between strokes, chosen so that the strip is no taller than the window. If
 * there is room, the normal step is used; if there is not, the step shrinks down to
 * zero. The cells stay a constant size and only the gap between them changes. The
 * gap is computed only from the window size and the number of headings, not from the
 * current section, so the strip does not jitter while scrolling.
 */
function stripGap(count: number, offset: number | null): number {
  if (count < 2) return STRIP_GAP;
  const room =
    window.innerHeight - (offset ?? 0) - STRIP_MARGIN * 2 - STRIP_PADDING - count * STRIP_CELL;
  return Math.max(0, Math.min(STRIP_GAP, room / (count - 1)));
}

/**
 * Whether the strip fits to the left of the text: entirely inside the window and
 * not overlapping the Document. The column under the table of contents can be a page
 * margin that narrows along with the window; in that case the strip would overlap the
 * text or run off the edge.
 */
function fitsBeside(strip: HTMLElement, target: HTMLElement): boolean {
  const own = strip.getBoundingClientRect();
  const text = documentRoot(target).getBoundingClientRect();
  return own.left >= 0 && own.right <= text.left;
}

/**
 * The Document's table of contents: a strip of strokes, one per heading, with the
 * current section's stroke highlighted. Hovering expands the list of headings, and
 * an item leads to its heading.
 *
 * It is a separate component, not a View prop (ADR-0066): `RichTextView` stays
 * server-rendered, while the screen's layout decides where the table of contents
 * goes — the column, stickiness, hiding on a narrow screen. With fewer than two
 * headings, the component renders nothing.
 */
export const RichTextToc = forwardRef<HTMLDivElement, RichTextTocProps>(
  function RichTextToc(props, ref) {
    return <TocCore ref={ref} {...props} />;
  }
);

/**
 * The core of the table of contents, shared by `RichTextToc` and the Editor's `toc`
 * Tool (ADR-0068). The two settings below are internal to the kit and are not exposed:
 * the Editor itself knows where the edge of its sticky Toolbar is, and it places the
 * caret on a jump.
 */
export interface TocCoreProps extends RichTextTocProps {
  /**
   * Bottom edge of the sticky top, in pixels: the highlight, the jump, and the
   * strip's step are computed from it. If absent, the height comes from `offsetVar`.
   */
  stickyTop?: () => number | null;
  /** Sets focus on the heading during a jump by itself; `true` means focus was set. */
  focusHeading?: (heading: HTMLElement) => boolean;
  /**
   * Lowers the strip so that the first stroke sits in the middle of the first line
   * of the first heading. In the Editor's field, the strip and the heading start
   * at the same level, not with the strip above the text.
   */
  alignToFirstHeading?: boolean;
  /**
   * The current section changed (including on the first show): the Editor writes the
   * index into the state of the `toc` Tool. The index is counted over the list that
   * `TocCore` sees; while there are fewer than two headings, it keeps its previous value.
   */
  onCurrentChange?: (index: number) => void;
  /**
   * The Editor's engine. It is needed by the `jumpTo` command (`jumpRef`): the command's
   * index is the heading's index in the snapshot of the `toc` state, and the snapshot is
   * read from the engine's Document on every transaction. The core's list is rebuilt from
   * the DOM with a delay (`REBUILD_DELAY`), so right after an edit the indices of the two
   * lists would diverge. Without an engine, `jumpTo` counts against the core's list.
   */
  editor?: Editor;
  /**
   * The core's jump to a heading by its index in the state snapshot (the Tool's
   * `jumpTo` command): it behaves like a click on an item. While the core is mounted, this
   * holds a function; after unmounting, `null`. For an index with no heading, `false`.
   */
  jumpRef?: MutableRefObject<((index: number) => boolean) | null>;
}

export const TocCore = forwardRef<HTMLDivElement, TocCoreProps>(function TocCore(
  {
    target,
    offsetVar = "--topbar-h",
    listWidth = 240,
    levels,
    stickyTop,
    focusHeading,
    alignToFirstHeading = false,
    onCurrentChange,
    editor,
    jumpRef,
    className,
    style,
    ...rest
  },
  ref
) {
  // The consumer's settings are read in the scroll handlers. The latest values are
  // passed through a ref, so that a new function on each render does not recreate the listeners.
  const latest = useRef({ stickyTop, focusHeading, offsetVar, levels, onCurrentChange, editor });
  useEffect(() => {
    latest.current = { stickyTop, focusHeading, offsetVar, levels, onCurrentChange, editor };
  });
  // The set of levels is compared by value: an array literal is new on every render.
  const levelsKey = levels ? levels.join(",") : "";
  const offsetNow = useCallback(() => {
    const own = latest.current;
    return own.stickyTop ? own.stickyTop() : stickyOffset(own.offsetVar);
  }, []);
  const messages = useMessages();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [gap, setGap] = useState(STRIP_GAP);
  const [current, setCurrent] = useState(0);
  // The current section lives in the Tool state (`useRichTextToolState`).
  useEffect(() => {
    latest.current.onCurrentChange?.(current);
  }, [current]);
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(true);
  const stripRef = useRef<HTMLButtonElement>(null);
  /** The list was opened from the keyboard: focus moves into it, onto the current item. */
  const focusOnOpen = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  /** Enter or Space has already opened the list: the click that follows is their echo. */
  const keyHandled = useRef(false);

  // The target's element. The Editor's engine appears after mount (and lazily), so
  // there is a subscription for its change: the Editor reports through the same `ref`.
  useEffect(() => {
    const resolve = () => setElement(resolveTarget(target));
    resolve();
    return watchHandleEditor(target, resolve);
  }, [target]);

  // Headings follow the Document. The observer sits on the Document's root and does
  // not depend on whether the strip is drawn: with fewer than two headings the strip
  // is not drawn, but it must appear as soon as the second one arrives. Attributes are
  // not observed: a jump sets and removes `tabindex` on the heading itself, and a
  // rebuild triggered by that would replace the list nodes in use.
  useEffect(() => {
    if (!element) {
      setHeadings((prev) => (prev.length ? [] : prev));
      return;
    }
    const read = () => {
      const next = collectHeadings(element, latest.current.levels);
      setHeadings((prev) => (sameHeadings(prev, next) ? prev : next));
    };
    read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(read, REBUILD_DELAY);
    });
    observer.observe(documentRoot(element), {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [element, levelsKey]);

  // The strip's step depends on the window height and the number of headings.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setGap(stripGap(headings.length, offsetNow()));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
    };
  }, [headings.length, offsetVar, offsetNow]);

  /*
    The section chosen by a jump stays highlighted while the scroll caused by the jump
    itself is in progress. Otherwise, near the end of the Document, the rule "scrolled
    to the end: the current one is the last visible" handed the highlight to the
    neighboring heading, and a reader who chose "Surfaces" saw "What's next" highlighted.
    The recalculation resumes on the next scroll, after the jump has settled (`settled`).
  */
  const pinned = useRef<{ heading: HTMLElement; settled: boolean; timer: number } | null>(null);
  /** (Re)start the wait: the jump's scroll stays quiet for `PIN_SETTLE`, meaning the jump has settled. */
  const settle = (lock: { settled: boolean; timer: number }) => {
    window.clearTimeout(lock.timer);
    lock.timer = window.setTimeout(() => {
      lock.settled = true;
    }, PIN_SETTLE);
  };
  /*
    The jump's section is remembered as a node, not as an index: the list may rebuild
    while the scroll is in progress (an edit younger than `REBUILD_DELAY`), and an index
    would lead to the neighboring heading.
  */
  const pin = (index: number, heading: HTMLElement) => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    pinned.current = { heading, settled: false, timer: 0 };
    settle(pinned.current);
    setCurrent(index);
  };
  /*
    A jump to a list item: a click and the Tool's `jumpTo` command take the same path.
    A heading that has already left the Document (an edit younger than `REBUILD_DELAY`)
    is not an item: the list is about to rebuild.
  */
  const go = (index: number): boolean => {
    const heading = headings[index];
    if (!heading?.element.isConnected) return false;
    pin(index, heading.element);
    jumpTo(heading.element, offsetNow(), latest.current.focusHeading);
    return true;
  };
  /*
    The `jumpTo(index)` command: the index comes from the state snapshot, and the snapshot
    is read from the engine's Document (`tocDocumentHeadings`, the same traversal), so the
    heading is taken from there: `view.nodeDOM` returns its node, and ProseMirror updates
    the DOM synchronously with the transaction. The core's list may lag behind by up to
    `REBUILD_DELAY`, so it is read again rather than taken from the state: only the item's
    index is needed from it, for the highlight.
  */
  const goToSnapshotIndex = (index: number): boolean => {
    const { editor: engine, levels: shown } = latest.current;
    if (!engine) return go(index);
    if (engine.isDestroyed) return false;
    const found = tocDocumentHeadings(engine, { levels: shown ?? ALL_LEVELS })[index];
    const node = found && engine.view.nodeDOM(found.pos);
    if (!(node instanceof HTMLElement) || !node.isConnected || !element) return false;
    const fresh = collectHeadings(element, shown);
    setHeadings((prev) => (sameHeadings(prev, fresh) ? prev : fresh));
    const listed = fresh.findIndex((heading) => heading.element === node);
    if (listed >= 0) pin(listed, node);
    jumpTo(node, offsetNow(), latest.current.focusHeading);
    return true;
  };
  const goRef = useRef(goToSnapshotIndex);
  useEffect(() => {
    goRef.current = goToSnapshotIndex;
  });
  useEffect(() => {
    if (!jumpRef) return;
    jumpRef.current = (index) => goRef.current(index);
    return () => {
      jumpRef.current = null;
    };
  }, [jumpRef]);

  // Highlight of the current section. The scroll listener sits on the document in the
  // capture phase, so both window scrolling and scrolling of any container around the target reach it.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // The list rebuilt while the jump's scroll was in progress: the jump's section is
      // the same heading, but under a new index. A measurement taken mid-scroll would name
      // the neighbor, and that one would stay current once the scroll settled.
      const lock = pinned.current;
      const held =
        lock && !lock.settled ? headings.findIndex((h) => h.element === lock.heading) : -1;
      setCurrent(held >= 0 ? held : currentIndex(headings, offsetNow()));
    };
    const schedule = (event?: Event) => {
      // Only a scroll that moves the Document counts: the window's, or that of a container
      // around it. Scrolling the list itself, or someone else's carousel on the page, does not
      // touch the highlight, and does not clear the jump's section.
      const scrolled = event?.target;
      if (scrolled instanceof Element && !scrolled.contains(headings[0]!.element)) {
        return;
      }
      const lock = pinned.current;
      if (lock && !lock.settled) {
        // The jump's own scroll: wait until it settles.
        settle(lock);
        return;
      }
      pinned.current = null;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [headings, offsetVar, offsetNow]);

  // Clear the timer of the selected section on unmount.
  useEffect(() => () => window.clearTimeout(pinned.current?.timer), []);

  // No room on the left: the table of contents hides itself (ADR-0066). It uses
  // `visibility`, not unmounting: the strip keeps its place, and the measurement stays
  // valid when room appears again.
  useEffect(() => {
    const strip = stripRef.current;
    const node = element;
    if (!strip || !node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = fitsBeside(strip, node);
      setFits(next);
      if (!next) setOpen(false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(node);
    observer?.observe(document.documentElement);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [element, headings.length]);

  // Alignment to the first heading: the top offset is measured from the top of the
  // column that holds the table of contents to the middle of the heading's first line.
  // It is recalculated when the Document or the field's width changes (line wrapping).
  const [lead, setLead] = useState(0);
  useEffect(() => {
    const first = headings[0]?.element;
    const root = stripRef.current?.parentElement;
    const column = root?.parentElement;
    if (!alignToFirstHeading || !first || !column || !element) return;
    const measure = () => {
      const box = first.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(first).lineHeight) || box.height;
      const center = box.top + Math.min(line, box.height) / 2;
      const next = center - column.getBoundingClientRect().top - STRIP_PADDING / 2 - STRIP_CELL / 2;
      setLead(Math.max(0, Math.round(next)));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [alignToFirstHeading, headings, element]);

  const listRef = useCallback(
    (node: HTMLElement | null) => {
      navRef.current = node;
      if (!node) return;
      const items = node.querySelectorAll<HTMLButtonElement>("button");
      // A long list scrolls: the current item stays in the visible part of the list, both
      // when the list opens and when the section changes while it is open. Only the list
      // itself scrolls: `scrollIntoView` would move the page too.
      keepVisible(items[current], node.parentElement);
      if (!focusOnOpen.current) return;
      focusOnOpen.current = false;
      (items[current] ?? items[0])?.focus();
    },
    [current]
  );

  if (headings.length < 2) return null;

  const label = messages.editor.toc;

  const onStripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    keyHandled.current = true;
    if (open && navRef.current) {
      // The list is already open from hovering: focus moves into it at once.
      const items = navRef.current.querySelectorAll<HTMLButtonElement>("button");
      (items[current] ?? items[0])?.focus();
      return;
    }
    focusOnOpen.current = true;
    setOpen(true);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, items.length - 1)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      data-hidden={fits ? undefined : ""}
      className={cn("inline-flex", !fits && "invisible", className)}
      style={alignToFirstHeading ? { ...style, marginTop: lead } : style}
      {...rest}
    >
      <HoverCard open={open} onOpenChange={setOpen} openDelay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
        <HoverCardTrigger asChild>
          <button
            ref={stripRef}
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={() => {
              // Enter and Space are already handled in `onKeyDown`; their click is skipped.
              if (keyHandled.current) {
                keyHandled.current = false;
                return;
              }
              /*
                Mouse, touch, and screen readers: NVDA, JAWS, and VoiceOver press the
                button with a synthetic click that has no key (`detail === 0`). For
                them, focus moves into the list, as it does from the keyboard; otherwise
                the open list would stay unavailable to them.
              */
              if (!open) focusOnOpen.current = true;
              setOpen(true);
            }}
            onKeyDown={onStripKeyDown}
            style={{ rowGap: gap }}
            className="focus-visible:outline-accent-strong flex cursor-pointer flex-col items-start rounded-sm p-1 outline-offset-2 focus-visible:outline-2"
          >
            {/* A stroke cell has a constant size: the thickness and length of the
                current one animate, but the strip's dimensions do not. Otherwise the
                list anchored to its edge would jitter on every section change. */}
            {headings.map((heading, index) => (
              <span key={index} className="flex h-0.5 w-4 items-center">
                <span
                  data-toc-stroke=""
                  data-depth={heading.depth}
                  data-current={index === current || undefined}
                  className={cn(
                    "rounded-pill transition-[width,height,background-color]",
                    index === current
                      ? CURRENT_STROKE
                      : cn("bg-fg-3 h-0.5", strokeWidth(heading.depth))
                  )}
                />
              </span>
            ))}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain p-1"
          style={{ width: listWidth }}
          onEscapeKeyDown={() => stripRef.current?.focus()}
          onFocusOutside={(event) => {
            // The jump moves focus to the heading, but the list stays open: it is closed
            // by the cursor leaving, not by choosing an item. From the keyboard, focus in
            // the list no longer keeps it open, and it closes on the same timer.
            if (element?.contains(event.target as Node)) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            // The strip is an anchor, not a Radix trigger. Without this check, a press on
            // it while the list is open from hovering would count as a press "outside"
            // and close the list that this same press is asking to open.
            if (stripRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <nav ref={listRef} aria-label={label} onKeyDown={onListKeyDown}>
            <ul>
              {headings.map((heading, index) => (
                <li key={index}>
                  <button
                    type="button"
                    data-depth={heading.depth}
                    aria-current={index === current ? "location" : undefined}
                    className={cn(
                      "hover:bg-bg-2 focus-visible:bg-bg-2 flex w-full cursor-pointer items-center gap-2.5 rounded-sm py-0.5 pr-2 pl-1.5 text-left text-[13px] leading-[18px] outline-none",
                      index === current ? "bg-bg-2 text-fg-0" : "text-fg-2 hover:text-fg-0"
                    )}
                    onClick={(event) => {
                      go(index);
                      /*
                        In an Editor being edited, focus does not move to the heading and
                        stays on the item, and focus inside the list keeps it open: the
                        cursor leaving would not close it. After a mouse click, the item
                        releases focus; from the keyboard (`detail === 0`), focus stays in
                        the list, since arrow keys still move through it.
                      */
                      const item = event.currentTarget;
                      if (event.detail > 0 && document.activeElement === item) item.blur();
                    }}
                  >
                    {/* Strokes sit in a column of one width: the item text starts flush, and the depth sets the indent. */}
                    <span aria-hidden className="flex w-4 shrink-0 items-center">
                      <span
                        className={cn(
                          "rounded-pill",
                          index === current
                            ? CURRENT_STROKE
                            : cn("bg-fg-3 h-0.5", strokeWidth(heading.depth))
                        )}
                      />
                    </span>
                    <span
                      className={cn("min-w-0 truncate", itemIndent(heading.depth))}
                      title={heading.text}
                    >
                      {heading.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
});
