"use client";

import { Extension, Node, type Extensions } from "@tiptap/core";
import { Fragment, Slice, type Node as PmNode, type ResolvedPos } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  DEFAULT_LAYOUT,
  layoutColumnCount,
  layoutFrom,
  nearestLayout,
  type EditorLayout,
} from "./columnLayouts.js";
import { containerFreeContext, placeContainerBlock, WRAPPER_NODE } from "../../core/containers.js";

/**
 * Column layout: a Block made of columns. It is `div[data-block="layout"]` with a variant in
 * `data-layout`, holding one to four `div[data-block="column"]`. A column holds any Blocks
 * except another Column layout.
 *
 * THE ATTRIBUTE NAMES COME FROM THE OWNER'S SAMPLE (`data-block="layout"`,
 * `data-block="column"`). This is how the editors that most often supply pasted HTML mark up
 * their columns. The kit's own difference is one: the widths. In the sample they are in
 * `style="flex-basis: 50%"`, but the kit's Schema does not know `style` (ADR-0050). So the
 * shares are carried by the variant name (`columnLayouts.ts`), and the `flex-basis` of a paste
 * is mapped to the nearest variant.
 *
 * NESTING IS PREVENTED AT THE ENGINE SCHEMA LEVEL, not by checks in the commands. A Column
 * layout is not in the `block` group: only the Document accepts it (`(block | layout)+`,
 * `document.ts`), while a column, a list item, a quote, a cell and a Wrapper hold `block`. So
 * neither a paste, nor `value`, nor a command can nest it. When HTML with such a case is parsed,
 * the Column layout is not cut in two; its wrappers are removed instead. A rule with `skip` in
 * a container's context yields the column Blocks one after another.
 *
 * BOTH NODES ARE `isolating`, as the table and the cell are: Backspace at the start of a column
 * does not merge it with the neighboring column or pull text out of the layout, and mouse
 * selection and the "Turn into" commands do not cross the column boundary.
 *
 * Decision: ADR-0056.
 */

/** Name of the Column layout node in the engine Schema. */
export const LAYOUT_NODE = "layout";
/** Name of the column node in the engine Schema. */
export const COLUMN_NODE = "layoutColumn";

const LAYOUT_TAG = 'div[data-block="layout"]';
const COLUMN_TAG = 'div[data-block="column"]';

/**
 * Containers where there is no Column layout: inside them, parsing strips the layout's wrappers.
 * This is the shared list of container Blocks (`containers.ts`: Wrapper, quote, list items,
 * cells), plus the column, since a column would hold a Column layout inside a Column layout.
 * A Wrapper is in the list: a Column layout inside it expands into Blocks, instead of cutting
 * the Wrapper in two.
 */
const NO_LAYOUT_CONTEXT = containerFreeContext(COLUMN_NODE);

/**
 * A column's share from a foreign `style`: `flex-basis`, `flex: 1 1 50%`, or a percentage
 * `width`.
 */
function columnShare(column: Element): number | null {
  const style = (column as HTMLElement).style;
  const raw = style?.flexBasis || style?.width || "";
  return raw.endsWith("%") ? Number.parseFloat(raw) || null : null;
}

/**
 * Column layout variant from the markup. The element's own `data-layout` is used if its column
 * count matches; otherwise the variant is picked by the number of columns and their shares. This
 * is how the HTML of another editor with `flex-basis` is read, and a Column layout whose column
 * was deleted by hand.
 */
function layoutOf(element: HTMLElement): EditorLayout {
  const columns = Array.from(element.children).filter((child) => child.matches(COLUMN_TAG));
  const declared = layoutFrom(element.getAttribute("data-layout"));
  if (columns.length === 0) return declared ?? DEFAULT_LAYOUT;
  if (declared && layoutColumnCount(declared) === columns.length) return declared;
  const shares = columns.map(columnShare);
  return nearestLayout(
    columns.length,
    shares.every((share) => share !== null) ? (shares as number[]) : []
  );
}

/**
 * A column holds what a Column layout holds: Blocks, and in Markdown, one after another. With the
 * `wrapper` Tool, it also holds a Wrapper. The Wrapper groups Blocks inside a column too, and it
 * does not hold Column layouts, so no nesting appears.
 */
export const LayoutColumn = Node.create<{ wrapper: boolean }>({
  name: COLUMN_NODE,
  addOptions: () => ({ wrapper: false }),
  content() {
    return this.options.wrapper ? `(block | ${WRAPPER_NODE})+` : "block+";
  },
  isolating: true,
  /*
    A column is a Block container (`isBlockContainer`, `blockCommands.ts`). Its children are
    Blocks, each with its own handle at the column's left edge. "Up", "Down", "Add below" and
    `⌥⇧↑/↓` stay inside the column, as they do in the Document.
  */
  extendNodeSchema: (extension) => (extension.name === COLUMN_NODE ? { blockContainer: true } : {}),
  parseHTML: () => [
    { tag: COLUMN_TAG, context: NO_LAYOUT_CONTEXT, skip: true, priority: 60 },
    { tag: COLUMN_TAG },
  ],
  renderHTML: () => ["div", { "data-block": "column" }, 0],
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n\n") : "",
});

export const Layout = Node.create({
  name: LAYOUT_NODE,
  content: `${COLUMN_NODE}{1,4}`,
  isolating: true,
  addAttributes: () => ({
    variant: {
      default: DEFAULT_LAYOUT,
      parseHTML: (element) => layoutOf(element),
      // The node's `renderHTML` writes it. The value is checked against the number of columns.
      rendered: false,
    },
  }),
  parseHTML: () => [
    { tag: LAYOUT_TAG, context: NO_LAYOUT_CONTEXT, skip: true, priority: 60 },
    { tag: LAYOUT_TAG },
  ],
  /*
    The variant is written from the node, not from the attribute. The parser wraps a column
    without a Column layout in the default Column layout, and until `fixLayouts` runs, the
    attribute and the column count disagree. HTML with such a variant is never output.
  */
  renderHTML: ({ node, HTMLAttributes }) => [
    "div",
    { "data-block": "layout", ...HTMLAttributes, "data-layout": layoutOfNode(node) },
    0,
  ],
  /*
    Markdown has no columns (the owner's decision): the column Blocks are exported one after
    another, left to right, in the same order a screen reader reads them.
  */
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n\n") : "",

  addCommands() {
    return {
      insertLayout:
        (variant = DEFAULT_LAYOUT) =>
        ({ tr, dispatch }) => {
          if (dispatch) placeLayout(tr, variant);
          return true;
        },
      setLayout:
        (variant) =>
        ({ tr, dispatch }) => {
          const found = layoutAt(tr.selection);
          if (!found) return false;
          if (dispatch) switchLayout(tr, found.pos, variant);
          return true;
        },
    };
  },

  /*
    A Column layout from `defaultValue` or `value` whose column count does not match its variant
    (a column was deleted by hand, or a column without a Column layout got wrapped in the default
    one) is brought to the variant that fits the column count. Like table alignment, this is not
    an edit by the author: no `onChange` and no history entry.
  */
  onCreate() {
    const tr = fixLayouts(this.editor.state.tr);
    if (tr) {
      this.editor.view.dispatch(tr.setMeta("preventUpdate", true).setMeta("addToHistory", false));
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("layoutFix"),
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged) ? fixLayouts(state.tr) : null,
        props: {
          transformPasted: (slice, view) =>
            view.state.selection.$from.depth > 1 ? flattenSlice(slice) : slice,
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    layout: {
      /**
       * Insert a Column layout of variant `variant` (default: two columns) below the current
       * top-level Block. An empty top-level paragraph is replaced. The caret goes to the first
       * column.
       */
      insertLayout: (variant?: EditorLayout) => ReturnType;
      /**
       * Change the variant of the Column layout under the caret. Extra columns are merged into
       * the last remaining one, and missing ones are added empty, so no content is lost. Outside
       * a Column layout, returns `false`.
       */
      setLayout: (variant: EditorLayout) => ReturnType;
    };
  }
}

/**
 * The Column layout under the selection: the one selected as a node, or the one whose column
 * holds the caret.
 */
export function layoutAt(selection: Selection): { pos: number; node: PmNode } | null {
  if (selection instanceof NodeSelection && selection.node.type.name === LAYOUT_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === LAYOUT_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Variant of a Column layout node: its attribute, if the column count matches it; otherwise the
 * variant chosen by the column count.
 */
export function layoutOfNode(node: PmNode): EditorLayout {
  const variant = layoutFrom(node.attrs.variant);
  return variant && layoutColumnCount(variant) === node.childCount
    ? variant
    : nearestLayout(node.childCount);
}

/**
 * Variant of the Column layout under the selection, or `null`. Used to mark the current item in
 * the "Format ›" menu.
 */
export function currentLayout(state: EditorState): EditorLayout | null {
  const found = layoutAt(state.selection);
  return found ? layoutOfNode(found.node) : null;
}

/** Empty column: one empty text Block. */
function isEmptyColumn(column: PmNode): boolean {
  const first = column.firstChild;
  return column.childCount === 1 && !!first?.isTextblock && first.content.size === 0;
}

function createLayout(state: { schema: EditorState["schema"] }, variant: EditorLayout): PmNode {
  const { schema } = state;
  const column = () => schema.nodes[COLUMN_NODE]!.create(null, schema.nodes.paragraph!.create());
  return schema.nodes[LAYOUT_NODE]!.create(
    { variant },
    Array.from({ length: layoutColumnCount(variant) }, column)
  );
}

/**
 * A new Column layout can go only at the top level of the Document, since only the Document
 * accepts it. The shared helper (`placeContainerBlock`, `containers.ts`) climbs to the top
 * level from a column, a Wrapper, a list, a quote or a cell. An empty top-level paragraph is
 * replaced, and an empty paragraph in a column or a Wrapper that has `/` is removed.
 */
function placeLayout(tr: Transaction, variant: EditorLayout): void {
  placeContainerBlock(tr, createLayout(tr.doc.type, variant));
}

/**
 * Change the variant of the Column layout at `pos`.
 *
 * Extra columns are MERGED, not deleted: `join` moves their Blocks to the end of the last
 * remaining column, and a caret that was in an extra column moves along with its text. Empty
 * extra columns are simply dropped, since an empty paragraph in someone else's column would be
 * junk. One transaction is one undo step.
 */
function switchLayout(tr: Transaction, pos: number, variant: EditorLayout): void {
  const count = layoutColumnCount(variant);
  const layoutNode = () => tr.doc.nodeAt(pos)!;
  const columnStart = (index: number) => {
    let at = pos + 1;
    for (let i = 0; i < index; i++) at += layoutNode().child(i).nodeSize;
    return at;
  };
  // Empty extra columns are removed from the end, so the positions of the left ones do not shift.
  for (let index = layoutNode().childCount - 1; index >= count; index--) {
    const column = layoutNode().child(index);
    if (isEmptyColumn(column) && layoutNode().childCount > 1) {
      const start = columnStart(index);
      tr.delete(start, start + column.nodeSize);
    }
  }
  while (layoutNode().childCount > count) tr.join(columnStart(count));
  const node = layoutNode();
  // The last remaining column was empty, and other Blocks were merged into it. The empty
  // paragraph at its top does not stay.
  if (node.childCount === count && count > 0) {
    const last = node.child(count - 1);
    if (
      last.childCount > 1 &&
      last.firstChild!.isTextblock &&
      last.firstChild!.content.size === 0
    ) {
      const start = columnStart(count - 1) + 1;
      tr.delete(start, start + last.firstChild!.nodeSize);
    }
  }
  const missing = count - layoutNode().childCount;
  if (missing > 0) {
    const { schema } = tr.doc.type;
    const columns = Array.from({ length: missing }, () =>
      schema.nodes[COLUMN_NODE]!.create(null, schema.nodes.paragraph!.create())
    );
    tr.insert(pos + layoutNode().nodeSize - 1, columns);
  }
  tr.setNodeMarkup(pos, undefined, { ...layoutNode().attrs, variant });
}

/**
 * Column layouts whose column count does not match their variant are brought to the variant
 * that fits the column count (60/40 stays 60/40 while there are two columns). Column layouts
 * live only at the top level, so the walk goes over the Document's children.
 */
function fixLayouts(tr: Transaction): Transaction | null {
  let changed = false;
  tr.doc.forEach((node, offset) => {
    if (node.type.name !== LAYOUT_NODE) return;
    const variant = layoutOfNode(node);
    if (variant === node.attrs.variant) return;
    tr.setNodeMarkup(offset, undefined, { ...node.attrs, variant });
    changed = true;
  });
  return changed ? tr : null;
}

/** Column layouts in a fragment become their column Blocks, one after another. */
function flatten(fragment: Fragment): Fragment {
  const nodes: PmNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === LAYOUT_NODE) {
      node.forEach((column) => column.forEach((block) => nodes.push(block)));
    } else {
      nodes.push(node);
    }
  });
  return Fragment.fromArray(nodes);
}

/**
 * A Column layout from the clipboard that is pasted somewhere other than the top level (into a
 * column, a list, a quote or a cell) is unwrapped into Blocks. Otherwise ProseMirror, finding no
 * place for it, would cut the paste's container in two. The open edges of the fragment lose two
 * levels: the Column layout and the column.
 */
function flattenSlice(slice: Slice): Slice {
  const { content } = slice;
  let hasLayout = false;
  content.forEach((node) => {
    if (node.type.name === LAYOUT_NODE) hasLayout = true;
  });
  if (!hasLayout) return slice;
  const open = (side: number, node: PmNode | null) =>
    node?.type.name === LAYOUT_NODE ? Math.max(0, side - 2) : side;
  return new Slice(
    flatten(content),
    open(slice.openStart, content.firstChild),
    open(slice.openEnd, content.lastChild)
  );
}

/*
  The gap cursor's placement check is the same one the gap cursor plugin uses (as in
  `tables.ts`). The package's types do not declare it (`@internal`).
*/
const gapCursorFits = ($pos: ResolvedPos): boolean =>
  (GapCursor as unknown as { valid($pos: ResolvedPos): boolean }).valid($pos);

/**
 * The column whose edge holds the caret: every ancestor of the text Block, up to the column, is
 * the last child of its parent in the direction `dir`. Otherwise `-1`.
 */
function columnAtEdge($head: ResolvedPos, dir: 1 | -1): number {
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const parent = $head.node(depth);
    const atEdge =
      dir < 0 ? $head.index(depth) === 0 : $head.indexAfter(depth) === parent.childCount;
    if (!atEdge) return -1;
    if (parent.type.name === COLUMN_NODE) return depth;
  }
  return -1;
}

/**
 * Leave the Column layout upward or downward: into the neighboring Block, or, at the Document's
 * edge, into a gap cursor.
 */
function leaveLayout(view: EditorView, layoutDepth: number, dir: 1 | -1): boolean {
  const { state } = view;
  const { $head } = state.selection;
  const $outside = state.doc.resolve(
    dir > 0 ? $head.after(layoutDepth) : $head.before(layoutDepth)
  );
  const next = Selection.findFrom($outside, dir);
  const selection = next ?? (gapCursorFits($outside) ? new GapCursor($outside) : null);
  if (!selection) return false;
  view.dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
}

/**
 * Arrow keys at the edge of a column.
 *
 * `←` and `→` move into the neighboring column (to the end of the left one, to the start of the
 * right one). From the outermost column they leave the Column layout. `↑` and `↓` on the top or
 * bottom line of any column leave the Column layout, to the Block above or below it. The browser
 * moves the caret in a grid by geometry: `↓` from a short left column would land in the middle of
 * the right one, or even past the layout. Inside a column, the arrows stay with the browser.
 */
function arrow(view: EditorView, axis: "horizontal" | "vertical", dir: 1 | -1): boolean {
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const columnDepth = columnAtEdge($head, dir);
  if (columnDepth < 0) return false;
  const side = axis === "vertical" ? (dir > 0 ? "down" : "up") : dir > 0 ? "right" : "left";
  if (!view.endOfTextblock(side)) return false;
  const layoutDepth = columnDepth - 1;
  if (axis === "horizontal") {
    const layout = $head.node(layoutDepth);
    const index = $head.index(layoutDepth) + dir;
    if (index >= 0 && index < layout.childCount) {
      const boundary = dir > 0 ? $head.after(columnDepth) : $head.before(columnDepth);
      const next = Selection.findFrom(doc.resolve(boundary), dir, true);
      if (!next) return false;
      view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
      return true;
    }
  }
  return leaveLayout(view, layoutDepth, dir);
}

/** Nodes that own Tab inside a column: list items, table cells, code blocks. */
const TAB_OWNERS: ReadonlySet<string> = new Set([
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "codeBlock",
]);

/**
 * Tab and Shift+Tab move to the start of the next or previous column, as Tab moves between table
 * cells. A list, a table or a code block inside a column keeps Tab for itself. From the last
 * column, Tab goes to the browser: focus leaves the Editor, as it does from any paragraph. There
 * is no keyboard trap (WCAG 2.1.2).
 */
function tabToColumn(
  state: EditorState,
  dir: 1 | -1,
  dispatch?: (tr: Transaction) => void
): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (TAB_OWNERS.has(node.type.name)) return false;
    if (node.type.name !== COLUMN_NODE) continue;
    const layout = $from.node(depth - 1);
    const index = $from.index(depth - 1) + dir;
    if (index < 0 || index >= layout.childCount) return false;
    let start = $from.before(depth - 1) + 1;
    for (let i = 0; i < index; i++) start += layout.child(i).nodeSize;
    const target = Selection.findFrom(state.doc.resolve(start + 1), 1, true);
    if (!target) return false;
    dispatch?.(state.tr.setSelection(target).scrollIntoView());
    return true;
  }
  return false;
}

/**
 * The caret is at the very start of a column (`dir < 0`) or at its very end (`dir > 0`), with an
 * empty selection.
 */
function atColumnBoundary(state: EditorState, dir: 1 | -1): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const atTextEdge =
    dir < 0 ? $head.parentOffset === 0 : $head.parentOffset === $head.parent.content.size;
  return atTextEdge && columnAtEdge($head, dir) >= 0;
}

/** Arrow keys and Tab between columns. */
const LayoutKeys = Extension.create({
  name: "layoutKeys",
  addKeyboardShortcuts() {
    const view = () => this.editor.view;
    return {
      ArrowRight: () => arrow(view(), "horizontal", 1),
      ArrowLeft: () => arrow(view(), "horizontal", -1),
      ArrowDown: () => arrow(view(), "vertical", 1),
      ArrowUp: () => arrow(view(), "vertical", -1),
      Tab: () => this.editor.isEditable && tabToColumn(this.editor.state, 1, view().dispatch),
      "Shift-Tab": () =>
        this.editor.isEditable && tabToColumn(this.editor.state, -1, view().dispatch),
    };
  },
});

/**
 * Backspace at the start of a column and Delete at its end run last, after all the core rules
 * (this extension's `priority` is lower than theirs). The core still turns a heading at the start
 * of a column into a paragraph, and lifts a list item out of its list. If nobody handles the key,
 * it is swallowed. `isolating` stops ProseMirror's commands from merging the columns, and without
 * the swallow the browser would make the edit itself, through the DOM and outside the Schema, and
 * the columns would merge into one.
 */
const LayoutBoundary = Extension.create({
  name: "layoutBoundary",
  priority: 1,
  addKeyboardShortcuts() {
    const guard = (dir: 1 | -1) => () =>
      this.editor.isEditable && atColumnBoundary(this.editor.state, dir);
    return { Backspace: guard(-1), Delete: guard(1) };
  },
});

/**
 * Everything the Column layout needs apart from the Document (`document.ts`): the nodes and the
 * keyboard. `wrapper` says whether the Wrapper Tool is on. If it is, the column accepts a
 * Wrapper too.
 */
export function layoutExtensions({ wrapper }: { wrapper: boolean }): Extensions {
  return [Layout, LayoutColumn.configure({ wrapper }), LayoutKeys, LayoutBoundary];
}
