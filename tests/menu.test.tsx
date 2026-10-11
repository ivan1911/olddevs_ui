// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Selection } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "../src/components/overlays/Menu.js";

/*
  Шим `CSS.escape`.

  В jsdom объекта `CSS` нет вовсе, а попоувер react-aria зовёт `CSS.escape`
  при открытии — без шима меню не открывается ни в одном тесте, и падает это
  не в проверяемом месте, а внутри библиотеки.

  Шим допустим ровно потому, что делает окружение БЛИЖЕ к браузеру, а не
  дальше: `CSS.escape` есть везде и является чистой строковой функцией. Это
  не то же самое, что подменять раскладку или фокус — такое в jsdom не
  подменяется, и проверки, которые от них зависят, живут в
  `tests-visual/interactions.spec.ts` (ADR-0012).
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Plain({ onAction = () => {} }: { onAction?: () => void }) {
  return (
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem onAction={onAction}>Rename</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" disabled>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}

function WithToggles() {
  const [keys, setKeys] = useState<Selection>(new Set(["dense"]));
  return (
    <MenuTrigger>
      <MenuButton aria-label="View">…</MenuButton>
      <Menu>
        <MenuSection
          label="Density"
          selectionMode="multiple"
          selectedKeys={keys}
          onSelectionChange={setKeys}
        >
          <MenuItem id="dense">Dense grid</MenuItem>
          <MenuItem id="meta">Show labels</MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}

test("the menu opens by button and closes by Escape", async () => {
  const user = userEvent.setup();
  render(<Plain />);

  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("menu")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
});

test("onAction fires once, not twice", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<Plain onAction={onAction} />);

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  // Двойной вызов — классическая поломка меню, собранного руками: обработчик
  // вешают и на пункт, и на всплывающий клик панели.
  expect(onAction).toHaveBeenCalledTimes(1);
});

test("a plain item closes the menu", async () => {
  const user = userEvent.setup();
  render(<Plain />);

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(screen.queryByRole("menu")).toBeNull();
});

test("a toggle item does NOT close the menu", async () => {
  const user = userEvent.setup();
  render(<WithToggles />);

  await user.click(screen.getByRole("button", { name: "View" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Show labels" }));

  // Переключатели ставят пачкой: закрытие после первого заставляло бы открывать
  // меню заново на каждый флажок.
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("selection on a section yields roles and aria-checked, not just a tick", async () => {
  const user = userEvent.setup();
  render(<WithToggles />);

  await user.click(screen.getByRole("button", { name: "View" }));

  // Роль и состояние проставляет react-aria — ровно поэтому переключатели
  // сделаны выбором на разделе, а не пропом `checked` у пункта.
  const dense = screen.getByRole("menuitemcheckbox", { name: "Dense grid" });
  expect(dense.getAttribute("aria-checked")).toBe("true");
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Show labels" }).getAttribute("aria-checked")
  ).toBe("false");
});

test("a disabled item fires no action", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem disabled onAction={onAction}>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(onAction).not.toHaveBeenCalled();
});

test("arrows walk the items and skip the disabled one", async () => {
  const user = userEvent.setup();
  render(
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem>First</MenuItem>
        <MenuItem disabled>Second</MenuItem>
        <MenuItem>Third</MenuItem>
      </Menu>
    </MenuTrigger>
  );

  await user.click(screen.getByRole("button", { name: "Actions" }));

  // Открытое МЫШЬЮ меню ставит фокус на сам список, а не на первый пункт:
  // подсветка пункта появляется только тогда, когда пользователь взялся за
  // клавиатуру. Так ведёт себя react-aria в настоящем браузере (проверено в
  // Chromium), и первое нажатие стрелки не уходит «в никуда» — оно и приводит
  // на первый пункт. Открытие с клавиатуры сразу подсвечивает первый пункт,
  // но нажатие Enter на кнопке jsdom не воспроизводит (ADR-0012).
  expect(document.activeElement).toBe(screen.getByRole("menu"));

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement?.textContent).toBe("First");

  await user.keyboard("{ArrowDown}");
  // «Второй» выключен и пропускается: остановка на нём означала бы тупик —
  // выбрать его нельзя, а стрелка дальше уже нажата.
  expect(document.activeElement?.textContent).toBe("Third");

  await user.keyboard("{ArrowUp}");
  expect(document.activeElement?.textContent).toBe("First");
});
