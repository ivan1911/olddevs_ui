// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  getInteractionModality,
  trackInteractionModality,
} from "../src/lib/interaction-modality.js";

beforeAll(() => {
  trackInteractionModality();
});

afterEach(() => {
  // When the window loses focus, the undelivered event and the modality are reset.
  fireEvent.blur(window);
  document.body.replaceChildren();
});

function button(): HTMLButtonElement {
  const element = document.createElement("button");
  document.body.append(element);
  return element;
}

/** Focus that arrives right after an event; the key is released afterwards, as in real life. */
const focusAfter = (fire: () => void, element = button()) => {
  fire();
  element.focus();
  const modality = getInteractionModality();
  fireEvent.keyUp(document.body);
  return modality;
};

describe("interaction modality", () => {
  test("is virtual until anything happens", () => {
    expect(getInteractionModality()).toBe("virtual");
  });

  test("focus with no event before it is virtual", () => {
    button().focus();

    expect(getInteractionModality()).toBe("virtual");
  });

  test.each([
    ["Tab", {}],
    ["Tab", { shiftKey: true }],
    ["ArrowDown", {}],
    ["ArrowUp", {}],
    ["ArrowLeft", {}],
    ["ArrowRight", {}],
    ["Home", {}],
    ["End", {}],
    ["PageUp", {}],
    ["PageDown", {}],
  ])("%s %j makes the next focus keyboard", (key, init) => {
    expect(focusAfter(() => fireEvent.keyDown(document.body, { key, ...init }))).toBe("keyboard");
  });

  test.each([
    ["Enter", {}],
    [" ", {}],
    ["a", {}],
    ["Escape", {}],
    ["Shift", {}],
    ["Tab", { ctrlKey: true }],
    ["Tab", { metaKey: true }],
    ["ArrowRight", { altKey: true }],
  ])("%s %j is not a navigation key", (key, init) => {
    expect(focusAfter(() => fireEvent.keyDown(document.body, { key, ...init }))).toBe("virtual");
  });

  test.each([
    ["pointerdown", () => fireEvent.pointerDown(document.body)],
    ["mousedown", () => fireEvent.mouseDown(document.body)],
    ["touchstart", () => fireEvent.touchStart(document.body)],
  ])("%s makes the next focus pointer", (_name, fire) => {
    expect(focusAfter(fire)).toBe("pointer");
  });

  test("the last event wins: a click after Tab is pointer, Tab after a click is keyboard", () => {
    expect(
      focusAfter(() => {
        fireEvent.keyDown(document.body, { key: "Tab" });
        fireEvent.pointerDown(document.body);
      })
    ).toBe("pointer");
    expect(
      focusAfter(() => {
        fireEvent.pointerDown(document.body);
        fireEvent.keyDown(document.body, { key: "Tab" });
      })
    ).toBe("keyboard");
  });

  test("Option+Tab (Safari on macOS) is a keyboard focus, other Alt combinations are not", () => {
    expect(focusAfter(() => fireEvent.keyDown(document.body, { key: "Tab", altKey: true }))).toBe(
      "keyboard"
    );
  });

  test("one key press explains every focus until the key is released (a focus redirect)", () => {
    fireEvent.keyDown(document.body, { key: "Tab" });

    button().focus();
    expect(getInteractionModality()).toBe("keyboard");
    button().focus();
    expect(getInteractionModality()).toBe("keyboard");
  });

  test("another key after Tab (Enter) stops the focus after it from counting as keyboard", () => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.keyDown(document.body, { key: "Enter" });

    button().focus();

    expect(getInteractionModality()).toBe("virtual");
  });

  test("a programmatic focus after a click stays pointer", () => {
    fireEvent.pointerDown(document.body);

    button().focus();
    button().focus();

    expect(getInteractionModality()).toBe("pointer");
  });

  test("a key released before the focus arrives does not stay pending", () => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.keyUp(document.body, { key: "Tab" });

    button().focus();

    expect(getInteractionModality()).toBe("virtual");
  });

  test("a pending keyboard event does not survive leaving the window", () => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.blur(window);
    fireEvent.focus(window);

    button().focus();

    expect(getInteractionModality()).toBe("virtual");
  });

  test("on the server the tracker does nothing and does not throw", async () => {
    vi.resetModules();
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    try {
      const server = await import("../src/lib/interaction-modality.js");

      expect(() => server.trackInteractionModality()).not.toThrow();
      expect(server.getInteractionModality()).toBe("virtual");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
