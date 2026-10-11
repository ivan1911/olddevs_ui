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
  // Поведение карточки не должно протекать между тестами через стенд для тача.
  Reflect.deleteProperty(window, "matchMedia");
  // Трекер модальности глобален: уход окна из фокуса сбрасывает недоставленное
  // событие, чтобы клавиша одного теста не стала «клавишей» следующего.
  fireEvent.blur(window);
});

/*
  Без user-event: его обёртка `asyncWrapper` у Testing Library ждёт реальный
  `setTimeout`, а под `vi.useFakeTimers` он не наступает — тест висит до
  таймаута. События шлются напрямую, время двигает `tick`.
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
  Карточка открывается только по фокусу, пришедшему от клавиши: модальность
  ввода читается из `lib/interaction-modality` (слушатели на `document`). Тесты
  воспроизводят цепочку событий браузера: клавиша или нажатие, затем фокус.
  Фокус без предшествующего события — это виртуальная модальность (скринридер).
*/
const pressTab = () => {
  act(() => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    trigger().focus();
    fireEvent.keyUp(document.body);
  });
};
/** Нажатие мышью или пальцем: событие указателя, затем фокус от него. */
const mouseFocus = () => {
  act(() => {
    fireEvent.pointerDown(trigger(), { pointerType: "mouse" });
    trigger().focus();
  });
};
/** Фокус без клавиши и указателя: так его ставит свайп VoiceOver или TalkBack. */
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

/** Время идёт внутри `act`: таймеры меняют состояние React. */
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Эмуляция устройства без наведения: `matchMedia("(hover: none)")` совпадает. */
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

    // Щелчок по ссылке тоже ставит на неё фокус; карточка под уже
    // совершённым действием не нужна.
    mouseFocus();
    tick(5000);

    expect(card()).toBeNull();
  });

  test("focus with no key or pointer before it (a screen reader) does not open the card", () => {
    render(<Host />);

    // Свайп VoiceOver или TalkBack, виртуальный курсор NVDA: страница не
    // получает ни клавиши, ни указателя — фокус просто появляется.
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

    // Обработчик клика переводит фокус кодом (например, возвращает его на
    // триггер после закрытия окна): это продолжение нажатия, а не клавиша.
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

    // Пользователь ушёл из окна и вернулся: браузер возвращает фокус на ссылку
    // без клавиши. Прежняя клавиша не должна считаться причиной этого фокуса.
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

    // Фокус уходит в пустоту, а не на соседний элемент: так проверяется именно
    // отложенное закрытие по blur, без немедленного закрытия по клику вовне.
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

    // Escape убирает панель из документа вместе с курсором на ней: `pointerleave`
    // не придёт, и флаг «курсор на карточке» остался бы поднятым.
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
    // Фокус всё ещё на ссылке; но после закрытия он «держать» карточку не должен.
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

    // Карточка — дополнение, а не поповер по клику: ни `aria-haspopup`, ни
    // `aria-expanded` на ссылке нет, иначе скринридер пообещает меню.
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

    // Касание ставит фокус, но не клавишей — как щелчок мышью.
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
    // Карточка открывается ПОСЛЕ окна, как и в жизни: слои Radix встают в стек
    // в порядке монтирования, и `defaultOpen` в том же коммите, что и окно,
    // поставил бы карточку ниже него — это артефакт теста, а не поведение.
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
