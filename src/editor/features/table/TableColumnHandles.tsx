"use client";

import type { Editor } from "@tiptap/react";
import { isInTable, selectedRect } from "@tiptap/pm/tables";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMessages } from "../../../i18n/useMessages.js";
import { sharesOf, writeShares } from "./tableColumns.js";
import { columnEdges, columnWidths } from "./tableMeasure.js";
import { equalShares, moveBoundary, snapShares } from "./tableShareMath.js";
import { SHARE_STEP } from "./tableShares.js";

/** A handle bar: where it sits in the frame, in pixels from the frame's top left. */
interface Bar {
  boundary: number;
  x: number;
  top: number;
  height: number;
}

/** One drag in progress, kept in a ref: the pointer moves faster than React renders. */
interface Drag {
  pointerId: number;
  tablePos: number;
  boundary: number;
  /** The edges of the two columns around the boundary, in viewport pixels. */
  left: number;
  right: number;
  /** The shares the drag starts from: the table's own, or the ones rounded from what is on screen. */
  shares: number[];
  /** Where the bar is now, in viewport pixels. */
  x: number;
  /** The pointer has gone far enough to count as a drag. */
  moved: boolean;
  startX: number;
}

/** A pointer that moved less than this did not drag: a click on the bar changes nothing. */
const DRAG_THRESHOLD = 3;

/**
 * Column width handles of the table (ADR-0080, decision 4): a bar on the boundary between every two
 * neighbouring columns of the table the caret is in, or the pointer is over. Dragging it moves the
 * boundary and nothing else: the two columns around it trade width, the rest of the table stays.
 *
 * FOR THE POINTER ONLY. The bars are `aria-hidden` and outside the Tab order: in a table `Tab` walks
 * the cells already, and a bar per boundary would be dozens of stops in a big table. The keyboard has
 * the same widths in the menu ("Column › Wider / Narrower"). A bar on a touch screen is always visible
 * and wider, since there is no hover to show it.
 *
 * THE BAR MOVES SMOOTHLY, THE COLUMNS MOVE ON RELEASE. While the pointer is down only the bar follows
 * it; on release the boundary snaps to the nearest 5% and one edit is made, so a drag is one undo step
 * and the Document never holds a width between two steps. The first drag in a table without widths
 * starts from the widths on screen rounded to 5% for all columns (the table has its own now).
 *
 * WHY NOT THE ENGINE'S HANDLE. `prosemirror-tables` resizes in pixels, in the cells, with a handle for
 * the mouse only. This one writes shares on the table, and the table is not a node view (`tables.ts`),
 * so the bars live in a layer over the frame and are positioned from the cells' boxes (`tableMeasure.ts`).
 * The last column has no bar: nothing sits to its right to trade width with.
 */
export function TableColumnHandles({ editor }: { editor: Editor }) {
  const messages = useMessages().editor;
  const layer = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [dragging, setDragging] = useState<{ boundary: number; x: number } | null>(null);
  /** The table the pointer is over, when the caret is not in one. */
  const hovered = useRef<number | null>(null);
  const tablePos = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);

  /** The table the bars belong to: the one with the caret, else the one under the pointer. */
  const activeTable = useCallback((): number | null => {
    const { state } = editor;
    if (isInTable(state)) return selectedRect(state).tableStart - 1;
    const pos = hovered.current;
    const node = pos === null ? null : state.doc.nodeAt(pos);
    return node?.type.spec.tableRole === "table" ? pos : null;
  }, [editor]);

  const measure = useCallback(() => {
    frame.current = 0;
    const origin = layer.current?.getBoundingClientRect();
    const pos = editor.isEditable && !editor.isDestroyed ? activeTable() : null;
    tablePos.current = pos;
    const table = pos === null ? null : editor.view.nodeDOM(pos);
    const edges = pos === null ? null : columnEdges(editor.view, pos);
    if (!origin || !edges || !(table instanceof HTMLElement)) {
      setBars((previous) => (previous.length === 0 ? previous : []));
      return;
    }
    const box = table.getBoundingClientRect();
    const height = Math.min(box.height, table.clientHeight || box.height);
    const next: Bar[] = [];
    // A boundary scrolled out of the table's own scroll box has no bar: it is not on screen.
    for (let boundary = 1; boundary < edges.length - 1; boundary++) {
      const edge = edges[boundary]!;
      if (edge < box.left || edge > box.right) continue;
      next.push({ boundary, x: edge - origin.left, top: box.top - origin.top, height });
    }
    setBars((previous) => (same(previous, next) ? previous : next));
  }, [editor, activeTable]);

  /** Measure once per frame, however many events asked: scrolling and typing both ask often. */
  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const dom = editor.view.dom;
    const container = layer.current?.parentElement ?? dom;
    const onOver = (event: PointerEvent) => {
      const table = event.target instanceof Element ? event.target.closest("table") : null;
      hovered.current = table ? tableAt(editor, table) : null;
      schedule();
    };
    const onLeave = (event: PointerEvent) => {
      // Moving onto a bar leaves the Document, but not the table.
      if (event.relatedTarget instanceof Node && layer.current?.contains(event.relatedTarget))
        return;
      hovered.current = null;
      schedule();
    };
    editor.on("transaction", schedule);
    dom.addEventListener("pointerover", onOver);
    dom.addEventListener("pointerleave", onLeave);
    // The table scrolls inside itself, and so may the Document: scroll does not bubble, so it is caught on the way down.
    container.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(dom);
    schedule();
    return () => {
      editor.off("transaction", schedule);
      dom.removeEventListener("pointerover", onOver);
      dom.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [editor, schedule]);

  const begin = (event: ReactPointerEvent<HTMLDivElement>, boundary: number) => {
    const pos = tablePos.current;
    if (event.button !== 0 || !editor.isEditable || pos === null) return;
    // The Document keeps its focus and its caret: the bar is not a place to type.
    event.preventDefault();
    const table = editor.state.doc.nodeAt(pos);
    const edges = columnEdges(editor.view, pos);
    if (!table || !edges) return;
    const shares =
      sharesOf(table) ?? snapShares(columnWidths(edges)) ?? equalShares(edges.length - 1);
    if (!shares) return;
    drag.current = {
      pointerId: event.pointerId,
      tablePos: pos,
      boundary,
      left: edges[boundary - 1]!,
      right: edges[boundary + 1]!,
      shares,
      x: edges[boundary]!,
      moved: false,
      startX: event.clientX,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging({ boundary, x: edges[boundary]! - (layerOrigin(layer.current)?.left ?? 0) });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    // Each of the two columns keeps at least a step: the bar stops there, as the snapped result will.
    const pair = current.shares[current.boundary - 1]! + current.shares[current.boundary]!;
    const margin = ((current.right - current.left) * SHARE_STEP) / pair;
    current.x = Math.min(current.right - margin, Math.max(current.left + margin, event.clientX));
    if (Math.abs(event.clientX - current.startX) >= DRAG_THRESHOLD) current.moved = true;
    setDragging({
      boundary: current.boundary,
      x: current.x - (layerOrigin(layer.current)?.left ?? 0),
    });
  };

  const end = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    drag.current = null;
    setDragging(null);
    if (cancelled || !current.moved) return;
    const table = editor.state.doc.nodeAt(current.tablePos);
    if (table?.type.spec.tableRole !== "table") return;
    const pair = current.shares[current.boundary - 1]! + current.shares[current.boundary]!;
    const left = ((current.x - current.left) / (current.right - current.left)) * pair;
    const next = moveBoundary(current.shares, current.boundary, left);
    // A table that had no widths gets them even when the bar snapped back to where it was.
    const result = next ?? (sharesOf(table) ? null : current.shares);
    if (!result) return;
    editor.view.dispatch(writeShares(editor.state.tr, current.tablePos, result));
    editor.commands.showNotice({
      tone: "status",
      text: messages.tableColumnWidth({ percent: result[current.boundary - 1]! }),
    });
  };

  return (
    <div
      ref={layer}
      aria-hidden="true"
      data-table-column-handles=""
      className="pointer-events-none absolute inset-0"
    >
      {bars.map((bar) => {
        const active = dragging?.boundary === bar.boundary;
        return (
          <div
            key={bar.boundary}
            data-column-handle={bar.boundary}
            className={BAR_CLASS}
            style={{
              left: active ? dragging.x : bar.x,
              top: bar.top,
              height: bar.height,
            }}
            onPointerDown={(event) => begin(event, bar.boundary)}
            onPointerMove={move}
            onPointerUp={(event) => end(event, false)}
            onPointerCancel={(event) => end(event, true)}
          >
            <div className={cnLine(active)} />
          </div>
        );
      })}
    </div>
  );
}

/*
  The hit area is 12 px wide (24 px on a touch screen), the line inside it 2 px. `touch-none` keeps a
  finger drag from scrolling the page; `cursor-col-resize` is the mouse's hint. Only the bar takes
  pointer events: the layer over the Document lets everything else through.
*/
const BAR_CLASS =
  "pointer-events-auto group absolute w-3 -translate-x-1/2 cursor-col-resize touch-none " +
  "pointer-coarse:w-6";

const cnLine = (active: boolean) =>
  "mx-auto h-full w-0.5 rounded-full bg-accent-strong transition-opacity " +
  (active ? "opacity-100" : "opacity-0 group-hover:opacity-100 pointer-coarse:opacity-40");

function same(a: readonly Bar[], b: readonly Bar[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (bar, i) =>
        bar.boundary === b[i]!.boundary &&
        bar.x === b[i]!.x &&
        bar.top === b[i]!.top &&
        bar.height === b[i]!.height
    )
  );
}

function layerOrigin(layer: HTMLElement | null) {
  return layer?.getBoundingClientRect();
}

/** The position of the table node that owns this DOM table, or `null` if the engine has no such node. */
function tableAt(editor: Editor, dom: Element): number | null {
  try {
    const $pos = editor.state.doc.resolve(editor.view.posAtDOM(dom, 0));
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.spec.tableRole === "table") return $pos.before(depth);
    }
  } catch {
    // The DOM table is not in the engine's document (a node being replaced): no table to belong to.
  }
  return null;
}
