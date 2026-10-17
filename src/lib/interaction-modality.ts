/**
 * Input modality: how the user arrived at focus.
 *
 * Why. `:focus-visible` answers the question "should the ring be drawn", not "who moved the focus".
 * The keyboard moves focus, and so does a screen reader (VoiceOver and TalkBack swipes, NVDA's and
 * JAWS's virtual cursor). The page gets neither a key nor a pointer; focus simply appears. For the
 * ring this is correct. For content that pops up without being announced (`HoverCard`) it is not:
 * the content would appear under a screen reader out of nowhere, and with a screen magnifier it
 * would also cover the neighboring text.
 *
 * Three values:
 * - `keyboard`: focus arrived while a navigation key was pressed;
 * - `pointer`: the focus was preceded by a press of a mouse, a pen or a finger;
 * - `virtual`: focus arrived, and neither of the two came before it.
 *
 * The logic is the same as `useFocusVisible` in react-aria, and the definition of virtual modality
 * comes from there too. But it is our own: this is a private export of the package, which the kit
 * does not declare as a dependency (ADR-0004), and public behavior cannot be risked for the sake of
 * an unsupported path. The module knows nothing about React and renders nothing.
 *
 * The listeners are attached once and lazily, on the first `trackInteractionModality()` call and
 * not on import, so server code and a component that does not need modality pay nothing. They need
 * not be removed: eight passive listeners on the page are cheaper than a subscriber counter and a
 * race of "removed, then immediately re-added".
 */
export type InteractionModality = "keyboard" | "pointer" | "virtual";

/**
 * Keys that move focus. Enter, Space, letters and Escape are not in the list: they do not move
 * focus, and when the program moves it after them (a dialog closed and focus returned to a button),
 * a hover card has no reason to open.
 */
const NAVIGATION_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

let installed = false;
let current: InteractionModality = "virtual";
/**
 * The event that explains focus. A key lives from keydown to keyup. During that time focus can
 * arrive more than once (Tab landed on a wrapper, and the wrapper passed it inward), and all of
 * those focuses come from the key. After keyup the key explains nothing: a screen reader swipe
 * after a long-ago Tab must not count as keyboard. A press does explain the programmatic focus
 * that follows it (a click handler returns focus to the trigger); that is a continuation of the press.
 */
let pending: "keyboard" | "pointer" | null = null;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

function onKeyDown(event: KeyboardEvent) {
  // The modifier keys themselves are part of a Shift+Tab chord, not a separate press.
  if (MODIFIER_KEYS.has(event.key)) return;
  // With Meta or Ctrl, Tab switches browser tabs, not focus.
  // Alt is allowed only with Tab: the OS does not show Alt+Tab to the page, while Option+Tab in
  // Safari on macOS is the only way to reach links from the keyboard.
  const blocked = event.metaKey || event.ctrlKey || (event.altKey && event.key !== "Tab");
  if (blocked || !NAVIGATION_KEYS.has(event.key)) {
    // Another key (Enter, a letter, Escape) is not navigation: focus that the program
    // sets after it does not count as keyboard.
    if (pending === "keyboard") pending = null;
    return;
  }
  pending = "keyboard";
  current = "keyboard";
}

function onKeyUp() {
  // Focus from a key arrives on keydown. A released key no longer explains focus: the next
  // focus is no longer its own, for example a screen reader swipe.
  if (pending === "keyboard") pending = null;
}

function onPointerDown() {
  pending = "pointer";
  current = "pointer";
}

/**
 * We listen to `focusin`, not `focus`. React builds `onFocus` on `focusin`, and a listener on
 * `document` in the capture phase fires before React's handler, whatever the browser's order of
 * these two events is.
 */
function onFocusIn() {
  current = pending ?? "virtual";
}

/**
 * The window lost or regained focus. When it regains focus, the browser puts it back on the
 * previously focused element without a key or a pointer. The previous modality is stale here,
 * so this focus cannot be counted as keyboard.
 */
function onWindowFocusChange() {
  pending = null;
  current = "virtual";
}

/**
 * Attaches the listeners if they are not attached yet. Safe to call any number of times, and on
 * the server, where it is an empty function. Call it BEFORE the focus you are about to classify:
 * an event that has already passed cannot be read after the fact.
 */
export function trackInteractionModality(): void {
  if (installed || typeof document === "undefined" || typeof window === "undefined") return;
  installed = true;
  const options = { capture: true, passive: true } as const;
  document.addEventListener("keydown", onKeyDown, options);
  document.addEventListener("keyup", onKeyUp, options);
  document.addEventListener("pointerdown", onPointerDown, options);
  // Older browsers without Pointer Events, and mouse emulation after a touch.
  document.addEventListener("mousedown", onPointerDown, options);
  document.addEventListener("touchstart", onPointerDown, options);
  document.addEventListener("focusin", onFocusIn, options);
  window.addEventListener("blur", onWindowFocusChange);
  window.addEventListener("focus", onWindowFocusChange);
}

/**
 * The modality of the last focus (in `onFocus`, the one that has just arrived).
 * Before the first event and before `trackInteractionModality()` it is `virtual`: there is no
 * evidence of a key, and it is safer to err on the side of "do not open".
 */
export function getInteractionModality(): InteractionModality {
  return current;
}
