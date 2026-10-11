// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TreeView, type TreeNode } from "../src/components/navigation/TreeView.js";

afterEach(cleanup);

const TREE: TreeNode[] = [
  {
    id: "nature",
    label: "Nature",
    children: [
      { id: "forest", label: "Forest" },
      { id: "sea", label: "Sea", children: [{ id: "sunset", label: "Sunset" }] },
    ],
  },
  { id: "city", label: "City" },
];

test("roles and levels are set by the behaviour layer, not by us", () => {
  // Роль дерева у react-aria — `treegrid`, а узлы объявлены `row`: в строке
  // живут кнопка раскрытия и флажок, а `treeitem` второго интерактивного
  // элемента внутри себя не предполагает. Это её решение, и мы его не
  // переопределяем.
  render(<TreeView items={TREE} aria-label="Categories" defaultExpandedKeys={["nature"]} />);

  expect(screen.getByRole("treegrid", { name: "Categories" })).toBeTruthy();
  const rootItem = screen.getByRole("row", { name: /Nature/ });
  expect(rootItem.getAttribute("aria-level")).toBe("1");
  expect(rootItem.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-level")).toBe("2");
});

test("a collapsed node shows no children", () => {
  render(<TreeView items={TREE} aria-label="Categories" />);

  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("row", { name: /Forest/ })).toBeNull();
});

test("expansion goes outwards as a set", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      expandedKeys={[]}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getAllByRole("button", { name: /Expand/ })[0]!);

  // Дерево состояний не хранит: множество уходит тому, у кого они лежат.
  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});

test("the expander button name does not repeat the node label", () => {
  render(<TreeView items={TREE} aria-label="Categories" />);

  // react-aria дописывает подпись своего элемента сама: «Раскрыть Природа»
  // читалось бы как «Раскрыть Природа Природа» (урок ревью волны 18).
  const button = screen.getAllByRole("button")[0]!;
  expect(button.getAttribute("aria-label")).toBe("Expand");
});

test("without selectionMode there is no selection axis at all", () => {
  render(<TreeView items={TREE} aria-label="Categories" defaultExpandedKeys={["nature"]} />);

  // Дерево категорий, по которому просто ходят, не должно тащить флажки.
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-selected")).toBeNull();
});

test("selectionMode turns on the checkboxes and selection goes outwards", async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      selectionMode="multiple"
      selectedKeys={new Set()}
      onSelectionChange={onSelectionChange}
    />
  );

  const boxes = screen.getAllByRole("checkbox");
  expect(boxes.length).toBeGreaterThan(0);
  await user.click(boxes[0]!);

  // Сравнение по содержимому, а не по объекту: `Selection` из react-aria —
  // это `Set` с дополнительными полями (якорь и текущий ключ), и строгое
  // равенство множеств на нём не сходится.
  const selected = onSelectionChange.mock.calls[0]![0] as Set<unknown>;
  expect([...selected]).toEqual(["nature"]);
});

test("acting on a node is not selecting it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" onAction={onAction} />);

  await user.click(screen.getByRole("row", { name: /City/ }));

  expect(onAction).toHaveBeenCalledWith("city");
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
});

test("a disabled node is announced as disabled", () => {
  render(
    <TreeView items={[{ id: "city", label: "City", disabled: true }]} aria-label="Categories" />
  );

  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-disabled")).toBe("true");
});

test("an empty tree shows the given text", () => {
  render(<TreeView items={[]} aria-label="Categories" emptyText="No categories" />);

  expect(screen.getByText("No categories")).toBeTruthy();
});

test("activeKey marks the current node with aria-current and draws no checkboxes", () => {
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature"]}
      activeKey="forest"
    />
  );

  // Текущее место навигации — не выбор: `aria-current`, без флажков и без
  // `aria-selected` (словарь кита: `active` — это `aria-current="page"`).
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("row", { name: /Sea/ }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("row", { name: /Nature/ }).getAttribute("aria-current")).toBeNull();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-selected")).toBeNull();
});

test("activeKey follows the prop and an unknown key marks nothing", () => {
  const { rerender } = render(<TreeView items={TREE} aria-label="Categories" activeKey="city" />);
  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-current")).toBe("page");

  rerender(<TreeView items={TREE} aria-label="Categories" activeKey="missing" />);
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);

  rerender(<TreeView items={TREE} aria-label="Categories" />);
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);
});

test("activeKey moves between nested nodes when the prop changes with stable items", () => {
  // Узлы остаются теми же объектами: дерево обязано перерисовать строки по
  // одному `activeKey`, а не по смене `items`.
  const { rerender } = render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature", "sea"]}
      activeKey="forest"
    />
  );
  rerender(
    <TreeView
      items={TREE}
      aria-label="Categories"
      defaultExpandedKeys={["nature", "sea"]}
      activeKey="sunset"
    />
  );

  expect(screen.getByRole("row", { name: /Sunset/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("row", { name: /Forest/ }).getAttribute("aria-current")).toBeNull();
  expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
});

test("activeKey works together with onAction and does not turn into a selection", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" activeKey="city" onAction={onAction} />);

  await user.click(screen.getByRole("row", { name: /City/ }));

  // Узел остаётся текущим, пока потребитель не сменит ключ: дерево само
  // «текущее» не переставляет.
  expect(onAction).toHaveBeenCalledWith("city");
  expect(screen.getByRole("row", { name: /City/ }).getAttribute("aria-current")).toBe("page");
});

test("with onAction a click on a folder acts but does not expand it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      onAction={onAction}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getByRole("row", { name: /Nature/ }));

  // Поведение react-aria, а не наше: действие по папке и раскрытие — разные
  // жесты. Раскрывает папку кнопка-шеврон и стрелка вправо; кто хочет
  // раскрывать по клику на строку, делает это в `onAction` сам.
  expect(onAction).toHaveBeenCalledWith("nature");
  expect(onExpandedChange).not.toHaveBeenCalled();
});

test("the chevron still expands a folder when onAction is set", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeView
      items={TREE}
      aria-label="Categories"
      onAction={() => {}}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getAllByRole("button", { name: /Expand/ })[0]!);

  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});

test("without onAction a click on a folder row expands it", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(<TreeView items={TREE} aria-label="Categories" onExpandedChange={onExpandedChange} />);

  await user.click(screen.getByRole("row", { name: /Nature/ }));

  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["nature"]));
});
