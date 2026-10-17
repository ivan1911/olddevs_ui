// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  type HoverCardProps,
} from "../src/components/overlays/HoverCard.js";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { OVERLAY_LAYER } from "../src/lib/overlay-layer.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // The card's behavior must not leak between tests through the touch stub.
  Reflect.deleteProperty(window, "matchMedia");
  // The modality tracker is global: when the window loses focus, it drops an
  // undelivered event, so one test's key does not count as the next test's key.
  fireEvent.blur(window);
});

/*
  No user-event: its `asyncWrapper` in Testing Library waits for a real
  `setTimeout`, and under `vi.useFakeTimers` it never fires, so the test hangs
  until the timeout. Events are dispatched directly, and time is moved by `tick`.
*/
const hover = (element: Element) =>
  act(() => {
    fireEvent.pointerEnter(element, { pointerType: "mouse" });
  });
const unhover = (element: Element) =>
  act(() => {
    fireEvent.pointerLeave(element, { pointerType: "mouse" });
  });

/*
  The card opens only on focus that came from a key: the input modality is read
  from `lib/interaction-modality` (listeners on `document`). The tests reproduce
  the browser's event chain: a key or a press, then focus. Focus without a
  preceding event is the virtual modality (a screen reader).
*/
const pressTab = () => {
  act(() => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    trigger().focus();
    fireEvent.keyUp(document.body);
  });
};
/** A press with the mouse or a finger: a pointer event, then focus from it. */
const mouseFocus = () => {
  act(() => {
    fireEvent.pointerDown(trigger(), { pointerType: "mouse" });
    trigger().focus();
  });
};
/** Focus without a key or a pointer: this is how a VoiceOver or TalkBack swipe sets it. */
const virtualFocus = () => act(() => trigger().focus());
const escape = () =>
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

function Host(props: Partial<HoverCardProps> & { onTriggerClick?: () => void }) {
  const { onTriggerClick, ...root } = props;
  return (
    <HoverCard {...root}>
      <HoverCardTrigger asChild>
        <a href="#profile" onClick={onTriggerClick}>
          Ada Lovelace
        </a>
      </HoverCardTrigger>
      <HoverCardContent>
        <p>Mathematician, first programmer</p>
      </HoverCardContent>
    </HoverCard>
  );
}

const trigger = () => screen.getByRole("link", { name: "Ada Lovelace" });
const card = () => screen.queryByText("Mathematician, first programmer");

/** Time advances inside `act`: timers change React state. */
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Emulates a device without hover: `matchMedia("(hover: none)")` matches. */
function stubHoverNone() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query === "(hover: none)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as MediaQueryList
  );
  Object.defineProperty(window, "matchMedia", { value: globalThis.matchMedia, configurable: true });
}

describe("opening", () => {
  test("hover opens the card only after the open delay", async () => {
    render(<Host />);

    hover(trigger());
    expect(card()).toBeNull();

    tick(699);
    expect(card()).toBeNull();
    tick(1);
    expect(card()).not.toBeNull();
  });

  test("a quick fly-over does not open the card", async () => {
    render(<Host />);

    hover(trigger());
    tick(300);
    unhover(trigger());
    tick(2000);

    expect(card()).toBeNull();
  });

  test("keyboard focus on the trigger opens the card after the delay", async () => {
    render(<Host />);

    pressTab();
    expect(document.activeElement).toBe(trigger());
    expect(card()).toBeNull();

    tick(700);
    expect(card()).not.toBeNull();
  });

  test("focus that came from a click does not open the card", () => {
    render(<Host />);

    // A click on the link also focuses it; the card is not needed for an action
    // that is already done.
    mouseFocus();
    tick(5000);

    expect(card()).toBeNull();
  });

  test("focus with no key or pointer before it (a screen reader) does not open the card", () => {
    render(<Host />);

    // A VoiceOver or TalkBack swipe, or NVDA's virtual cursor: the page gets
    // neither a key nor a pointer, the focus just appears.
    virtualFocus();
    tick(5000);

    expect(document.activeElement).toBe(trigger());
    expect(card()).toBeNull();
  });

  test("a screen reader focus after an earlier Tab does not reuse the stale key", () => {
    render(
      <>
        <input aria-label="Search" />
        <Host />
      </>
    );
    const input = screen.getByRole("textbox", { name: "Search" });
    act(() => {
      fireEvent.keyDown(document.body, { key: "Tab" });
      input.focus();
      fireEvent.keyUp(document.body);
    });

    virtualFocus();
    tick(5000);

    expect(card()).toBeNull();
  });

  test("programmatic focus right after a click does not open the card", () => {
    render(<Host />);

    // A click handler moves focus in code (for example, returns it to the trigger
    // after a dialog closes): that is a continuation of the press, not a key.
    act(() => {
      fireEvent.pointerDown(document.body, { pointerType: "mouse" });
      trigger().focus();
    });
    tick(5000);

    expect(card()).toBeNull();
  });

  test("a key that does not move focus (Enter, a letter) is not a keyboard focus", () => {
    render(<Host />);

    act(() => {
      fireEvent.keyDown(document.body, { key: "Enter" });
      trigger().focus();
    });
    tick(5000);

    expect(card()).toBeNull();
  });

  test("Shift+Tab and arrow keys open the card like Tab", () => {
    render(<Host />);
    act(() => {
      fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
      trigger().focus();
      fireEvent.keyUp(document.body);
    });
    tick(700);
    expect(card()).not.toBeNull();
    act(() => trigger().blur());
    tick(300);
    expect(card()).toBeNull();

    act(() => {
      fireEvent.keyDown(document.body, { key: "ArrowRight" });
      trigger().focus();
      fireEvent.keyUp(document.body);
    });
    tick(700);
    expect(card()).not.toBeNull();
  });

  test("returning to the window with focus restored on the trigger does not open the card", () => {
    render(<Host />);
    pressTab();
    tick(700);
    act(() => trigger().blur());
    tick(300);
    expect(card()).toBeNull();

    // The user left the window and came back: the browser returns focus to the
    // link without a key. The earlier key must not count as the cause of this focus.
    act(() => {
      fireEvent.blur(window);
      fireEvent.focus(window);
    });
    virtualFocus();
    tick(5000);

    expect(card()).toBeNull();
  });

  test("focus stays on the trigger and does not move into the card", async () => {
    render(<Host />);

    pressTab();
    tick(700);

    expect(card()).not.toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("the delays are configurable", async () => {
    render(<Host openDelay={50} closeDelay={10} />);

    hover(trigger());
    tick(50);
    expect(card()).not.toBeNull();

    unhover(trigger());
    tick(10);
    expect(card()).toBeNull();
  });

  test("a zero open delay opens on the next timer turn, not never", async () => {
    render(<Host openDelay={0} />);

    hover(trigger());
    tick(0);

    expect(card()).not.toBeNull();
  });
});

describe("closing", () => {
  test("leaving the trigger closes the card after the close delay", async () => {
    render(<Host />);
    hover(trigger());
    tick(700);

    unhover(trigger());
    tick(299);
    expect(card()).not.toBeNull();
    tick(1);
    expect(card()).toBeNull();
  });

  test("moving the pointer onto the card keeps it open", async () => {
    render(<Host />);
    hover(trigger());
    tick(700);

    unhover(trigger());
    tick(100);
    hover(card()!);
    tick(5000);

    expect(card()).not.toBeNull();
  });

  test("leaving the card closes it after the close delay", async () => {
    render(<Host />);
    hover(trigger());
    tick(700);
    unhover(trigger());
    hover(card()!);

    unhover(card()!);
    tick(299);
    expect(card()).not.toBeNull();
    tick(1);
    expect(card()).toBeNull();
  });

  test("returning to the trigger before the delay ends keeps the card open", async () => {
    render(<Host />);
    hover(trigger());
    tick(700);

    unhover(trigger());
    tick(200);
    hover(trigger());
    tick(5000);

    expect(card()).not.toBeNull();
  });

  test("blur closes the card after the close delay", async () => {
    render(<Host />);
    pressTab();
    tick(700);

    // Focus goes to nothing, not to a neighboring element: this checks exactly the
    // deferred close on blur, without an immediate close on a click outside.
    act(() => trigger().blur());
    tick(300);

    expect(card()).toBeNull();
  });

  test("Escape closes the card immediately and focus stays on the trigger", async () => {
    render(<Host />);
    pressTab();
    tick(700);

    escape();

    expect(card()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("Escape closes a card opened by hover while focus is elsewhere", async () => {
    render(<Host />);
    hover(trigger());
    tick(700);

    escape();

    expect(card()).toBeNull();
  });
});

describe("focus", () => {
  test("closing from the pointer does not steal focus from elsewhere", () => {
    render(
      <>
        <input aria-label="Search" />
        <Host />
      </>
    );
    const input = screen.getByRole("textbox", { name: "Search" });
    act(() => input.focus());

    hover(trigger());
    tick(700);
    expect(card()).not.toBeNull();
    expect(document.activeElement).toBe(input);

    unhover(trigger());
    tick(300);
    expect(card()).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});

describe("state does not outlive the card", () => {
  test("a card closed with the pointer on it closes by hover again", () => {
    render(<Host />);
    hover(trigger());
    tick(700);
    unhover(trigger());
    hover(card()!);

    // Escape removes the panel from the document together with the pointer on it:
    // `pointerleave` will not come, and the "pointer on the card" flag would stay raised.
    escape();
    expect(card()).toBeNull();

    hover(trigger());
    tick(700);
    expect(card()).not.toBeNull();
    unhover(trigger());
    tick(300);
    expect(card()).toBeNull();
  });

  test("Escape with focus on the trigger does not pin the next hover-opened card", () => {
    render(<Host />);
    pressTab();
    tick(700);
    escape();
    expect(card()).toBeNull();

    hover(trigger());
    tick(700);
    expect(card()).not.toBeNull();
    // Focus is still on the link, but after closing it must not keep the card open.
    unhover(trigger());
    tick(300);
    expect(card()).toBeNull();
  });

  test("focusing the trigger while the card is open from hover keeps it open", () => {
    render(<Host />);
    hover(trigger());
    tick(700);
    expect(card()).not.toBeNull();

    pressTab();
    tick(2000);

    expect(card()).not.toBeNull();
  });
});

describe("the trigger keeps its own action", () => {
  test("a click on the trigger runs its handler", async () => {
    const onTriggerClick = vi.fn((event?: unknown) => void event);
    render(<Host onTriggerClick={() => onTriggerClick()} />);

    act(() => fireEvent.click(trigger()));

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
  });

  test("the trigger is not announced as a popup opener", () => {
    render(<Host />);

    // The card is a supplement, not a click popover: there is no `aria-haspopup`
    // or `aria-expanded` on the link, or the screen reader would promise a menu.
    expect(trigger().getAttribute("aria-haspopup")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBeNull();
  });

  test("the trigger reports its state for styling", async () => {
    render(<Host />);
    expect(trigger().getAttribute("data-state")).toBe("closed");

    hover(trigger());
    tick(700);

    expect(trigger().getAttribute("data-state")).toBe("open");
  });
});

describe("devices without hover", () => {
  test("a touch pointer does not open the card", () => {
    render(<Host />);

    fireEvent.pointerEnter(trigger(), { pointerType: "touch" });
    tick(5000);

    expect(card()).toBeNull();
  });

  test("when (hover: none) matches, hover does not open the card", async () => {
    stubHoverNone();
    render(<Host />);

    hover(trigger());
    tick(5000);

    expect(card()).toBeNull();
  });

  test("when (hover: none) matches, keyboard focus still opens the card (tablet with a keyboard)", async () => {
    stubHoverNone();
    render(<Host />);

    pressTab();
    tick(699);
    expect(card()).toBeNull();
    tick(1);

    expect(card()).not.toBeNull();
  });

  test("when (hover: none) matches, focus that came from a tap does not open the card", async () => {
    stubHoverNone();
    render(<Host />);

    // A touch sets focus, but not with a key, just like a mouse click.
    fireEvent.pointerEnter(trigger(), { pointerType: "touch" });
    act(() => {
      fireEvent.pointerDown(trigger(), { pointerType: "touch" });
      trigger().focus();
    });
    tick(5000);

    expect(card()).toBeNull();
  });

  test("when (hover: none) matches, focus from a screen reader does not open the card", async () => {
    stubHoverNone();
    render(<Host />);

    virtualFocus();
    tick(5000);

    expect(card()).toBeNull();
  });

  test("a tap on the trigger still runs its action", async () => {
    stubHoverNone();
    const onTriggerClick = vi.fn();
    render(<Host onTriggerClick={onTriggerClick} />);

    act(() => fireEvent.click(trigger()));
    tick(5000);

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(card()).toBeNull();
  });
});

describe("controlled mode", () => {
  test("hover asks to open through onOpenChange and does not open by itself", async () => {
    const onOpenChange = vi.fn();
    render(<Host open={false} onOpenChange={onOpenChange} />);

    hover(trigger());
    tick(700);

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(card()).toBeNull();
  });

  test("the card follows the open prop", () => {
    const { rerender } = render(<Host open />);
    expect(card()).not.toBeNull();

    rerender(<Host open={false} />);
    expect(card()).toBeNull();
  });

  test("Escape asks to close through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    render(<Host open onOpenChange={onOpenChange} />);

    escape();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("defaultOpen starts the card open", () => {
    render(<Host defaultOpen />);

    expect(card()).not.toBeNull();
  });
});

describe("layers", () => {
  test("the card sits on the popover layer", () => {
    const { baseElement } = render(<Host open />);

    expect(baseElement.querySelector(`.${CSS.escape(OVERLAY_LAYER.popover)}`)).not.toBeNull();
  });

  test("Escape in a Dialog closes the card first and the window second", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Window">
        <Host />
      </Dialog>
    );
    // The card opens AFTER the dialog, as it does in real life: Radix layers join
    // the stack in mount order, and `defaultOpen` in the same commit as the dialog
    // would put the card below it. That is a test artifact, not behavior.
    hover(trigger());
    tick(700);

    escape();
    expect(card()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Escape over a ModalOverlay closes only the card", async () => {
    const onClose = vi.fn();
    render(
      <ModalOverlay onClose={onClose}>
        <Host defaultOpen />
      </ModalOverlay>
    );

    escape();

    expect(card()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a card is not left behind by a pending timer after unmount", async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<Host onOpenChange={onOpenChange} />);
    hover(trigger());

    unmount();
    tick(5000);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
