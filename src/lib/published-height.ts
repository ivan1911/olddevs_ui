"use client";

import { useEffect, type RefObject } from "react";

/*
 * Publishes a panel's height to a CSS variable on the document root (ADR-0016,
 * ADR-0019). It used to live inside `TopBar`. It was moved out when the bottom panel got the
 * same role through the `bottomBar` slot of `AppShell` (`--bottombar-h`). The registry is
 * shared and keyed by the variable name, so two panels with different names do not interfere
 * with each other, while panels with one name share ownership by stack order.
 */

/**
 * Who currently owns the height variable.
 *
 * The registry is module-level, for the same reason as the counter in `useScrollLock`: the
 * headers OVERLAP. When navigating between screens, the new one mounts before the old one
 * unmounts. The same happens with the application's header plus the header of an embedded
 * widget that uses the same variable name.
 *
 * OWNERSHIP IS BY IDENTITY, NOT BY VALUE, and this is the analysis of a defect, not a matter of
 * taste. The cleanup compared the published value with the value in the root's style. But two
 * headers of the same component produce the SAME height, so by value they cannot be told apart:
 * the header that was leaving removed the variable that the remaining one had just published,
 * and the sticky bars drifted to the top of the window.
 *
 * (Before wave 26 the defect was not visible, for another reason: the cleanup re-measured
 * `offsetHeight` of an already detached node, got zero, and the removal branch never ran. The
 * variable simply outlived the header.)
 *
 * Only the last one registered writes to the root. A header that is leaving hands publishing
 * over to the previous one, and the last one removes the variable.
 */
const heightOwners = new Map<string, { token: symbol; value: string }[]>();

/**
 * What was in the variable BEFORE the first header.
 *
 * The application itself may publish a height too. The kit is not the only one entitled to
 * write to this variable (ADR-0016: the variable name is a prop here precisely because the kit
 * does not know whose header it is). A header that leaves restores the previous value rather
 * than erasing someone else's.
 */
const heightBeforeFirstOwner = new Map<string, string>();

export function publishHeight(heightVar: string) {
  const token = Symbol("published-height");
  const stack = heightOwners.get(heightVar) ?? [];
  if (stack.length === 0) {
    heightBeforeFirstOwner.set(
      heightVar,
      document.documentElement.style.getPropertyValue(heightVar)
    );
  }
  stack.push({ token, value: "" });
  heightOwners.set(heightVar, stack);

  return {
    publish(value: string, root: HTMLElement) {
      const owners = heightOwners.get(heightVar);
      const own = owners?.find((entry) => entry.token === token);
      if (!own || !owners) return;
      own.value = value;
      // We do not overwrite someone else's publication: the top of the stack is whoever was
      // mounted last, and the variable belongs to it.
      if (owners.at(-1)?.token === token) root.style.setProperty(heightVar, value);
    },
    release(root: HTMLElement) {
      const owners = heightOwners.get(heightVar);
      if (!owners) return;
      const own = owners.find((entry) => entry.token === token);
      const rest = owners.filter((entry) => entry.token !== token);

      /*
        We do not touch someone else's record. Stack ownership answers the question of which
        HEADER is on top, but the variable can be rewritten by something other than a header:
        the application, a widget, a debug script. If the root holds something other than what
        we published, the owner changed outside the registry, and that value must not be removed.
      */
      const inDom = root.style.getPropertyValue(heightVar);
      if (own && inDom !== own.value) {
        // The check runs BEFORE any branch. Under the condition "I am the last one", it skipped
        // the case with three participants: a header that was not the last one was leaving, and
        // the registry unconditionally overwrote the variable with the next owner's value, so
        // someone else's record was silently lost.
        heightOwners.set(heightVar, rest);
        if (rest.length === 0) {
          heightOwners.delete(heightVar);
          heightBeforeFirstOwner.delete(heightVar);
        }
        return;
      }

      if (rest.length === 0) {
        heightOwners.delete(heightVar);
        const before = heightBeforeFirstOwner.get(heightVar) ?? "";
        heightBeforeFirstOwner.delete(heightVar);
        // A variable left behind would make the sticky bars offset from an element that no
        // longer exists. But if the application published the value, we restore it rather
        // than erase it.
        if (before) root.style.setProperty(heightVar, before);
        else root.style.removeProperty(heightVar);
        return;
      }

      heightOwners.set(heightVar, rest);
      const next = rest.at(-1)!;
      if (next.value) root.style.setProperty(heightVar, next.value);
    },
  };
}

/**
 * Publishes the measured height of the node to a variable on the document root and keeps it
 * current: a measurement on mount plus a `ResizeObserver`. The height changes with the
 * breakpoint (the panel is hidden by a class, and then it is 0), with content wrapping, and
 * with the screen notch.
 *
 * `heightVar === null` disables publishing. `enabled = false` means the node is not in the
 * markup right now (the slot is not passed), so the variable must not exist at all.
 */
export function usePublishedHeight(
  ref: RefObject<HTMLElement | null>,
  heightVar: string | null,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || heightVar == null || !enabled) return;

    const root = document.documentElement;
    const token = publishHeight(heightVar);
    const apply = () => token.publish(`${el.offsetHeight}px`, root);
    apply();

    // In an environment without `ResizeObserver` (the consumer's test jsdom, an old engine),
    // only the measurement on mount remains. The code must not fail because of the observer:
    // the `bottomBar` slot is now measured in every AppShell.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      token.release(root);
    };
  }, [ref, heightVar, enabled]);
}
