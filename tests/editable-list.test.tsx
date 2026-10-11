// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  EditableList,
  type EditableListHandle,
  type EditableListItem,
} from "../src/components/content/EditableList.js";

afterEach(cleanup);

const rows: EditableListItem[] = [
  { id: "1", value: "First" },
  { id: "2", value: "Second" },
  { id: "3", value: "Third" },
];

const base = {
  onReorder: () => {},
  onValueChange: () => {},
  editLabel: (item: EditableListItem) => `Rename ${item.value}`,
  "aria-label": "Order",
} as const;

/*
  ЗДЕСЬ ТОЛЬКО РАЗМЕТКА, ИМЕНА И ОТСУТСТВИЕ ХРАНЕНИЯ.

  Переходы фокуса и спор за клавиши со списком проверяются в живом браузере
  (`tests-visual/interactions.spec.ts`), и это не перестраховка: коллекция
  react-aria в jsdom монтирует содержимое строки иначе, а `document
  .activeElement` после размонтирования ведёт себя не так, как в браузере. Все
  три дефекта, найденные при сборке компонента, jsdom пропустил бы молча.
*/

test("every row has a drag handle", () => {
  render(<EditableList items={rows} {...base} />);

  // Без `<Button slot="drag">` строка таскается мышью, а с клавиатуры не
  // берётся вовсе — react-aria лишь предупреждает в консоль (ADR-0028).
  expect(screen.getAllByRole("button", { name: /Drag/ })).toHaveLength(3);
});

test("the handle name does not repeat the row label", () => {
  render(<EditableList items={rows} {...base} />);

  // Подпись строки библиотека дописывает сама: «Перетащить Первая».
  expect(screen.getAllByRole("button")[0]!.getAttribute("aria-label")).toBe("Drag");
});

test("the list is named and the rows are in place", () => {
  render(<EditableList items={rows} {...base} aria-label="Task order" />);

  expect(screen.getByRole("grid", { name: "Task order" })).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("the list has no live region of its own", () => {
  const { container } = render(<EditableList items={rows} {...base} />);

  // Перетаскивание объявляет react-aria, локализованно; своя область
  // дублировала бы её объявления, а появление добавленной строки объявляет
  // потребитель — у него для этого уже есть своя область.
  expect(container.querySelector("[aria-live]")).toBeNull();
});

test("the component stores neither the order nor the values", async () => {
  const { rerender } = render(<EditableList items={rows} {...base} />);
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("First");

  // Порядок приходит пропом и уходит наружу целиком — как сортировка у таблицы
  // (ADR-0023).
  rerender(<EditableList items={[rows[2]!, rows[0]!, rows[1]!]} {...base} />);
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("Third");

  // Значение — тоже проп. Компонент, хранящий подтверждённое, показывал бы своё
  // после отказа сервера сохранить.
  rerender(<EditableList items={[{ id: "1", value: "Renamed outside" }]} {...base} />);
  // Ждём конца ухода: две пропавшие строки доживают его на своих местах
  // (OLDSUI-14), и до конца в списке лежит прежний порядок.
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1));
  expect(screen.getAllByRole("row")[0]!.textContent).toContain("Renamed outside");
});

test("an empty value shows the empty label", () => {
  render(<EditableList items={[{ id: "1", value: "" }]} {...base} />);

  // Пустое значение — не ошибка данных: строка обязана остаться видимой и
  // правимой, иначе исправить её нечем.
  expect(screen.getByText("Not set")).toBeTruthy();

  // И она обязана остаться ИМЕНОВАННОЙ. Пустое `textValue` react-aria встречает
  // предупреждением в консоль: строка выглядит рабочей, а набором по первым
  // буквам до неё не добраться.
  expect(screen.getByRole("row", { name: /Not set/ })).toBeTruthy();
});

test("an empty list shows its own state", () => {
  render(<EditableList items={[]} {...base} emptyText="Nothing here" />);

  expect(screen.getByText("Nothing here")).toBeTruthy();
});

test("the add row exists only with the add prop and carries a name", () => {
  const { rerender } = render(<EditableList items={rows} {...base} />);
  expect(screen.queryByRole("textbox")).toBeNull();

  rerender(
    <EditableList
      items={rows}
      {...base}
      add={{ label: "New task", placeholder: "What needs doing?", onAdd: () => {} }}
    />
  );

  // Плейсхолдер именем не считается: он исчезает ровно тогда, когда в поле
  // что-то есть, а имя нужно и до, и после.
  expect(screen.getByRole("textbox", { name: "New task" })).toBeTruthy();
});

test("the row action is the consumer's, not the component's", async () => {
  const onRowAction = vi.fn();
  render(<EditableList items={rows} {...base} onRowAction={onRowAction} />);

  await userEvent.click(screen.getAllByRole("row")[1]!);

  // Одиночный щелчок открывает подробности, а не правку: иначе строке нечем
  // было бы их открыть.
  expect(onRowAction).toHaveBeenCalledWith("2");
});

test("slots render the consumer's content", () => {
  render(
    <EditableList
      items={rows}
      {...base}
      leading={(item) => <span>L{String(item.id)}</span>}
      trailing={(item) => <span>T{String(item.id)}</span>}
    />
  );

  // Флажок, бейдж состояния и кнопки строки — дело потребителя: доменных
  // состояний компонент не знает.
  expect(screen.getByText("L1")).toBeTruthy();
  expect(screen.getByText("T3")).toBeTruthy();
});

/*
  ПРОВЕРКА «ENTER НА РУЧКЕ НЕ ОТКРЫВАЕТ ПРАВКУ» ЖИВЁТ В БРАУЗЕРЕ, а не здесь, и
  это не перестраховка.

  Написанная в jsdom, она начинала настоящий перенос — ровно то, ради чего
  правка и делалась, — а завершить его в jsdom нечем: `Escape` до цели не
  доходит. Пока сессия переноса открыта, react-aria прячет от дерева
  доступности всё, что в ней не участвует, и делает это наблюдателем за DOM:
  под `aria-hidden` уходили контейнеры СЛЕДУЮЩИХ тестов. Падал то один, то
  другой, примерно раз в четыре прогона.

  В `tests-visual/interactions.spec.ts` та же проверка сформулирована сильнее:
  «Enter на ручке начинает перенос, а не правку» — там перенос настоящий и
  доводится до конца.
*/

test("Enter on a control in a slot does not open the editor either", async () => {
  /*
    `leading` и `trailing` — чужая территория. Перехват ловил `Enter` и там:
    флажок выполнения и кнопки действий строки открывали переименование.

    Проверяется именно «правка не открылась». Дальше клавишу разбирает
    `GridList` по своим правилам строки-ячейки, и это уже не наше дело:
    отбирать её у списка компонент не должен.
  */
  const user = userEvent.setup();
  render(
    <EditableList
      items={rows}
      {...base}
      trailing={(item) => (
        <button type="button" onClick={() => {}}>
          Details {item.value}
        </button>
      )}
    />
  );

  screen.getByRole("button", { name: "Details First" }).focus();
  await user.keyboard("{Enter}");

  expect(screen.queryByRole("textbox", { name: "Rename First" })).toBeNull();
});

test("Enter on the row itself still opens the editor", async () => {
  // Обратная сторона той же проверки: сузив условие, легко отобрать у строки
  // то, ради чего перехват и заводился.
  const user = userEvent.setup();
  render(<EditableList items={rows} {...base} />);

  screen.getAllByRole("row")[0]!.focus();
  await user.keyboard("{Enter}");

  expect(screen.getByRole("textbox", { name: "Rename First" })).toBeTruthy();
});

test("pending does not disable the add field", () => {
  /*
    Второй дефект, найденный потребителем: `pending` уходил в `disabled`,
    выключенное поле теряло фокус и обратно его не получало. Серия задач
    подряд обрывалась на первой же, как только добавление идёт через сеть, —
    то есть у всех.
  */
  render(
    <EditableList items={rows} {...base} add={{ label: "New", onAdd: () => {}, pending: true }} />
  );

  const field = screen.getByRole("textbox", { name: "New" }) as HTMLInputElement;

  expect(field.disabled).toBe(false);
  expect(field.getAttribute("aria-busy")).toBe("true");
});

test("rows are not divided by default", () => {
  render(<EditableList items={rows} {...base} />);

  expect(screen.getAllByRole("row")[0]!.className).not.toContain("border-b");
});

test("divided draws a hairline between the rows, not under the last one", () => {
  render(<EditableList items={rows} {...base} divided />);

  // Под последней строкой линия подчеркнула бы список, которого никто не
  // подчёркивал, поэтому у неё рамка снимается вариантом `last:`.
  const row = screen.getAllByRole("row")[0]!.className;
  expect(row).toContain("border-b");
  expect(row).toContain("last:border-b-0");
  // Скругление снимается: под скруглённой строкой линия загибается по углам.
  expect(row).toContain("rounded-none");
});

test("focusAdd puts the caret where the person is about to type", () => {
  const handle = createRef<EditableListHandle>();
  render(
    <EditableList ref={handle} items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );

  handle.current!.focusAdd();

  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "New" }));
});

test("focusAdd on a list without an add row does nothing, silently", () => {
  const handle = createRef<EditableListHandle>();
  render(<EditableList ref={handle} items={rows} {...base} />);

  // Молча, а не исключением: вызывающий приходит из палитры команд и как раз
  // не хочет знать, в каком состоянии список.
  expect(() => handle.current!.focusAdd()).not.toThrow();
});

test("focusAdd selects what is typed only when asked", async () => {
  const handle = createRef<EditableListHandle>();
  render(
    <EditableList ref={handle} items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );
  const field = screen.getByRole("textbox", { name: "New" }) as HTMLInputElement;
  await userEvent.type(field, "Draft");

  handle.current!.focusAdd();
  expect(field.selectionStart).toBe(field.value.length);

  // С `select` повторный вызов начинает ввод заново, а не дописывает к прошлому.
  handle.current!.focusAdd({ select: true });
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
});

test("the row stays a Tailwind group root, and slot content sits inside it", () => {
  render(
    <EditableList
      items={rows}
      {...base}
      trailing={(item) => <button type="button">Delete {item.value}</button>}
    />
  );

  // Обещанный потребителю контракт, а не деталь вёрстки (ADR-0046). Внутри
  // кита `group` на этой строке не используется ничем, поэтому уборка мёртвых
  // классов сняла бы его с чистой совестью — и наведение у потребителя
  // сломалось бы молча: кнопки просто стали бы видны всегда.
  const row = document.querySelector('[data-key="1"]') as HTMLElement;
  expect(row.classList.contains("group")).toBe(true);

  // Вторая половина контракта: содержимое слота лежит ВНУТРИ корня группы —
  // иначе `group-hover:` до него не дотянется, сколько маркер ни держи.
  expect(row.contains(screen.getByRole("button", { name: "Delete First" }))).toBe(true);
});

test("add.leading reserves a column before the field, and nothing when omitted", () => {
  const { rerender } = render(
    <EditableList items={rows} {...base} add={{ label: "New", onAdd: () => {} }} />
  );
  const field = screen.getByRole("textbox", { name: "New" });
  const addRow = field.closest(".flex.items-center") as HTMLElement;

  // Без слота ведущих колонок ровно одна — распорка под ручку перетаскивания.
  expect(addRow.querySelector('[data-testid="add-leading"]')).toBeNull();

  rerender(
    <EditableList
      items={rows}
      {...base}
      add={{
        label: "New",
        onAdd: () => {},
        leading: <span data-testid="add-leading" />,
      }}
    />
  );

  const slot = screen.getByTestId("add-leading");
  expect(addRow.contains(slot)).toBe(true);

  // Порядок важнее присутствия: слот стоит ПОСЛЕ распорки под ручку и ПЕРЕД
  // полем — иначе колонки строки добавления не совпадут с колонками строк.
  const order = Array.from(addRow.querySelectorAll("*"));
  expect(order.indexOf(slot)).toBeLessThan(order.indexOf(field));
});

/*
  КУРСОР ЗАХВАТА — НА ОБЁРТКЕ РУЧКИ, А НЕ НА САМОЙ РУЧКЕ.

  react-aria ставит кнопке переноса `pointer-events: none`: она нужна ему как
  цель для клавиатуры, а не для указателя. Курсор на ней поэтому не
  применяется вовсе — замеряли в живом браузере: `getComputedStyle` у кнопки
  отдаёт `grab`, а `elementFromPoint` в центре ручки возвращает строку с
  `cursor: auto`. Проверка стоит здесь, чтобы класс не «починили» обратно на
  кнопку, где он выглядит уместнее, а работает никак.
*/
test("the grab cursor sits on the handle wrapper, not on the handle itself", () => {
  render(<EditableList items={rows} {...base} />);

  const handle = screen.getAllByRole("button", { name: /Drag/ })[0]!;
  expect(handle.className).not.toContain("cursor-grab");
  expect(handle.parentElement?.className).toContain("cursor-grab");
});

test("a row that cannot be dragged shows no grab cursor", () => {
  render(<EditableList items={[{ id: "1", value: "First", disabled: true }]} {...base} />);

  const handle = screen.getAllByRole("button", { name: /Drag/ })[0]!;
  expect(handle.parentElement?.className).not.toContain("cursor-grab");
});

/*
  УХОД СТРОКИ — OLDSUI-14.

  Анимаций jsdom не исполняет, поэтому здесь они ПОДМЕНЯЮТСЯ: заглушка говорит
  «на строке что-то играет», а конец ухода тест объявляет сам — событием
  `animationend`, тем же самым, по которому строка снимается в браузере. Так
  проверяется ровно то, что написано в компоненте: строка живёт, пока идёт её
  уход. Сам уход — смыкание, ступень, кривая и поведение при `reduce` — меряется
  в живом браузере, в `tests-visual/interactions.spec.ts`.
*/
const realGetAnimations = Element.prototype.getAnimations;

function stubAnimations() {
  Element.prototype.getAnimations = function getAnimations() {
    return [{} as Animation];
  };
}

afterEach(() => {
  Element.prototype.getAnimations = realGetAnimations;
});

const shorter = rows.filter((row) => row.id !== "2");

/** Строка целиком — по тексту внутри неё. */
const rowWith = (text: string) => screen.getByText(text).closest("[data-key]") as HTMLElement;

test("a row gone from items lives until its exit is over", async () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  // Строка на месте, и место под ней ещё занято — смыкание идёт вместе с уходом.
  expect(rowWith("Second")).not.toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(3);

  await act(async () => {
    // Настоящее событие, а не `fireEvent.animationEnd`: синтетический
    // обработчик React на него в jsdom не срабатывает, и компонент слушает
    // поэтому настоящее.
    rowWith("Second").dispatchEvent(new Event("animationend", { bubbles: true }));
  });

  expect(screen.queryByText("Second")).toBeNull();
  expect(screen.getAllByRole("row")).toHaveLength(2);
});

test("the leaving row is inert from the first frame, not at the end of the exit", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  const ghost = rowWith("Second");
  // `inert` разом снимает фокус, щелчок и объявление скринридером: для
  // незрячего запись исчезла в момент действия.
  expect(ghost.hasAttribute("inert")).toBe(true);
  expect(ghost.getAttribute("data-disabled")).toBe("true");
  // Ручка переноса выключена вместе со строкой: уходящую не перетаскивают.
  const handle = within(ghost).getByRole("button", { name: /Drag/ });
  expect((handle as HTMLButtonElement).disabled).toBe(true);
});

test("the exit carries the measured height, because height does not animate from auto", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  const ghost = rowWith("Second");
  expect(ghost.className).toContain("animate-rowout");
  // В jsdom раскладки нет и высота нулевая — проверяется, что переменная
  // ставится вообще, а не чему она равна: значение меряется в браузере.
  expect(ghost.style.getPropertyValue("--row-exit-h")).toMatch(/^\d+px$/);
});

test("a key that came back cancels its own ghost: no two rows with one id", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);
  rerender(<EditableList items={rows} {...base} />);

  expect(screen.getAllByText("Second")).toHaveLength(1);
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("two rows leaving one after another keep their places, not swap them", () => {
  stubAnimations();
  const { rerender } = render(<EditableList items={rows} {...base} />);

  // Сначала уходит вторая, следом — третья. Индекс в прежнем `items` про
  // призрака не знает: он сдвинут на ушедшую, и строки менялись местами.
  rerender(<EditableList items={[rows[0]!, rows[2]!]} {...base} />);
  rerender(<EditableList items={[rows[0]!]} {...base} />);

  expect(screen.getAllByRole("row").map((row) => row.textContent)).toEqual([
    expect.stringContaining("First"),
    expect.stringContaining("Second"),
    expect.stringContaining("Third"),
  ]);
});

test("a row nothing animates is dropped on the next frame, not held forever", async () => {
  // Заглушка НЕ ставится: `getAnimations` в jsdom нет вовсе — то же состояние,
  // что у браузера, которому нечего проигрывать.
  const { rerender } = render(<EditableList items={rows} {...base} />);

  rerender(<EditableList items={shorter} {...base} />);

  await waitFor(() => expect(screen.queryByText("Second")).toBeNull());
  expect(screen.getAllByRole("row")).toHaveLength(2);
});
