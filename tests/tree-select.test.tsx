// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import { TreeSelect } from "../src/components/inputs/TreeSelect.js";
import type { TreeNode } from "../src/components/navigation/TreeView.js";

/*
  Шим `CSS.escape` — тот же, что в `menu.test.tsx`: в jsdom объекта `CSS` нет, а
  попоувер зовёт его при открытии, и без шима поле не раскрывается ни в одном
  тесте.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

const ORG: TreeNode[] = [
  {
    id: "company",
    label: "Company",
    children: [
      {
        id: "sales",
        label: "Sales",
        children: [
          { id: "direct", label: "Direct sales" },
          { id: "partners", label: "Partner network" },
        ],
      },
      { id: "logistics", label: "Logistics" },
      { id: "finance", label: "Finance" },
    ],
  },
];

function Org({ initial = [] as Key[], multiple = false, clearable = false, disabled = false }) {
  const [value, setValue] = useState<Key[]>(initial);
  return (
    <TreeSelect
      items={ORG}
      value={value}
      onChange={setValue}
      multiple={multiple}
      clearable={clearable}
      disabled={disabled}
      defaultExpandedKeys={["company", "sales"]}
      aria-label="Division"
    />
  );
}

/*
  Имя поля складывается из скрытой подписи и содержимого: `aria-label` на кнопке
  побеждал бы содержимое, и поле объявлялось бы «Division» — без единого слова о
  том, что выбрано.
*/
const field = () => screen.getByRole("button", { name: /^Division/ });

test("the closed field shows the placeholder while nothing is chosen", () => {
  render(<Org />);
  expect(screen.getByText("Select a node")).toBeTruthy();
});

test("the closed field shows the caption of the chosen node", () => {
  render(<Org initial={["logistics"]} />);
  expect(screen.getByText("Logistics")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();
});

/*
  Главная проверка доступности этого поля: выбранное обязано входить в имя.
  Пока имя бралось из `aria-label`, пользователь скринридера слышал «Division,
  кнопка» и никогда не узнавал, что выбрано, — а axe этого не ловит, потому что
  имя у кнопки есть.
*/
test("the accessible name carries both the label and the chosen value", () => {
  render(<Org initial={["logistics"]} />);
  expect(screen.getByRole("button", { name: "Division Logistics" })).toBeTruthy();
});

test("the accessible name falls back to the placeholder while empty", () => {
  render(<Org />);
  expect(screen.getByRole("button", { name: "Division Select a node" })).toBeTruthy();
});

/*
  Внутри — тот самый `TreeView`, а не второе дерево: роль `treegrid` приходит
  от него (ADR-0024). Тест сторожит композицию, а не разметку.
*/
test("the popover holds a TreeView, not a second tree", async () => {
  const user = userEvent.setup();
  render(<Org />);

  await user.click(field());
  expect(await screen.findByRole("treegrid", { name: "Division" })).toBeTruthy();
});

test("a single choice sets the value and closes the popover", async () => {
  const user = userEvent.setup();
  render(<Org />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Finance$/ }));

  expect(screen.queryByRole("treegrid")).toBeNull();
  expect(screen.getByText("Finance")).toBeTruthy();
});

/*
  Множественный выбор поповер НЕ закрывает: выбор ещё не закончен, и закрытие
  требовало бы открывать заново на каждый узел.
*/
test("a multiple choice keeps the popover open and shows chips", async () => {
  const user = userEvent.setup();
  render(<Org multiple />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Logistics$/ }));
  expect(screen.getByRole("treegrid")).toBeTruthy();

  await user.click(screen.getByRole("row", { name: /^Finance$/ }));
  expect(screen.getByRole("treegrid")).toBeTruthy();

  // Искать по всему документу нельзя: поповер открыт, и подписи строк дерева
  // матчатся тем же выражением. Прежняя версия теста проходила и на
  // компоненте, который чипов не рисует вовсе.
  const chips = within(field()).getAllByText(/^(Logistics|Finance)$/);
  expect(chips).toHaveLength(2);
});

/*
  Отметка ветки не отмечает потомков, и это решение, а не упущение: значит ли
  «отдел» всех его сотрудников — вопрос политики прав, а не кита.
*/
test("choosing a branch does not choose its descendants", async () => {
  const user = userEvent.setup();
  render(<Org multiple />);

  await user.click(field());
  await user.click(await screen.findByRole("row", { name: /^Sales$/ }));

  expect(screen.getByRole("row", { name: /Direct sales/ }).getAttribute("aria-selected")).not.toBe(
    "true"
  );
});

test("Delete clears the field from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  field().focus();
  await user.keyboard("{Delete}");

  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  Очистка — настоящая кнопка-СОСЕД триггера, как у `Select`. Прежняя версия
  теста считала кнопки на странице и ждала единицу: вложенную кнопку она бы
  поймала, но ровно так же проходила, когда очистки нет вовсе.
*/
test("clearing is a real button next to the trigger, not inside it", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  const clear = screen.getByRole("button", { name: "Clear" });
  expect(field().contains(clear)).toBe(false);

  await user.click(clear);
  expect(screen.getByText("Select a node")).toBeTruthy();
  // Очистка не раскрывает поле: иначе каждый сброс открывал бы дерево.
  expect(screen.queryByRole("treegrid")).toBeNull();
});

test("Backspace clears the field as well as Delete", async () => {
  const user = userEvent.setup();
  render(<Org initial={["finance"]} clearable />);

  field().focus();
  await user.keyboard("{Backspace}");
  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  Ключ, которого нет в `items`, показывается сам собой. Прежде поле говорило
  «ничего не выбрано», очистка была недоступна, а наружу уходило непустое
  значение — три разных ответа на один вопрос одновременно.
*/
test("a key missing from items is shown and can be cleared", async () => {
  const user = userEvent.setup();
  render(<Org initial={["ghost"]} clearable />);

  expect(screen.getByText("ghost")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByText("Select a node")).toBeTruthy();
});

/*
  Поле, вырастающее на пять строк, перестаёт быть полем: хвост сворачивается.
*/
test("more than three chips collapse into a tail", () => {
  render(<Org multiple initial={["direct", "partners", "logistics", "finance"]} />);

  expect(within(field()).getAllByText(/^(Direct sales|Partner network|Logistics)$/)).toHaveLength(
    3
  );
  expect(within(field()).getByText("+1 more")).toBeTruthy();
});

test("a disabled field does not open", async () => {
  const user = userEvent.setup();
  render(<Org disabled />);

  await user.click(field());
  expect(screen.queryByRole("treegrid")).toBeNull();
});

/*
  Два заслона от раскрытия выключенного поля маскировали друг друга: тест падал
  только при снятии обоих. Проверяем каждый по отдельности — через наблюдаемое
  следствие, а не через атрибут.
*/
test("a disabled field keeps both guards: the trigger is off and the popover is pinned shut", async () => {
  const user = userEvent.setup();
  render(<Org disabled />);

  const trigger = field();
  expect(trigger.hasAttribute("disabled")).toBe(true);

  // Даже принудительное нажатие мимо атрибута не раскрывает поле.
  await user.click(trigger);
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(screen.queryByRole("treegrid")).toBeNull();
});

/*
  Пустое дерево — это «данных нет», а не «ничего не найдено»: своего поиска у
  поля нет, и запроса пользователь не делал. Словарь кита разводит эти строки.
*/
test("an empty tree says there is no data, not that a search found nothing", async () => {
  const user = userEvent.setup();
  render(<TreeSelect items={[]} value={[]} onChange={() => {}} aria-label="Division" />);

  await user.click(field());
  expect(await screen.findByText("Empty")).toBeTruthy();
  expect(screen.queryByText("Nothing found")).toBeNull();
});

/* Тип всплывающего обязан совпадать с тем, что внутри: там `treegrid`. */
test("the trigger announces the popup it actually opens", () => {
  render(<Org />);
  expect(field().getAttribute("aria-haspopup")).toBe("grid");
});

test("placeholder overrides the catalogue string", () => {
  render(
    <TreeSelect
      items={ORG}
      value={[]}
      onChange={() => {}}
      aria-label="Division"
      placeholder="Pick a unit"
    />
  );
  expect(screen.getByText("Pick a unit")).toBeTruthy();
  expect(screen.queryByText("Select a node")).toBeNull();
});

test("clearLabel names the clear button", () => {
  render(
    <TreeSelect
      items={ORG}
      value={["finance"]}
      onChange={() => {}}
      aria-label="Division"
      clearable
      clearLabel="Reset division"
    />
  );
  expect(screen.getByRole("button", { name: "Reset division" })).toBeTruthy();
});

/*
  Управляемое раскрытие: без него глубоко лежащий выбранный узел открывается на
  свёрнутом дереве, где на него ничто не указывает.
*/
test("expandedKeys is controlled from outside", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();
  render(
    <TreeSelect
      items={ORG}
      value={[]}
      onChange={() => {}}
      aria-label="Division"
      expandedKeys={["company"]}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(field());
  // Раскрыта только «Компания»: её дети видны, дети «Продаж» — нет.
  expect(await screen.findByRole("row", { name: /^Sales$/ })).toBeTruthy();
  expect(screen.queryByRole("row", { name: /^Direct sales$/ })).toBeNull();
});

/* Ось `multiple` управляет режимом выбора самого дерева, а не только видом поля. */
test("multiple drives the tree selection mode", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Org />);

  await user.click(field());
  expect((await screen.findByRole("treegrid")).getAttribute("aria-multiselectable")).not.toBe(
    "true"
  );
  unmount();

  render(<Org multiple />);
  await user.click(field());
  expect((await screen.findByRole("treegrid")).getAttribute("aria-multiselectable")).toBe("true");
});

/*
  Цикл в `items` — испорченные данные потребителя, но переполнение стека плохой
  способ ему об этом сказать.
*/
test("a cycle in items does not blow the stack", () => {
  const loop: TreeNode = { id: "a", label: "Loop" };
  loop.children = [loop];

  expect(() =>
    render(<TreeSelect items={[loop]} value={["a"]} onChange={() => {}} aria-label="Division" />)
  ).not.toThrow();
  expect(screen.getByText("Loop")).toBeTruthy();
});

/**
 * Выключение поля закрывает панель, а не прячет её.
 *
 * `Popover open={open && !disabled}` гасил показ, но управляемая смена `open` у
 * Radix не зовёт `onOpenChange`: внутреннее состояние оставалось `true`. Форма
 * ушла в отправку — панель исчезла; отправка кончилась — панель вернулась сама,
 * хотя пользователь ничего не нажимал.
 */
test("disabling the field closes the popover for good", async () => {
  const user = userEvent.setup();

  function Host({ disabled }: { disabled: boolean }) {
    return (
      <TreeSelect
        items={ORG}
        value={[]}
        onChange={() => {}}
        aria-label="Division"
        disabled={disabled}
      />
    );
  }

  // Через `rerender`, а НЕ щелчком по соседней кнопке: щелчок мимо панели
  // Radix закрывает её сам, и дефект так не воспроизводится — проверено.
  const { rerender } = render(<Host disabled={false} />);
  await user.click(field());
  expect(screen.getByRole("treegrid")).toBeDefined();

  rerender(<Host disabled />);
  rerender(<Host disabled={false} />);

  expect(screen.queryByRole("treegrid")).toBeNull();
});
