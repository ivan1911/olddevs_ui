"use client";

/**
 * Hides everything outside a node from assistive technology, and gives it back.
 *
 * A layer that says `aria-modal="true"` promises that the page behind it is not for reading. Radix
 * keeps that promise for its modal `Dialog` with the `aria-hidden` package, which is not a dependency
 * of the kit; this is the same device in the small. Radix's non-modal dialog, which the fullscreen
 * layer of the Editor is built on, does not do it at all.
 *
 * Along the path from the node to `<body>`, every sibling gets `aria-hidden="true"`. That covers the
 * app's root and, inside a `Dialog`, the window's own portal. It is a snapshot: a node added later (a
 * popover, a tooltip, a toast) is not hidden, and that is wanted for the popovers the layer opens. What
 * is skipped: a node that is already hidden (it stays as it was, and is not restored by us), a live
 * region (a toast or a status line must stay audible), and `script` and `style`.
 *
 * Returns the function that restores exactly what was changed. Calling it twice does nothing.
 */
export function hideOthers(target: HTMLElement): () => void {
  const hidden: HTMLElement[] = [];
  const body = target.ownerDocument.body;
  for (let node: HTMLElement | null = target; node && node !== body; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.getAttribute("aria-hidden") === "true") continue;
      if (/^(SCRIPT|STYLE)$/.test(sibling.tagName)) continue;
      if (sibling.hasAttribute("aria-live") || sibling.matches('[role="status"], [role="alert"]')) {
        continue;
      }
      sibling.setAttribute("aria-hidden", "true");
      hidden.push(sibling);
    }
  }
  return () => {
    for (const element of hidden.splice(0)) element.removeAttribute("aria-hidden");
  };
}
