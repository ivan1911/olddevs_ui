// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Transfer, type TransferItem } from "../src/components/inputs/Transfer.js";

afterEach(cleanup);

const RIGHTS: TransferItem[] = [
  { id: "reports", label: "View reports" },
  { id: "export", label: "Export data" },
  { id: "roles", label: "Manage roles" },
  { id: "delete", label: "Delete records", disabled: true },
  { id: "hooks", label: "Configure webhooks" },
];

function Rights({ initial = [] as string[], searchable = false }) {
  const [value, setValue] = useState(initial);
  return <Transfer items={RIGHTS} value={value} onChange={setValue} searchable={searchable} />;
}

/*
  Имя списка складывается из подписи колонки и счётчика: число на экране есть, и
  в речи оно тоже должно быть. Отсюда поиск по началу имени.
*/
const available = () => screen.getByRole("listbox", { name: /^Available/ });
const selected = () => screen.getByRole("listbox", { name: /^Selected/ });
const toRight = () => screen.getByRole("button", { name: "Move to selected" });
const toLeft = () => screen.getByRole("button", { name: "Move to available" });

test("an item moves to the other column and disappears from the first", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(toRight());

  expect(within(selected()).getByRole("option", { name: "Export data" })).toBeTruthy();
  expect(within(available()).queryByRole("option", { name: "Export data" })).toBeNull();
});

test("an item moves back", async () => {
  const user = userEvent.setup();
  render(<Rights initial={["export"]} />);

  await user.click(within(selected()).getByRole("option", { name: "Export data" }));
  await user.click(toLeft());

  expect(within(available()).getByRole("option", { name: "Export data" })).toBeTruthy();
  expect(within(selected()).queryByRole("option", { name: "Export data" })).toBeNull();
});

/*
  Счётчик проверяется через доступное имя колонки, а не через класс вёрстки:
  привязка к `.text-caption` ломалась бы от смены шкалы кегля, не меняя
  поведения, и не утверждала бы, какой колонке принадлежит число.
*/
test("the counters follow the columns", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  expect(screen.getByRole("listbox", { name: "Available 5" })).toBeTruthy();
  expect(screen.getByRole("listbox", { name: "Selected 0" })).toBeTruthy();

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.click(toRight());

  expect(screen.getByRole("listbox", { name: "Available 4" })).toBeTruthy();
  expect(screen.getByRole("listbox", { name: "Selected 1" })).toBeTruthy();
});

/*
  Счётчик — вся колонка, а не то, что осталось после поиска: он отвечает на
  вопрос «сколько всего доступно», а фильтр это взгляд на них.
*/
test("the counter counts the column, not the filtered view", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("listbox", { name: "Available 5" })).toBeTruthy();
});

/*
  Недоступный элемент показан, но не переносится: скрыть его значило бы соврать
  про состав прав, а перенести — обойти запрет.
*/
test("a disabled item is shown but never moves", async () => {
  const user = userEvent.setup();

  // Кликом выключенный элемент не выделяется вовсе, поэтому «кликнуть и
  // убедиться, что кнопка мертва» проходило бы и на компоненте без всякой
  // защиты: до клика она мертва точно так же. Единственный содержательный
  // сценарий — выделить доступный элемент и выключить его пропом.
  function Switchable() {
    const [items, setItems] = useState(RIGHTS);
    const [value, setValue] = useState<string[]>([]);
    return (
      <>
        <button
          onClick={() =>
            setItems((list) =>
              list.map((item) => (item.id === "export" ? { ...item, disabled: true } : item))
            )
          }
        >
          Revoke
        </button>
        <Transfer items={items} value={value} onChange={setValue} />
      </>
    );
  }
  render(<Switchable />);

  expect(
    within(available())
      .getByRole("option", { name: "Delete records" })
      .getAttribute("aria-disabled")
  ).toBe("true");

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);

  await user.click(screen.getByRole("button", { name: "Revoke" }));
  expect(toRight().hasAttribute("disabled")).toBe(true);

  await user.click(toRight());
  expect(within(selected()).queryByRole("option", { name: "Export data" })).toBeNull();
});

/*
  `Ctrl`/`Cmd`+`A` внутри списка — штатная клавиша react-aria, и она отдаёт
  строку `'all'`, а не набор ключей. Пока она возвращала пустой список,
  «выделить всё и перенести» гасило обе кнопки: самый частый сценарий
  оказывался тупиковым.
*/
test("select-all inside a column moves the whole column", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.keyboard("{Control>}a{/Control}");

  expect(toRight().hasAttribute("disabled")).toBe(false);
  await user.click(toRight());

  // Недоступный «Delete records» остаётся слева: выделить всё — не значит
  // обойти запрет.
  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(selected()).getAllByRole("option")).toHaveLength(4);
});

/*
  Кнопка не должна переносить то, чего на экране нет: пользователь отвечает за
  то, что видит. До починки скрытый фильтром выделенный элемент переезжал
  вместе с видимыми.
*/
test("a selection hidden by the filter does not travel with the visible ones", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(toRight().hasAttribute("disabled")).toBe(true);
});

/*
  Подсветка живёт внутри и переживает внешнюю смену `value`. Ключ, уехавший в
  другую колонку чужой правкой, оставался «переносимым» — и приезжал в `value`
  вторым экземпляром, невидимым на экране.
*/
test("an external change to value does not let a stale selection duplicate a key", async () => {
  const user = userEvent.setup();
  const seen: string[][] = [];

  function Outside() {
    const [value, setValue] = useState<string[]>([]);
    seen.push(value);
    return (
      <>
        <button onClick={() => setValue(["export"])}>Grant outside</button>
        <Transfer items={RIGHTS} value={value} onChange={setValue} />
      </>
    );
  }
  render(<Outside />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(screen.getByRole("button", { name: "Grant outside" }));

  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(seen.at(-1)).toEqual(["export"]);
});

test("the move buttons are off while there is nothing to move", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(toLeft().hasAttribute("disabled")).toBe(true);

  await user.click(within(available()).getByRole("option", { name: "Manage roles" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);
  expect(toLeft().hasAttribute("disabled")).toBe(true);
});

/*
  Фокус после переноса проверяется В БРАУЗЕРЕ, а не здесь (ADR-0012): react-aria
  делегирует его с контейнера внутрь коллекции, и в jsdom этот путь достоверно
  не воспроизводится. Прежняя версия теста была зелёной лишь потому, что
  принимающая колонка в фикстуре была пуста — делегировать было некуда. См.
  `tests-visual/interactions.spec.ts`.
*/

/*
  Следствие того же правила: перенесённые становятся выделением там, куда
  приехали, — поэтому вернуть их можно не выделяя заново.
*/
test("moved items arrive selected, so the return move needs no reselection", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Export data" }));
  await user.click(toRight());

  expect(toLeft().hasAttribute("disabled")).toBe(false);

  await user.click(toLeft());
  expect(within(available()).getByRole("option", { name: "Export data" })).toBeTruthy();
});

/*
  Порядок целевой колонки — это порядок назначения, а не порядок `items`.
  Иначе список назначенных прав перетасовывался бы сам собой.
*/
test("the target column keeps the order in which items were added", async () => {
  const user = userEvent.setup();
  render(<Rights />);

  await user.click(within(available()).getByRole("option", { name: "Configure webhooks" }));
  await user.click(toRight());
  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  await user.click(toRight());

  const labels = within(selected())
    .getAllByRole("option")
    .map((node) => node.textContent);
  expect(labels).toEqual(["Configure webhooks", "View reports"]);
});

test("search filters a column without touching the other one", async () => {
  const user = userEvent.setup();
  render(<Rights initial={["export"]} searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "roles");

  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(selected()).getAllByRole("option")).toHaveLength(1);
});

test("a search with no matches says so instead of showing an empty box", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "zzz");
  expect(within(available()).getByText("Nothing found")).toBeTruthy();
});

/*
  Без имени пользователь AT слышит два несвязанных списка и две стрелки между
  ними, и что это один вопрос, а не два, ниоткуда не следует. Безымянная группа
  при этом хуже её отсутствия — то же правило, что у `ButtonGroup`.
*/
test("a name turns the pair into one announced group", () => {
  const { rerender } = render(
    <Transfer items={RIGHTS} value={[]} onChange={() => {}} aria-label="Role permissions" />
  );
  expect(screen.getByRole("group", { name: "Role permissions" })).toBeTruthy();

  rerender(<Transfer items={RIGHTS} value={[]} onChange={() => {}} />);
  expect(screen.queryByRole("group")).toBeNull();
});

/*
  Свой `disabled` — про весь контрол, в отличие от `TransferItem.disabled`,
  который про один показанный, но непереносимый элемент.
*/
/*
  Выделение делается ДО выключения: иначе кнопка мертва и так, потому что
  переносить нечего, и тест был бы истинным при любом коде.
*/
test("a disabled transfer moves nothing at all", async () => {
  const user = userEvent.setup();

  let turnOff = () => {};
  function Switchable() {
    const [off, setOff] = useState(false);
    const [value, setValue] = useState<string[]>([]);
    turnOff = () => setOff(true);
    return <Transfer items={RIGHTS} value={value} onChange={setValue} disabled={off} />;
  }
  render(<Switchable />);

  await user.click(within(available()).getByRole("option", { name: "View reports" }));
  expect(toRight().hasAttribute("disabled")).toBe(false);

  act(() => turnOff());
  expect(toRight().hasAttribute("disabled")).toBe(true);
  expect(toLeft().hasAttribute("disabled")).toBe(true);
});

test("searchable is an axis: without it there is no search field", () => {
  render(<Rights />);
  expect(screen.queryByRole("textbox")).toBeNull();
});

/*
  Запрос набран строчными, а подпись начинается с прописной: только так проверка
  ловит потерю приведения регистра у ПОДПИСИ. Запрос приводится отдельно, и
  «ROLES» против «Manage roles» прошло бы и без него.
*/
test("search ignores case on the label, not just on the query", async () => {
  const user = userEvent.setup();
  render(<Rights searchable />);

  await user.type(screen.getByRole("textbox", { name: "Search in Available" }), "manage");
  expect(within(available()).getAllByRole("option")).toHaveLength(1);
  expect(within(available()).getByRole("option", { name: "Manage roles" })).toBeTruthy();
});
