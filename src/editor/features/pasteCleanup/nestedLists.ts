"use client";

/** What a step knows about one list item of the source, whatever the source's markup. */
export interface FlatListItem {
  /** The source's identity of the list (Word's `l0`, SharePoint's `data-listid`); `null` if none. */
  id: string | null;
  /** The nesting level, from 1. */
  level: number;
  kind: "ul" | "ol";
  /** The number the item shows, for a numbered list; `null` for a bullet. */
  number: number | null;
}

/**
 * Build nested lists from one run of consecutive flat items: Word and SharePoint both put a list on
 * the clipboard as a flat run with the level written on each item. A deeper level goes into the last
 * item of the list above it (a skipped level nests one step, not two); a different kind or a
 * different source list on the same level starts a new list; a numbered list that does not begin at
 * 1 gets `start`. `content` moves the item's content out of the source into the new `<li>`.
 */
export function buildNestedLists<Item extends FlatListItem>(
  items: readonly Item[],
  content: (item: Item) => Node[],
  document: Document
): DocumentFragment {
  const root = document.createDocumentFragment();
  const stack: { level: number; kind: "ul" | "ol"; id: string | null; list: HTMLElement }[] = [];
  for (const item of items) {
    while (stack.length > 0 && stack.at(-1)!.level > item.level) stack.pop();
    const top = stack.at(-1);
    if (top && top.level === item.level && (top.kind !== item.kind || top.id !== item.id)) {
      stack.pop();
    }
    if (stack.length === 0 || stack.at(-1)!.level < item.level) {
      const list = document.createElement(item.kind);
      if (item.number !== null && item.number > 1) list.setAttribute("start", String(item.number));
      (stack.at(-1)?.list.lastElementChild ?? root).appendChild(list);
      stack.push({ level: item.level, kind: item.kind, id: item.id, list });
    }
    const li = document.createElement("li");
    li.append(...content(item));
    stack.at(-1)!.list.append(li);
  }
  return root;
}
