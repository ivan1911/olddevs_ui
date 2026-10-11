// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ShortcutsHelp, type ShortcutGroup } from "../src/components/overlays/ShortcutsHelp.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(cleanup);

const GROUPS: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: [
      { keys: ["Ctrl", "K"], description: "Open search" },
      { keys: ["G", "H"], description: "Go home" },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [{ keys: ["Esc"], description: "Close the window" }],
  },
];

test("the window is a dialog named by the default title from the catalog", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);
  expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
});

test("the title can be overridden", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} title="Cheat sheet" groups={GROUPS} />);
  expect(screen.getByRole("dialog", { name: "Cheat sheet" })).toBeTruthy();
});

test("an empty title is not a title: the dialog keeps the default name", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} title="" groups={GROUPS} />);
  expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
});

test("the default title follows the locale catalog", () => {
  render(
    <UiProvider messages={ru}>
      <ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />
    </UiProvider>
  );
  expect(screen.getByRole("dialog", { name: ru.shortcutsHelp.title })).toBeTruthy();
});

test("nothing is rendered while closed", () => {
  render(<ShortcutsHelp open={false} onOpenChange={vi.fn()} groups={GROUPS} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("groups are named groups, not headings of a fixed level", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);

  const navigation = screen.getByRole("group", { name: "Navigation" });
  expect(within(navigation).getByText("Open search")).toBeTruthy();
  expect(within(navigation).getByText("Go home")).toBeTruthy();
  expect(within(navigation).queryByText("Close the window")).toBeNull();

  const editing = screen.getByRole("group", { name: "Editing" });
  expect(within(editing).getByText("Close the window")).toBeTruthy();

  // Уровень заголовка зависит от того, куда окно встало, — кит его не знает.
  // Единственный заголовок на странице — имя самого окна.
  expect(screen.queryByRole("heading", { name: "Navigation" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Editing" })).toBeNull();
});

test("each shortcut is a list item: description and its keys together", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);

  const navigation = screen.getByRole("group", { name: "Navigation" });
  const rows = within(navigation).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(within(rows[0]!).getByText("Open search")).toBeTruthy();
  expect(within(rows[1]!).getByText("Go home")).toBeTruthy();
});

test("every key is its own kbd element", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);

  const row = screen.getAllByRole("listitem")[0]!;
  const keys = [...row.querySelectorAll("kbd")].map((key) => key.textContent);
  expect(keys).toEqual(["Ctrl", "K"]);
});

test("a combination is read as a combination: the word sits between keys, the glyph is silent", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);

  const row = screen.getAllByRole("listitem")[0]!;
  // Видимый «+» — для глаз и из дерева доступности убран; слово «plus» читается.
  const glyph = within(row).getByText("+");
  expect(glyph.closest('[aria-hidden="true"]')).toBeTruthy();
  const word = within(row).getByText("plus");
  expect(word.closest('[aria-hidden="true"]')).toBeNull();
});

test("a single key has no separator at all", () => {
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />);

  const row = screen.getAllByRole("listitem")[2]!;
  expect(within(row).queryByText("+")).toBeNull();
  expect(within(row).queryByText("plus")).toBeNull();
});

test("the separator word follows the locale catalog", () => {
  render(
    <UiProvider messages={ru}>
      <ShortcutsHelp open onOpenChange={vi.fn()} groups={GROUPS} />
    </UiProvider>
  );

  const row = screen.getAllByRole("listitem")[0]!;
  expect(within(row).getByText(ru.shortcutsHelp.keySeparator)).toBeTruthy();
});

test("a group without items is not announced", () => {
  render(
    <ShortcutsHelp
      open
      onOpenChange={vi.fn()}
      groups={[...GROUPS, { id: "empty", label: "Nothing here", items: [] }]}
    />
  );
  expect(screen.queryByRole("group", { name: "Nothing here" })).toBeNull();
});

test("Escape and the close button each ask the owner to close", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<ShortcutsHelp open onOpenChange={onOpenChange} groups={GROUPS} />);

  await user.keyboard("{Escape}");
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenNthCalledWith(1, false);

  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalledTimes(2);
  expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
});

test("the kit installs no global keys: the opening key belongs to the consumer", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<ShortcutsHelp open={false} onOpenChange={onOpenChange} groups={GROUPS} />);

  await user.keyboard("?");
  await user.keyboard("{Shift>}/{/Shift}");
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the consumer's own `?` handler opens the window and focus returns to what had it", async () => {
  const user = userEvent.setup();

  function Harness() {
    const [open, setOpen] = useState(false);
    // Рецепт из справочника: обработчик у потребителя, а не в ките.
    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "?" || event.ctrlKey || event.altKey || event.metaKey) return;
        setOpen(true);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, []);
    return (
      <>
        <button type="button">Somewhere on the page</button>
        <ShortcutsHelp open={open} onOpenChange={setOpen} groups={GROUPS} />
      </>
    );
  }

  render(<Harness />);
  const anchor = screen.getByRole("button", { name: "Somewhere on the page" });
  anchor.focus();

  await user.keyboard("?");
  expect(screen.getByRole("dialog")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(anchor);
});

test("a button opener gets focus back on close", async () => {
  const user = userEvent.setup();

  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Shortcuts
        </button>
        <ShortcutsHelp open={open} onOpenChange={setOpen} groups={GROUPS} />
      </>
    );
  }

  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Shortcuts" });

  await user.click(trigger);
  expect(screen.getByRole("dialog")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);
});

test("a group id with whitespace still names its group", () => {
  render(
    <ShortcutsHelp
      open
      onOpenChange={vi.fn()}
      groups={[{ id: "text editing", label: "Text editing", items: GROUPS[0]!.items }]}
    />
  );
  expect(screen.getByRole("group", { name: "Text editing" })).toBeTruthy();
});

test("a long list scrolls inside the window and the scroller is reachable by keyboard", () => {
  const many: ShortcutGroup[] = [
    {
      id: "many",
      label: "Many",
      items: Array.from({ length: 40 }, (_, index) => ({
        keys: ["Alt", String(index)],
        description: `Action ${index}`,
      })),
    },
  ];
  render(<ShortcutsHelp open onOpenChange={vi.fn()} groups={many} />);

  // Без остановки табуляции пользователь клавиатуры не прокрутит область
  // стрелками; безымянная остановка — шум для слуха, поэтому у области есть имя,
  // и оно не повторяет имя окна: два одинаковых имени подряд — шум.
  const region = screen.getByRole("region", { name: "Shortcuts" });
  expect(region.getAttribute("tabindex")).toBe("0");
  expect(within(region).getAllByRole("listitem")).toHaveLength(40);
});
