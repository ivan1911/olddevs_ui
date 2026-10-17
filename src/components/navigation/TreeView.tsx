"use client";

import type { ReactNode } from "react";
import {
  Button,
  Collection,
  Tree,
  TreeItem,
  TreeItemContent,
  type Key,
  type Selection,
} from "react-aria-components";
import { ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Checkbox } from "../inputs/Checkbox.js";

/**
 * Sets or removes `aria-current` on the tree row that contains `inside`.
 *
 * Done by hand, because `TreeItem` filters its props: only `data-*` and a pair of named `aria-*`
 * attributes reach the markup, and `aria-current` is silently dropped. Writing
 * `aria-current="page"` in JSX would look like it works and do nothing. The attribute is outside
 * the set that React owns on this row, so re-rendering does not erase it.
 *
 * It is called from the ref of the row's content, not from the ref of the row itself. react-aria
 * owns the row itself, and the ref on `TreeItem` is called once at mount, so changing the current
 * node would never call it. The content, however, re-renders together with `activeKey`, and an
 * inline ref is called on every re-render.
 */
function markCurrent(inside: HTMLElement | null, current: boolean) {
  const row = inside?.closest('[role="row"]');
  if (!row) return;
  if (current) row.setAttribute("aria-current", "page");
  else row.removeAttribute("aria-current");
}

export interface TreeNode {
  /** Unique node key. Expansion, selection, and `onAction` all work by it. */
  id: Key;
  /** Node label. It can be markup, in which case set `textValue`. */
  label: ReactNode;
  /**
   * String form of the node. Keyboard type-ahead search works by it. Required when `label` is not
   * a string.
   */
  textValue?: string;
  /** Icon to the left of the label. */
  icon?: ReactNode;
  /** Child nodes. If there are any, the node gets an expand button. */
  children?: TreeNode[];
  /** Blocks the node: it cannot be selected or activated. */
  disabled?: boolean;
}

export interface TreeViewProps {
  /** Top-level nodes. Nesting is set by the `children` field. */
  items: TreeNode[];
  /**
   * Accessible name of the tree. Required: an unnamed tree is announced by its role alone.
   */
  "aria-label": string;
  /**
   * Expanded nodes. The tree does not store them, just as a table does not store sorting and
   * selection.
   */
  expandedKeys?: Iterable<Key>;
  /** Called with the new set of expanded nodes after expanding or collapsing. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** Expanded on first render. After that, the state is managed by react-aria. */
  defaultExpandedKeys?: Iterable<Key>;
  /**
   * Selection mode. It is enabled by the presence of this prop: without it there are no checkboxes
   * and no `aria-selected` in the markup. This is the same rule as for `Table`.
   */
  selectionMode?: "single" | "multiple";
  /** Selected nodes (controlled value). Applies when `selectionMode` is set. */
  selectedKeys?: Selection;
  /** Called with the new set of selected nodes. */
  onSelectionChange?: (keys: Selection) => void;
  /** Keys of disabled nodes. Applies together with the `disabled` field of the nodes themselves. */
  disabledKeys?: Iterable<Key>;
  /**
   * Current navigation node: the key of the node whose page is open. The node gets
   * `aria-current="page"` and a visible background.
   *
   * This is not a selection: there are no checkboxes and no `aria-selected`, and `selectionMode`
   * does not need to be set. The name follows the kit's vocabulary. `active` is taken by the
   * current navigation item, and there are no items here, only keys, as with `selectedKeys` and
   * `expandedKeys`. The tree does not move the "current" marker itself. The consumer's route does
   * that.
   */
  activeKey?: Key;
  /**
   * Action on a node: navigation, opening a card. It is not a selection.
   *
   * For a folder row, the action does NOT expand it: the chevron and the right arrow expand it.
   * Expanding on click is the job of the consumer's `onAction`.
   */
  onAction?: (id: Key) => void;
  /** What to show when there are no nodes. If not set, the tree stays empty. */
  emptyText?: ReactNode;
  /** Extra classes on the tree root. */
  className?: string;
}

/**
 * Tree: a hierarchy with expansion, selection, and keyboard support.
 *
 * THE BEHAVIOR COMES ENTIRELY FROM `Tree` IN react-aria (ADR-0005), and that is why the tree can be
 * written at all without a requesting screen. Roles, `aria-expanded`, `aria-level`,
 * `aria-posinset`, arrows, Home and End, and type-ahead search all come from there. Only the node
 * markup and the tokens are written by hand here. In 1.21 the component graduated from
 * `UNSTABLE_`, so there is no prefix.
 *
 * THE ROLE IS `treegrid`, NOT `tree`, AND NODES ARE DECLARED AS `row`. This is react-aria's
 * decision, and a justified one: the row holds an expand button and a checkbox, and a `treeitem`
 * does not allow a second interactive element inside it. We do not override the roles by hand. The
 * keyboard from the behavior layer would then stop matching the declared markup.
 *
 * STATE IS NOT KEPT BY THE TREE. The rule is the same as for `Table`: expanded and selected nodes
 * arrive as sets, and `defaultExpandedKeys` is managed by react-aria, not by us. `useTreeData` is
 * NOT re-exported: it is a store, and the kit does not own state (ADR-0023). Whoever needs a
 * ready-made one takes it from `react-aria-components` directly. That is then their choice, not one
 * imposed by the kit.
 *
 * The selection mode is enabled by `selectionMode`. Without it there are no checkboxes at all: a
 * category tree that is only browsed should not carry a selection column.
 *
 * THE CURRENT NODE IS A SEPARATE AXIS FROM SELECTION. `activeKey` sets `aria-current="page"` on the
 * row and the background, and draws no checkboxes. A tree of articles that is browsed shows "you
 * are here", not a set of checked items. The `dependencies` on the root are needed because
 * react-aria caches rows by `items`. If only the key changed, the mark would stay on the old row.
 *
 * Expand button names do NOT repeat the node label. react-aria appends the label itself, so
 * "Expand Nature" would read as "Expand Nature Nature". That is the same defect the wave 18 review
 * found in `TagInput` and `FilterBar`.
 */
export function TreeView({
  items,
  expandedKeys,
  onExpandedChange,
  defaultExpandedKeys,
  selectionMode,
  selectedKeys,
  onSelectionChange,
  disabledKeys,
  activeKey,
  onAction,
  emptyText,
  className,
  ...rest
}: TreeViewProps) {
  const messages = useMessages();

  const renderNode = (node: TreeNode) => {
    const current = activeKey != null && node.id === activeKey;
    return (
      <TreeItem
        id={node.id}
        textValue={
          node.textValue ?? (typeof node.label === "string" ? node.label : String(node.id))
        }
        isDisabled={node.disabled}
        className="outline-none [--tree-indent:1.25rem]"
      >
        <TreeItemContent>
          {({ isExpanded, hasChildItems, isSelected, isDisabled }) => {
            // Dimming is applied to the chevron, the icon, and the label separately, not to the
            // whole `div`. The selection checkbox gets the block from the row itself and is dimmed
            // by its own `disabled:opacity-50`, so dimming the whole row would dim it twice: 25%
            // instead of 50%.
            const dim = isDisabled && "opacity-50";
            return (
              <div
                ref={(content) => markCurrent(content, current)}
                className={cn(
                  "text-fg-1 flex items-center gap-2 rounded-xs py-1.5 pr-2 text-[13px] leading-5",
                  // The selected and disabled states come from the render prop, not from the
                  // `selected:` and `disabled:` variants. react-aria sets `data-selected` and
                  // `data-disabled` on the row (`row`), but the content is what gets painted. A
                  // variant on the content never matched, so a selected node was not highlighted
                  // and a disabled one was not dimmed. This is the same case as the chevron in
                  // `Accordion`.
                  //
                  // Dimming is not applied to the whole `div` but to its parts (see `dim` below).
                  //
                  // The current node gets a background and a font weight, as `NavItem` does with
                  // `active`. It comes BEFORE selection: `cn` keeps the last background, so a node
                  // that is both current and selected shows the selection background, as it did
                  // before, when the order was decided by the cascade of variants.
                  current && "bg-bg-3 text-fg-0 font-semibold",
                  isSelected ? "bg-accent-soft text-fg-0" : !isDisabled && "hover:bg-bg-2",
                  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2"
                )}
                // react-aria puts the nesting level in `--tree-item-level` on the row, so we do not
                // compute the depth ourselves. Otherwise we would have a second copy of the same
                // number.
                style={{
                  paddingLeft: "calc((var(--tree-item-level) - 1) * var(--tree-indent) + 0.25rem)",
                }}
              >
                {hasChildItems ? (
                  <Button
                    slot="chevron"
                    aria-label={isExpanded ? messages.treeView.collapse : messages.treeView.expand}
                    className={cn(
                      "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs",
                      "transition-colors",
                      dim,
                      "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
                    )}
                  >
                    <ChevronRightIcon
                      size={14}
                      aria-hidden
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </Button>
                ) : (
                  // The expander slot is always reserved. Without it, the leaf labels would not
                  // line up with the labels of nodes at the same level.
                  <span aria-hidden className="w-[14px] shrink-0" />
                )}
                {selectionMode ? (
                  <Checkbox slot="selection" label={messages.treeView.select} />
                ) : null}
                {node.icon != null && (
                  <span className={cn("text-fg-3 flex shrink-0 items-center", dim)}>
                    {node.icon}
                  </span>
                )}
                <span className={cn("min-w-0 truncate", dim)}>{node.label}</span>
              </div>
            );
          }}
        </TreeItemContent>
        {node.children != null && node.children.length > 0 ? (
          <Collection items={node.children}>{renderNode}</Collection>
        ) : null}
      </TreeItem>
    );
  };

  return (
    <Tree
      aria-label={rest["aria-label"]}
      items={items}
      dependencies={[activeKey]}
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedChange}
      defaultExpandedKeys={defaultExpandedKeys}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      disabledKeys={disabledKeys}
      onAction={onAction}
      renderEmptyState={emptyText != null ? () => emptyText : undefined}
      className={cn("flex flex-col gap-0.5 outline-none", className)}
    >
      {renderNode}
    </Tree>
  );
}
