"use client";

/**
 * Hides everything outside a node from assistive technology and from the keyboard, and gives it back.
 *
 * A layer that says `aria-modal="true"` promises that the page behind it is not for reading, and a
 * layer over the whole window must not let `Tab` walk into that page either. Radix keeps the first
 * promise for its modal `Dialog` with the `aria-hidden` package, which is not a dependency of the kit;
 * this is the same device in the small. Radix's non-modal dialog, which the fullscreen layer of the
 * Editor is built on, does neither.
 *
 * Along the path from the node to `<body>`, every sibling gets `aria-hidden="true"` and `inert`. That
 * covers the app's root and, inside a `Dialog`, the window's own portal. `inert` is what keeps focus
 * out: the focus loop of the layer handles `Tab` only while focus is inside it, and from `<body>` (after
 * a click on a bare patch of the layer) the next `Tab` would go to the first control of the page. For an
 * engine without `inert`, a `focusin` guard sends focus that lands in the hidden page back to where it
 * was in the node.
 *
 * It is a snapshot: a node added later (a popover, a tooltip, a toast) is not hidden, and that is
 * wanted for the popovers the layer opens. What is skipped: a live region (a toast or a status line
 * must stay audible and reachable), and `script` and `style`. What is already `aria-hidden` or `inert`
 * keeps that attribute as it was, and is not restored by us.
 *
 * Returns the function that restores exactly what was changed. Calling it twice does nothing.
 */
export function hideOthers(target: HTMLElement): () => void {
  const hidden: { element: HTMLElement; ariaHidden: boolean; inert: boolean }[] = [];
  const doc = target.ownerDocument;
  for (
    let node: HTMLElement | null = target;
    node && node !== doc.body;
    node = node.parentElement
  ) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (/^(SCRIPT|STYLE)$/.test(sibling.tagName)) continue;
      if (sibling.hasAttribute("aria-live") || sibling.matches('[role="status"], [role="alert"]')) {
        continue;
      }
      const ariaHidden = sibling.getAttribute("aria-hidden") !== "true";
      const inert = !sibling.hasAttribute("inert");
      if (ariaHidden) sibling.setAttribute("aria-hidden", "true");
      if (inert) sibling.setAttribute("inert", "");
      if (ariaHidden || inert) hidden.push({ element: sibling, ariaHidden, inert });
    }
  }

  let lastInside: Element | null = null;
  // Radix puts two invisible tab stops at the ends of `<body>` for its dialogs; they are not in the layer either.
  const isInHiddenPage = (reached: Node) =>
    hidden.some(({ element }) => element.contains(reached)) ||
    (reached instanceof HTMLElement && reached.hasAttribute("data-radix-focus-guard"));
  const onFocusIn = (event: FocusEvent) => {
    const reached = event.target;
    if (!(reached instanceof Node)) return;
    if (target.contains(reached)) {
      lastInside = reached as Element;
    } else if (isInHiddenPage(reached)) {
      const back =
        lastInside instanceof HTMLElement && lastInside.isConnected ? lastInside : target;
      back.focus({ preventScroll: true });
    }
  };
  doc.addEventListener("focusin", onFocusIn);

  return () => {
    doc.removeEventListener("focusin", onFocusIn);
    for (const { element, ariaHidden, inert } of hidden.splice(0)) {
      if (ariaHidden) element.removeAttribute("aria-hidden");
      if (inert) element.removeAttribute("inert");
    }
  };
}
