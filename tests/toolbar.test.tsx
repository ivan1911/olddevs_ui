// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, test } from "vitest";
import {
  Button,
  Dialog,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  Menu,
  MenuButton,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "../src/index.js";
import { Separator, Toolbar } from "../src/index.js";

if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

const focused = () => (document.activeElement as HTMLElement).textContent;

describe("Toolbar", () => {
  test("it is a toolbar named by aria-label", () => {
    render(
      <Toolbar aria-label="Formatting">
        <Button>Bold</Button>
      </Toolbar>
    );
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
  });

  test("it can be named by a visible heading through aria-labelledby", () => {
    render(
      <>
        <h2 id="title">Canvas tools</h2>
        <Toolbar aria-labelledby="title">
          <Button>Bold</Button>
        </Toolbar>
      </>
    );
    expect(screen.getByRole("toolbar", { name: "Canvas tools" })).toBeTruthy();
  });

  test("a name is required by the types", () => {
    // Проверяется компилятором (`npm run typecheck`): строки без имени и с обоими
    // именами сразу не собираются. В рантайме достаточно, что тест их не рендерит.
    // @ts-expect-error — ни `aria-label`, ни `aria-labelledby`
    const unnamed = <Toolbar>x</Toolbar>;
    // @ts-expect-error — оба сразу: второй источник имени
    const both = <Toolbar aria-label="a" aria-labelledby="b" />;
    expect(unnamed && both).toBeTruthy();
  });

  test("forwards a ref to the toolbar element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Toolbar ref={ref} aria-label="Formatting">
        <Button>Bold</Button>
      </Toolbar>
    );
    expect(ref.current).toBe(screen.getByRole("toolbar", { name: "Formatting" }));
  });

  test("the whole panel is one tab stop", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>before</button>
        <Toolbar aria-label="Tools">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </Toolbar>
        <button>after</button>
      </>
    );
    await user.tab();
    await user.tab();
    expect(focused()).toBe("One");
    await user.tab();
    expect(focused()).toBe("after");
  });

  test("arrows move along the axis, Home and End jump to the edges", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <Button>One</Button>
        <Button>Two</Button>
        <Button>Three</Button>
      </Toolbar>
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("Two");
    await user.keyboard("{End}");
    expect(focused()).toBe("Three");
    await user.keyboard("{Home}");
    expect(focused()).toBe("One");
    await user.keyboard("{ArrowLeft}");
    // Края не зацикливаются: «круг» прятал бы, что действия кончились.
    expect(focused()).toBe("One");
  });

  test("disabled actions are skipped by arrows, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <Button disabled>One</Button>
        <Button>Two</Button>
        <Button disabled>Three</Button>
        <Button>Four</Button>
        <Button disabled>Five</Button>
      </Toolbar>
    );
    await user.tab();
    expect(focused()).toBe("Two");
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("Four");
    await user.keyboard("{Home}");
    expect(focused()).toBe("Two");
    await user.keyboard("{End}");
    expect(focused()).toBe("Four");
  });

  test("Home and End stay with a text field inside", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <Button>One</Button>
        <input aria-label="Zoom" defaultValue="100" />
        <Button>Three</Button>
      </Toolbar>
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Zoom" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Zoom" }));
  });

  test("Home and End stay with a composite widget inside that owns them", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <Button>One</Button>
        <div role="tablist" aria-label="Views">
          <button role="tab" aria-selected="true">
            Grid
          </button>
        </div>
        <Button>Three</Button>
      </Toolbar>
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("Grid");
    // Слушатель панели срабатывает раньше React-обработчиков вложенного виджета,
    // и `defaultPrevented` их не видит: виджет должен быть узнан по роли.
    await user.keyboard("{End}");
    expect(focused()).toBe("Grid");
  });

  test("a checkbox inside does not keep Home and End: it has no caret", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <input type="checkbox" aria-label="Snap" />
        <Button>Two</Button>
        <Button>Three</Button>
      </Toolbar>
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Snap" }));
    await user.keyboard("{End}");
    expect(focused()).toBe("Three");
  });

  test("a widget around the toolbar does not take Home and End away from it", async () => {
    const user = userEvent.setup();
    render(
      <div role="listbox" aria-label="Rows">
        <Toolbar aria-label="Row actions">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </Toolbar>
      </div>
    );
    await user.tab();
    await user.keyboard("{End}");
    expect(focused()).toBe("Three");
  });

  test("Home and End land where the arrows stop: hidden actions are not an edge", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <Button>One</Button>
        <Button>Two</Button>
        {/* Скрыто стилем (адаптивный `hidden md:inline-flex`), а не атрибутом. */}
        <button style={{ display: "none" }}>Wide only</button>
      </Toolbar>
    );
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focused()).toBe("Two");
    await user.keyboard("{Home}{End}");
    expect(focused()).toBe("Two");
  });

  test("an aria-disabled action is an edge for Home as it is for the arrows", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <a href="#export" aria-disabled="true">
          Export
        </a>
        <Button>Two</Button>
        <Button>Three</Button>
      </Toolbar>
    );
    await user.tab();
    await user.keyboard("{End}{ArrowLeft}{ArrowLeft}");
    expect(focused()).toBe("Export");
    await user.keyboard("{End}{Home}");
    expect(focused()).toBe("Export");
  });

  test("coming back lands on the action that was used last", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>before</button>
        <Toolbar aria-label="Tools">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </Toolbar>
        <button>after</button>
      </>
    );
    await user.tab();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    await user.tab();
    expect(focused()).toBe("after");
    await user.tab({ shift: true });
    expect(focused()).toBe("Two");
    await user.tab({ shift: true });
    expect(focused()).toBe("before");
  });

  test("a ToggleGroup inside is a plain group without an aria-orientation it may not have", async () => {
    render(
      <Toolbar aria-label="Tools">
        <ToggleGroup
          aria-label="Style"
          value={[]}
          onChange={() => {}}
          options={[{ id: "b", label: "B" }]}
        />
      </Toolbar>
    );
    const group = screen.getByRole("group", { name: "Style" });
    // Атрибут добавляет react-aria вместе с ролью `group`; для неё он недопустим (axe).
    await waitFor(() => expect(group.getAttribute("aria-orientation")).toBeNull());
  });

  describe("orientation", () => {
    test("horizontal by default and reported to assistive tech", () => {
      render(
        <Toolbar aria-label="Tools">
          <Button>One</Button>
        </Toolbar>
      );
      expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("horizontal");
    });

    test("vertical panel is walked by up and down, not left and right", async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Tools" orientation="vertical">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </Toolbar>
      );
      expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("vertical");
      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(focused()).toBe("One");
      await user.keyboard("{ArrowDown}");
      expect(focused()).toBe("Two");
      await user.keyboard("{End}");
      expect(focused()).toBe("Three");
      await user.keyboard("{ArrowUp}");
      expect(focused()).toBe("Two");
    });
  });

  describe("Separator inside", () => {
    test("is vertical in a horizontal panel without being told", () => {
      render(
        <Toolbar aria-label="Tools">
          <Button>One</Button>
          <Separator />
          <Button>Two</Button>
        </Toolbar>
      );
      expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
    });

    test("is horizontal in a vertical panel", () => {
      render(
        <Toolbar aria-label="Tools" orientation="vertical">
          <Button>One</Button>
          <Separator />
          <Button>Two</Button>
        </Toolbar>
      );
      // Горизонтальная черта — значение по умолчанию, и атрибута может не быть.
      expect(screen.getByRole("separator").getAttribute("aria-orientation")).not.toBe("vertical");
    });

    test("an explicit orientation wins over the panel", () => {
      render(
        <Toolbar aria-label="Tools">
          <Separator orientation="horizontal" />
        </Toolbar>
      );
      expect(screen.getByRole("separator").getAttribute("aria-orientation")).not.toBe("vertical");
    });

    test("outside a toolbar it stays horizontal", () => {
      render(<Separator />);
      expect(screen.getByRole("separator").getAttribute("aria-orientation")).not.toBe("vertical");
    });

    test("a Popover opened from the toolbar does not inherit its axis", () => {
      render(
        <Toolbar aria-label="Tools" orientation="vertical">
          <Popover defaultOpen>
            <PopoverTrigger asChild>
              <Button>Filters</Button>
            </PopoverTrigger>
            <PopoverContent>
              <ToggleGroup
                aria-label="Status"
                value={[]}
                onChange={() => {}}
                options={[{ id: "a", label: "A" }]}
              />
            </PopoverContent>
          </Popover>
        </Toolbar>
      );
      // Вне DOM панели группа — самостоятельная `toolbar`, и ось у неё своя.
      const group = screen.getByRole("toolbar", { name: "Status" });
      expect(group.getAttribute("aria-orientation")).toBe("horizontal");
    });

    test("a Separator inside a Dialog opened from the toolbar stays horizontal", () => {
      render(
        <Toolbar aria-label="Tools">
          <Button>One</Button>
          <Dialog open onClose={() => {}} title="Settings">
            <Separator />
          </Dialog>
        </Toolbar>
      );
      const dialog = screen.getByRole("dialog");
      const separator = within(dialog).getByRole("separator");
      expect(separator.getAttribute("aria-orientation")).not.toBe("vertical");
    });

    test("a Menu panel opened from the toolbar keeps its horizontal separators", async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Tools">
          <MenuTrigger>
            <MenuButton>More</MenuButton>
            <Menu>
              <MenuItem>Rename</MenuItem>
              <MenuSeparator />
              <MenuItem>Delete</MenuItem>
            </Menu>
          </MenuTrigger>
        </Toolbar>
      );
      await user.click(screen.getByRole("button", { name: "More" }));
      const separators = await screen.findAllByRole("separator");
      for (const separator of separators)
        expect(separator.getAttribute("aria-orientation")).not.toBe("vertical");
    });
  });
});
