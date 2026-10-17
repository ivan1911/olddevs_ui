/**
 * Overlay layers: the stack, the mark of a foreign layer, and the z-index scale.
 *
 * The only place where the kit knows about the order of overlays. The decision and the analysis
 * of the alternatives are in ADR-0041.
 *
 * The task exists because the kit builds overlays on TWO libraries at once: `Dialog`, `Drawer`,
 * `ContextMenu`, `Popover`, `Tooltip` and `CommandPalette` are on Radix, while `Menu`, `Select`,
 * `Combobox` and `TreeSelect` are on react-aria-components. Each keeps its own stack and knows
 * nothing about the other. Before wave 26, the decision "which one is on top" was made four times
 * in four files, each time from scratch and each time only partially.
 *
 * The module does NOT wrap Radix and does not replace its stack: within its own library, Radix
 * handles it by itself, and nested Radix dialogs were closing correctly before this. It solves
 * exactly the seam between the two libraries.
 */

/**
 * The stack of the kit's open layers.
 *
 * Module-level, for the same reason as the counter in `useScrollLock`: layers nest, and "which
 * one is on top" cannot be expressed with local state. It also follows that there must be
 * exactly one copy of the module in the application.
 */
const layers = new Set<{ node: HTMLElement | null }>();

/**
 * Registers a layer.
 *
 * THE TOP ONE IS DETERMINED BY POSITION IN THE DOCUMENT, not by the order of registration, and
 * this is not pedantry. React runs effects child-first: for nested scrims, the inner one registers
 * before the outer one. So "the last one registered" turned out to be the OUTER one, that is, the
 * one lying under all the others was taken as the topmost. The mount order says nothing about the
 * order of layers.
 *
 * Position does. A nested node always follows its ancestor in document order, and two independent
 * overlays go in the order in which they were inserted. So the top one is the one that no other
 * registered node follows.
 */
export function pushOverlayLayer(): {
  isTopmost: () => boolean;
  attach: (node: HTMLElement | null) => void;
  release: () => void;
} {
  const entry: { node: HTMLElement | null } = { node: null };
  layers.add(entry);

  return {
    attach: (node) => {
      entry.node = node;
    },
    isTopmost: () => {
      // The node does not exist yet: the layer registered last, and that is all that is known
      // about it. Treating it as lower would hand Escape to whoever was opened earlier.
      if (!entry.node?.isConnected) return true;
      for (const other of layers) {
        // A detached node cannot take part in the comparison: for a node from another tree,
        // `compareDocumentPosition` returns `DISCONNECTED` together with an arbitrary
        // `PRECEDING`/`FOLLOWING`. The specification itself calls this choice "consistent, but
        // arbitrary". A layer whose node React has already removed, but whose cleanup has not
        // yet run, declared no one topmost.
        if (other === entry || !other.node?.isConnected) continue;
        const position = entry.node.compareDocumentPosition(other.node);
        // `CONTAINED_BY` comes together with `FOLLOWING`, so one check covers both nesting
        // and siblings.
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return false;
      }
      return true;
    },
    release: () => {
      layers.delete(entry);
    },
  };
}

/** How many layers are currently registered. @internal For the test suite. */
export function layerCount(): number {
  return layers.size;
}

/**
 * The mark of a positioned react-aria overlay.
 *
 * A PAIR of attributes, `data-rac` + `data-placement`. Only a positioned RAC overlay sets it
 * (`Popover` and everything built on it: `Combobox` lists, `Menu` panels). No Radix node has it,
 * and neither do the kit's fields inside a dialog.
 *
 * Two places read the selector, and both are about the seam between the libraries:
 * `hasOpenAriaOverlay` below and the pointer rule in `styles.css`.
 *
 * THE POINTER IS THE FOURTH THING AT THE SEAM, after the stack, Escape and the scale. A modal Radix
 * component (`Dialog`, `Drawer`) sets an inline `pointer-events: none` on `<body>` and gives the
 * pointer back only to its OWN layers, also with an inline `auto`. A react-aria overlay is portaled
 * directly under `<body>` and inherited `none`, so clicks fell through to the scrim: a menu item and
 * a list option inside the dialog could only be selected from the keyboard. For the RAC overlay, the
 * kit does what Radix does for its own: it gives it back `auto`.
 *
 * The rule lives in CSS, not in a class on the kit's panels, because the consumer also draws its own
 * react-aria overlays: its popover broke the same way, and the kit's class does not reach it. A click
 * into the portal does not close the dialog, though: Radix decides "click outside" by the React tree,
 * and the portal remains its descendant. The link between the selector and `styles.css` is guarded by
 * `tests/overlay-layers.test.tsx`.
 */
export const ARIA_OVERLAY_SELECTOR = "[data-rac][data-placement]";

/**
 * Whether a react-aria overlay is open above us, by `ARIA_OVERLAY_SELECTOR`.
 *
 * The former guard in `Dialog` identified a foreign layer by the POSITION OF THE EVENT TARGET:
 * "`data-rac` and outside the window". That worked for menus, but not for a `Combobox` inside the
 * dialog: focus sits in an `Input` that is INSIDE the content, so the second condition was false.
 * Escape closed the dialog instead of the suggestion list.
 *
 * Relying on the library's internal attributes is a deliberate risk (ADR-0041). A test on the
 * combination of `Combobox` inside `Dialog` guards it: it breaks when the RAC markup changes, which
 * is better than a silent return of the defect.
 */
export function hasOpenAriaOverlay(): boolean {
  if (typeof document === "undefined") return false;
  /*
    A TOOLTIP IS NOT A LAYER, and this is not nitpicking.

    The react-aria `Tooltip` carries the same `data-rac` + `data-placement` pair as a list or a menu,
    but it does not take focus and does not close when a window opens. While the pointer rests on the
    "?" trigger, the tooltip hangs there, and Escape stopped closing the dialog AT ALL. The kit's own
    `Tooltip` is on Radix, so this did not fire from inside the package. But react-aria tooltips are
    drawn by the consumer too, and such a tooltip anywhere on the page prevented Escape from closing
    any of the kit's dialogs.

    We ask about a layer that will consume Escape itself, not about any RAC overlay.
  */
  return document.querySelector(`${ARIA_OVERLAY_SELECTOR}:not([role="tooltip"])`) != null;
}

/**
 * Layer steps.
 *
 * The numbers stop being literals in six files and become named steps in one place. The order is
 * meaningful: the scrim is below the menu panel, and the panel is below the tooltip. One large
 * number for all of them is not a scale but a capitulation (ADR-0041).
 *
 * THE SCALE AND THE DOCUMENT ORDER ARE DIFFERENT AXES. `isTopmost` judges strictly by position in the
 * document, and the two coincide only while all layers share one step. The `zIndex` prop of
 * `ModalOverlay` lets them diverge: a scrim on `alert` above a scrim on `modal` is visible on top, but
 * in the document it may come earlier, and then Escape will not go to it. Mixing steps among nested
 * scrims is not advisable. If it becomes necessary, the comparison has to be made by the pair "step, position".
 */
export const OVERLAY_LAYER = {
  /** The modal scrim and the dialog on top of it. */
  modal: "z-90",
  /** A layer above the modal one: a confirmation above the dialog that opened it. */
  alert: "z-100",
  /** Popups: menus, popovers, lists. Above the dialog, because they are opened from it. */
  popover: "z-[120]",
} as const;
