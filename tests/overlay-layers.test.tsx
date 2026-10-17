// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import {
  Button as AriaButton,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../src/components/overlays/Menu.js";
import { MENU_PANEL_CLASS } from "../src/lib/menu.js";
import {
  ARIA_OVERLAY_SELECTOR,
  hasOpenAriaOverlay,
  layerCount,
  OVERLAY_LAYER,
  pushOverlayLayer,
} from "../src/lib/overlay-layer.js";
import { CommandPalette } from "../src/components/overlays/CommandPalette.js";
import { Dialog } from "../src/components/overlays/Dialog.js";

afterEach(cleanup);

/**
 * Escape belongs to the TOPMOST layer. For the analysis and the alternatives, see ADR-0041.
 *
 * The kit builds overlays on two libraries at once, and each keeps its own stack.
 * `Dialog` set up its own guard against a foreign Escape, but its solution was
 * never shared: `Drawer` had no guard at all, and `ModalOverlay` listened for
 * Escape on `document` without a stack and without checking `defaultPrevented`.
 *
 * WHAT IS NOT HERE. The combination "a react-aria menu INSIDE a modal Radix layer"
 * does not reproduce in jsdom: Radix in modal mode blocks interaction with the
 * `<body>` siblings, and the menu does not open either by click or from the
 * keyboard (checked). In a browser it opens, and the ADR was written for exactly
 * this combination. It should be guarded by `tests-visual/interactions.spec.ts`,
 * where `Drawer` already is. Here we check what is checkable: the condition under
 * which the guard fires, and the behavior of the layer under that condition.
 */
describe("the layer registry", () => {
  /**
   * The top layer is determined by POSITION IN THE DOCUMENT, not by registration
   * order. React runs effects bottom-up: among nested scrims the inner one
   * registers BEFORE the outer one, so the rule "the last one to register" would
   * declare the layer beneath all the others to be the top.
   */
  test("a nested layer is topmost, even though it registers first", () => {
    const outerNode = document.createElement("div");
    const innerNode = document.createElement("div");
    outerNode.appendChild(innerNode);
    document.body.appendChild(outerNode);

    // The registration order is deliberately the reverse of the nesting — that is
    // how React registers them.
    const inner = pushOverlayLayer();
    inner.attach(innerNode);
    const outer = pushOverlayLayer();
    outer.attach(outerNode);

    expect(inner.isTopmost()).toBe(true);
    expect(outer.isTopmost()).toBe(false);

    inner.release();
    expect(outer.isTopmost()).toBe(true);
    outer.release();
    outerNode.remove();
  });

  test("between siblings the later one in the document is topmost", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    const a = pushOverlayLayer();
    a.attach(first);
    const b = pushOverlayLayer();
    b.attach(second);

    expect(b.isTopmost()).toBe(true);
    expect(a.isTopmost()).toBe(false);

    // A layer may leave without being last: the component was unmounted because
    // of a route change, not because it was closed.
    b.release();
    expect(a.isTopmost()).toBe(true);
    a.release();
    first.remove();
    second.remove();
  });
});

describe("the foreign-layer predicate", () => {
  test("an open react-aria overlay is visible to the predicate", async () => {
    const user = userEvent.setup();
    expect(hasOpenAriaOverlay()).toBe(false);

    render(
      <MenuTrigger>
        <MenuButton aria-label="Actions">…</MenuButton>
        <Menu>
          <MenuItem id="one">One</MenuItem>
        </Menu>
      </MenuTrigger>
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));

    // The marker is the pair `data-rac` + `data-placement`. Only a positioned RAC
    // overlay sets it; no Radix node and no kit field inside a window carries it.
    expect(hasOpenAriaOverlay()).toBe(true);
  });

  test("a plain field of the kit is not mistaken for an overlay", () => {
    render(
      <Drawer open onClose={() => {}} title="Filters">
        <span>drawer body</span>
      </Drawer>
    );

    // `data-rac` is also present on ordinary RAC fields, hence the pair with
    // `data-placement`. The old guard told layers apart by the position of the
    // event target, and it got a `Combobox` inside a window wrong.
    expect(hasOpenAriaOverlay()).toBe(false);
  });
});

/**
 * Pointer inside a modal Radix layer (OLDSUI-51).
 *
 * A modal Radix sets `<body>` to `pointer-events: none` and returns the pointer
 * only to its own layers. A react-aria overlay lives in a portal under `<body>`
 * and, without the kit's rule, inherits `none`: a menu and a suggestion list
 * inside `Dialog` and `Drawer` did not respond to the mouse.
 *
 * The behavior itself cannot be checked in jsdom: Radix blocks opening the menu
 * here too (see the file header), and the kit's style cascade does not exist at
 * all. The click is guarded by `tests-visual/interactions.spec.ts`. What is here
 * is the link that the browser test would not name: the rule in `styles.css` is
 * written with exactly the selector by which the layers module recognizes a
 * react-aria overlay. If they drift apart, the rule will silently stop firing.
 */
describe("the pointer returns to a react-aria overlay", () => {
  const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

  test("styles.css re-enables the pointer on the module's selector, in the base layer", () => {
    const at = css.indexOf(`${ARIA_OVERLAY_SELECTOR} {`);
    expect(at, `styles.css has no rule for ${ARIA_OVERLAY_SELECTOR}`).toBeGreaterThan(-1);

    const body = css.slice(at, css.indexOf("}", at));
    expect(body).toMatch(/pointer-events:\s*auto;/);

    // In the `base` layer, not outside the layers: a rule outside a layer would
    // override any utility class, and `pointer-events-none` on a consumer's panel
    // would stop working.
    const layer = css.lastIndexOf("@layer base {", at);
    expect(layer).toBeGreaterThan(-1);
    const between = css.slice(layer, at);
    const depth = (between.match(/{/g) ?? []).length - (between.match(/}/g) ?? []).length;
    expect(depth).toBe(1);
  });
});

describe("Escape belongs to the topmost layer", () => {
  function NestedOverlays() {
    const [outer, setOuter] = useState(true);
    const [inner, setInner] = useState(true);
    return outer ? (
      <ModalOverlay onClose={() => setOuter(false)}>
        <span>outer</span>
        {inner && (
          <ModalOverlay onClose={() => setInner(false)}>
            <span>inner</span>
          </ModalOverlay>
        )}
      </ModalOverlay>
    ) : null;
  }

  test("nested overlays close one at a time", async () => {
    const user = userEvent.setup();
    render(<NestedOverlays />);

    await user.keyboard("{Escape}");

    expect(screen.queryByText("inner")).toBeNull();
    expect(screen.getByText("outer")).toBeDefined();
  });

  test("the drawer keeps its own Escape when no foreign layer is open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer open={open} onClose={() => setOpen(false)} title="Filters">
          <span>drawer body</span>
        </Drawer>
      );
    }
    render(<Host />);

    await user.keyboard("{Escape}");

    expect(screen.queryByText("drawer body")).toBeNull();
  });
});

/**
 * StrictMode mounts, unmounts and mounts again.
 *
 * A layer pushed onto the stack from the component BODY did not get back onto it
 * after this cycle: the cleanup removed it, and the re-render saw a ref that was
 * already filled and did not register again. The scrim stopped considering itself
 * topmost and silently stopped closing on Escape: in development, but not in the
 * production build.
 */
test("an overlay survives the StrictMode mount cycle", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(true);
    return open ? (
      <ModalOverlay onClose={() => setOpen(false)}>
        <span>body</span>
      </ModalOverlay>
    ) : null;
  }

  render(
    <StrictMode>
      <Host />
    </StrictMode>
  );

  await user.keyboard("{Escape}");

  expect(screen.queryByText("body")).toBeNull();
});

/**
 * The context menu panel's layer.
 *
 * `Popover` and `Tooltip` deliberately take `z-[120]`; the RAC popover gets
 * `zIndex: 100000` inline from the library. The Radix popper had nothing to copy:
 * it takes the z-index from the computed style of its content and got `auto`.
 * A right-click inside `Dialog` drew the menu UNDER the scrim (`z-90`): blurred
 * and not clickable.
 */
test("the menu panel carries the popover layer, not auto", () => {
  expect(MENU_PANEL_CLASS).toContain(OVERLAY_LAYER.popover);
});

test("the popover layer sits above the modal one", () => {
  const value = (cls: string) => Number(/\[(\d+)\]|z-(\d+)/.exec(cls)?.slice(1).find(Boolean));

  expect(value(OVERLAY_LAYER.popover)).toBeGreaterThan(value(OVERLAY_LAYER.modal));
});

/**
 * A react-aria tooltip does not count as a foreign layer.
 *
 * A RAC `Tooltip` carries the same pair `data-rac` + `data-placement` as a list
 * or a menu, but it does not take focus and does not close when a window opens.
 * While the cursor rests on the "?" trigger the tooltip hangs, and Escape stopped
 * closing the window AT ALL. The kit's own `Tooltip` is built on Radix, so inside
 * the package this never fired. But consumers also draw react-aria tooltips, and
 * such a tooltip anywhere on the page swallowed Escape for all of the kit's windows.
 */
test("a react-aria tooltip is not a foreign layer", () => {
  render(
    <AriaTooltipTrigger isOpen>
      <AriaButton>Help</AriaButton>
      <AriaTooltip>Explanation</AriaTooltip>
    </AriaTooltipTrigger>
  );

  expect(document.querySelector("[data-rac][data-placement]")).not.toBeNull();
  expect(hasOpenAriaOverlay()).toBe(false);
});

/**
 * Family: EVERY modal layer of the kit is in the stack.
 *
 * ADR-0041 promises this directly ("A new modal layer of the kit must register
 * itself… The test family guards it"), but the first version did not keep the
 * promise: only one `ModalOverlay` registered, so the stack decided "scrim against
 * scrim" and nothing else. The list below is that guard: a forgotten registration
 * is caught here, not in the application.
 */
describe("every modal layer of the kit registers itself", () => {
  const LAYERS = [
    {
      name: "ModalOverlay",
      render: () => (
        <ModalOverlay onClose={() => {}}>
          <span>body</span>
        </ModalOverlay>
      ),
    },
    {
      name: "Dialog",
      render: () => (
        <Dialog open onClose={() => {}} title="Window">
          <span>body</span>
        </Dialog>
      ),
    },
    {
      name: "Drawer",
      render: () => (
        <Drawer open onClose={() => {}} title="Filters">
          <span>body</span>
        </Drawer>
      ),
    },
    {
      name: "CommandPalette",
      render: () => (
        <CommandPalette
          open
          onClose={() => {}}
          sections={[{ id: "s", label: "S", items: [{ id: "one", label: "First" }] }]}
          onSelect={() => {}}
        />
      ),
    },
  ] as const;

  test.each(LAYERS)("$name takes a place in the stack", ({ render: element }) => {
    // We register our own layer AFTER the component: if the component is not in
    // the stack, ours would be the only one and would declare itself topmost.
    render(element());
    const mine = pushOverlayLayer();
    const node = document.createElement("div");
    document.body.appendChild(node);
    mine.attach(node);

    try {
      // The component's node lies in the document either before ours or after it,
      // but it IS there, so at least one of the two is not topmost.
      // The component's layer must be in the stack, which means we are not alone there.
      expect(layerCount()).toBeGreaterThan(1);
    } finally {
      mine.release();
      node.remove();
    }
  });
});
