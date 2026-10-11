// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { Toaster, toast } from "../src/components/actions/Toaster.js";
import { AppShell } from "../src/components/app-shell/AppShell.js";
import { ContextualSaveBar } from "../src/components/navigation/ContextualSaveBar.js";

afterEach(() => {
  toast.dismiss();
  cleanup();
  document.documentElement.removeAttribute("style");
});

/**
 * jsdom не считает раскладку, поэтому `offsetHeight` подменяется (как в
 * `top-bar.test.tsx`): отцепленный узел отдаёт ноль, подключённый — высоту
 * нижней панели. Настоящую высоту и порядок слоёв на телефоне сторожит
 * `tests-visual/interactions.spec.ts`.
 */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? 56 : 0;
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const heightOf = (name: string) => document.documentElement.style.getPropertyValue(name);

describe("AppShell: publishing the bottom bar height", () => {
  test("the slot height goes into --bottombar-h on mount", () => {
    render(<AppShell bottomBar={<nav>Sections</nav>}>Page</AppShell>);
    expect(heightOf("--bottombar-h")).toBe("56px");
  });

  test("without the slot the variable does not exist", () => {
    render(<AppShell>Page</AppShell>);
    expect(heightOf("--bottombar-h")).toBe("");
  });

  test("the variable name is a prop", () => {
    render(
      <AppShell bottomBarHeightVar="--tabs-h" bottomBar={<nav>Sections</nav>}>
        Page
      </AppShell>
    );
    expect(heightOf("--tabs-h")).toBe("56px");
    expect(heightOf("--bottombar-h")).toBe("");
  });

  test("bottomBarHeightVar=null switches publishing off", () => {
    render(
      <AppShell bottomBarHeightVar={null} bottomBar={<nav>Sections</nav>}>
        Page
      </AppShell>
    );
    expect(heightOf("--bottombar-h")).toBe("");
  });

  test("the variable is removed together with the shell", () => {
    const { unmount } = render(<AppShell bottomBar={<nav>Sections</nav>}>Page</AppShell>);
    unmount();
    expect(heightOf("--bottombar-h")).toBe("");
  });

  test("the variable follows the slot appearing and disappearing", () => {
    const { rerender } = render(<AppShell>Page</AppShell>);
    expect(heightOf("--bottombar-h")).toBe("");

    rerender(<AppShell bottomBar={<nav>Sections</nav>}>Page</AppShell>);
    expect(heightOf("--bottombar-h")).toBe("56px");

    rerender(<AppShell>Page</AppShell>);
    expect(heightOf("--bottombar-h")).toBe("");
  });
});

describe("ContextualSaveBar: standing above the bottom bar", () => {
  const bar = () => screen.getByRole("group");
  const offset = () => bar().style.getPropertyValue("--od-savebar-bottom");

  test("it sticks at the published bottom bar height, with 0 as the fallback", () => {
    render(<ContextualSaveBar visible onSave={() => {}} />);
    expect(offset()).toBe("var(--bottombar-h, 0px)");
    expect(bar().className).toContain("bottom-[var(--od-savebar-bottom)]");
    // Не инлайн: инлайновый `bottom` перебил бы класс потребителя.
    expect(bar().style.bottom).toBe("");
  });

  test("the variable name is a prop", () => {
    render(<ContextualSaveBar visible offsetVar="--tabs-h" onSave={() => {}} />);
    expect(offset()).toBe("var(--tabs-h, 0px)");
  });

  test("a consumer bottom-* class wins over the kit offset", () => {
    // Своя нижняя панель вне `AppShell`: потребитель подпирает полосу классом.
    render(<ContextualSaveBar visible className="bottom-14" onSave={() => {}} />);
    expect(bar().className).toContain("bottom-14");
    expect(bar().className).not.toContain("bottom-[var(--od-savebar-bottom)]");
  });

  test("sticky=false leaves the bar in the flow with no bottom offset", () => {
    render(<ContextualSaveBar visible sticky={false} onSave={() => {}} />);
    expect(bar().className).not.toContain("bottom-[");
    expect(bar().className).not.toContain("sticky");
  });
});

describe("Toaster: standing above the bottom bar", () => {
  test("the bottom offset is the bottom bar height plus the library gap", async () => {
    render(<Toaster />);
    toast.info("Saved");
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());

    const list = document.querySelector<HTMLElement>("[data-sonner-toaster]")!;
    expect(list.style.getPropertyValue("--offset-bottom")).toBe(
      "calc(var(--bottombar-h, 0px) + 24px)"
    );
    expect(list.style.getPropertyValue("--mobile-offset-bottom")).toBe(
      "calc(var(--bottombar-h, 0px) + 16px)"
    );
  });

  test("the variable name is a prop", async () => {
    render(<Toaster offsetVar="--tabs-h" />);
    toast.info("Saved");
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());

    const list = document.querySelector<HTMLElement>("[data-sonner-toaster]")!;
    expect(list.style.getPropertyValue("--offset-bottom")).toBe("calc(var(--tabs-h, 0px) + 24px)");
  });
});
