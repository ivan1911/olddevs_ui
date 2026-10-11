// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../src/components/table/DataTable.js";
import { Table } from "../src/components/content/Table.js";
import { DEFAULT_TABLE_STATE, type TableState } from "../src/lib/table-state.js";

afterEach(cleanup);

const ROWS = [
  { id: "1", name: "Contract", section: "Contracts" },
  { id: "2", name: "Report", section: "Reports" },
];

const COLUMNS = [
  { id: "name", header: "Name", cell: (r: (typeof ROWS)[number]) => r.name },
  { id: "section", header: "Section", cell: (r: (typeof ROWS)[number]) => r.section },
];

const state = (patch: Partial<TableState> = {}): TableState => ({
  ...DEFAULT_TABLE_STATE,
  density: "comfortable",
  ...patch,
});

const base = {
  "aria-label": "Documents",
  columns: COLUMNS,
  items: ROWS,
  onStateChange: () => {},
};

describe("DataTable: column preferences", () => {
  /**
   * Спрятанный классом столбец остаётся в дереве доступности заголовком без
   * ячеек, и скринридер читает таблицу с колонкой, которой на экране нет.
   */
  test("a hidden column stays out of the markup instead of being hidden by a class", () => {
    render(<DataTable {...base} state={state({ hiddenColumns: new Set(["section"]) })} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Section" })).toBeNull();
    expect(screen.queryByText("Contracts")).toBeNull();
  });

  test("the column order is applied", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["section", "name"] })} />);
    const headings = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headings).toEqual(["Section", "Name"]);
  });

  test("an empty order keeps the declaration order", () => {
    render(<DataTable {...base} state={state()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Section",
    ]);
  });

  /**
   * Регрессия. Порядок из адреса перечислял только часть колонок, и `flatMap`
   * выбрасывал остальные: ссылка, сохранённая до появления новой колонки,
   * показывала урезанную таблицу — и выглядело это как рабочая таблица.
   */
  test("a partial order does not drop columns, it appends the rest", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["section"] })} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Section",
      "Name",
    ]);
  });

  test("an unknown id in the order is skipped", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["obsolete", "section"] })} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Section",
      "Name",
    ]);
  });

  /**
   * Панель настроек снять последнюю не даёт, но из адреса это состояние
   * достижимо в обход: `?hide=` со всеми колонками давал таблицу без единого
   * заголовка.
   */
  test("hiding ALL columns is ignored — there is no table without columns", () => {
    render(<DataTable {...base} state={state({ hiddenColumns: new Set(["name", "section"]) })} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  test("density changes the class, not the structure", () => {
    const { container, rerender } = render(<DataTable {...base} state={state()} />);
    const before = container.querySelectorAll("td").length;

    rerender(<DataTable {...base} state={state({ density: "compact" })} />);
    expect(container.querySelector("table")?.className).toContain("[&_td]:py-1");
    expect(container.querySelectorAll("td").length).toBe(before);
  });
});

/**
 * Ради этого блока в ADR-0022 и переписан плоский порядок состояний: на смене
 * страницы данные уже на экране, и скелет вместо них — скачок на каждом шаге.
 */
describe("DataTable: loading, emptiness, error", () => {
  test("loading without data gives a skeleton and the header stays", () => {
    const { container } = render(<DataTable {...base} items={[]} loading state={state()} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByRole("row", { name: /Contract/ })).toBeNull();
  });

  test("loading WITH data leaves it in place under aria-busy", () => {
    const { container } = render(<DataTable {...base} loading state={state()} />);
    // Данные никуда не делись — таблица не схлопнулась в скелет.
    expect(screen.getByText("Contract")).toBeTruthy();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  test("an error replaces the body even when data is there", () => {
    render(<DataTable {...base} error={<span>Could not load</span>} state={state()} />);
    // Показанные при ошибке данные врут: отличить устаревшие от актуальных
    // пользователь не может.
    expect(screen.getByText("Could not load")).toBeTruthy();
    expect(screen.queryByText("Contract")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
  });

  test("an error outranks loading", () => {
    render(<DataTable {...base} items={[]} loading error={<span>Error</span>} state={state()} />);
    expect(screen.getByText("Error")).toBeTruthy();
  });

  test("empty shows only when loading is over and there is no error", () => {
    render(<DataTable {...base} items={[]} emptyText="Nothing found" state={state()} />);
    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});

describe("DataTable: state goes outwards", () => {
  test("without selectable there is no checkbox column — the Table rule is not cancelled", () => {
    render(<DataTable {...base} state={state()} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("selection is reported as a patch", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        {...base}
        selectable
        onStateChange={onStateChange}
        state={state({ selectedKeys: new Set() })}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[1]!);
    expect(onStateChange).toHaveBeenCalledWith({ selectedKeys: new Set(["1"]) });
  });

  test("without renderDetail the expansion axis stays off", () => {
    render(<DataTable {...base} state={state({ expandedKeys: new Set(["1"]) })} />);
    // Ось включается наличием пропа у `Table`, и надстройка это правило не ломает.
    expect(screen.queryByRole("button", { name: /details/ })).toBeNull();
  });

  test("with renderDetail expansion goes down and back", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        {...base}
        onStateChange={onStateChange}
        renderDetail={(r) => <span>Details {r.name}</span>}
        state={state({ expandedKeys: new Set(["1"]) })}
      />
    );

    expect(screen.getByText("Details Contract")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(onStateChange).toHaveBeenCalledWith({ expandedKeys: new Set() });
  });

  test("the toolbar renders above the table", () => {
    render(<DataTable {...base} toolbar={<div>Bar</div>} state={state()} />);
    expect(screen.getByText("Bar")).toBeTruthy();
  });
});

/**
 * Ось выделения `Table`.
 *
 * Два дефекта одного механизма, оба найдены ревью волны 26 и оба не покрывались
 * ничем: в `tests/` `selectable` и `renderDetail` не встречались вместе ни разу.
 */
describe("the selection axis keeps what it was given", () => {
  test("selecting all adds the current page instead of replacing everything", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    // Выделение переживает смену страницы — это главный инвариант, объявленный
    // в докстроке `useTableState`. «Выделить всё» отдавало наружу ТОЛЬКО
    // текущую страницу, и три отметки со страницы 1 исчезали молча: массовое
    // удаление применялось к двум записям вместо пяти.
    render(
      <Table
        aria-label="Documents"
        items={[
          { id: "3", name: "Third" },
          { id: "4", name: "Fourth" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set(["1", "2"])}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]!);

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2", "3", "4"]));
  });

  test("clearing all removes only the current page", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <Table
        aria-label="Documents"
        items={[
          { id: "3", name: "Third" },
          { id: "4", name: "Fourth" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set(["1", "2", "3", "4"])}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]!);

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2"]));
  });

  test("a detail row is not selectable and its synthetic key never leaves", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    // `od-detail:` — внутренний префикс, разведённый как раз чтобы деталь не
    // столкнулась со строкой. Наружу он уходить не может: `SelectionBar`
    // посчитал бы его выбранной записью, а массовое действие ушло бы на бэкенд
    // с идентификатором, которого нет ни в одной записи.
    render(
      <Table
        aria-label="Documents"
        items={[{ id: "1", name: "First" }]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set<string>()}
        onSelectionChange={onSelectionChange}
        renderDetail={() => <span>Detail body</span>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );

    await user.click(screen.getByText("Detail body"));

    /*
      Щелчок по детали не даёт события выделения ВООБЩЕ.

      Раньше он его давал — с синтетическим ключом внутри, — и проверка ловила
      утечку на выходе. Теперь детальные строки вычеркнуты из коллекции
      (`disabledKeys` + `disabledBehavior="selection"`), то есть выделяться им
      нечем: фильтр на выходе остался страховкой. Заодно это чинит флажок
      «выделить всё», который без этого не снимался никогда.
    */
    expect(onSelectionChange).not.toHaveBeenCalled();
    for (const call of onSelectionChange.mock.calls) {
      for (const key of call[0] as Set<string>) {
        expect(String(key).startsWith("od-detail:")).toBe(false);
      }
    }

    // И деталь не выглядит выбранной: выделение управляемое, а в него ключ
    // детали не попал — значит, кольца выбора на ней тоже нет.
    const detailRow = screen.getByText("Detail body").closest("tr")!;
    expect(detailRow.getAttribute("aria-selected")).toBe("false");
  });
});

/**
 * Ошибка загрузки объявляется вслух.
 *
 * Текст ошибки подставлялся в `emptyText` и попадал внутрь `renderEmptyState` —
 * обычный `div` без живой области. Пользователь клавиатуры жал «Обновить»,
 * запрос падал, строки исчезали, на их месте появлялся текст — и не
 * произносилось НИЧЕГО: таблица молча пустела и читалась как «ничего не
 * найдено». Докстрока компонента берёт состояние ошибки на себя, значит и
 * объявление — его ответственность.
 */
test("a load error is announced, an empty result is not", () => {
  const { rerender } = render(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={[]}
      error="Could not load"
      state={state()}
      onStateChange={() => {}}
    />
  );

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Could not load");

  rerender(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={[]}
      emptyText="Nothing found"
      state={state()}
      onStateChange={() => {}}
    />
  );

  // Пустой результат — не сбой, перебивать им речь нельзя.
  expect(screen.queryByRole("alert")).toBeNull();
});

/**
 * Раскрытие работает и без состояния снаружи.
 *
 * Ось включалась одним `renderDetail`, а `toggleExpanded` строил
 * `new Set(undefined)` и звал `onExpandedChange?.()` в никуда: рисовалась живая
 * на вид кнопка с `aria-expanded="false"` и рабочим наведением, клик не делал
 * ничего. Три пропа необязательны независимо, поэтому компилятор молчал — тот
 * самый «недоступный список, который выглядит рабочим», о котором предупреждает
 * докстрока `SortableList`.
 */
test("renderDetail alone gives a WORKING expander, not a dead one", async () => {
  const user = userEvent.setup();
  render(
    <Table
      aria-label="Documents"
      items={[{ id: "1", name: "First" }]}
      columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
      renderDetail={() => <span>Detail</span>}
    />
  );

  // Кнопка есть — простая форма вызова остаётся, — но теперь она РАБОТАЕТ:
  // состояние держится внутри, пока его не ведут снаружи.
  await user.click(screen.getByRole("button", { expanded: false }));
  expect(screen.getByText("Detail")).toBeDefined();
});

test("the full trio draws a working expander", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();

  render(
    <Table
      aria-label="Documents"
      items={[{ id: "1", name: "First" }]}
      columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
      renderDetail={() => <span>Detail</span>}
      expandedKeys={new Set<string>()}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getByRole("button", { expanded: false }));
  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["1"]));
});

/**
 * Ложный `error` не гасит таблицу с данными.
 *
 * `error != null` истинно для `false`, а `error={isError && <Text/>}` — самая
 * частая идиома условного рендера. При отсутствии ошибки строки заменялись
 * пустым телом, и таблица С ДАННЫМИ показывала пустоту плюс `role="alert"` без
 * текста. Волна завела `hasContent` ровно против этого, и здесь его пропустили.
 */
test.each([false, "", null, undefined])("error=%o leaves the rows alone", (error) => {
  render(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={ROWS}
      error={error as never}
      state={state()}
      onStateChange={() => {}}
    />
  );

  expect(screen.getByText("Contract")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

/**
 * «Выделить всё» снимается тем же флажком — даже когда строка раскрыта.
 *
 * Детальная строка входила в подсчёт `isSelectAll` у react-aria, но попасть в
 * выделение не могла (её ключ вычитается на выходе), поэтому «выделено всё» не
 * наступало НИКОГДА: флажок шапки всегда шёл по ветке `selectAll`, и снять
 * выделение им было нельзя вовсе. Сочетание стало достижимым в самой простой
 * форме вызова после того, как раскрытие заработало без внешнего состояния.
 */
test("select all is reversible with an expanded detail row", async () => {
  const user = userEvent.setup();

  function Host() {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    return (
      <Table
        aria-label="Documents"
        items={[
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={selected}
        onSelectionChange={(keys) => setSelected(keys as Set<string>)}
        renderDetail={() => <span>Detail</span>}
      />
    );
  }

  render(<Host />);
  await user.click(screen.getAllByRole("button", { expanded: false })[0]!);

  const header = screen.getAllByRole("checkbox")[0]!;
  const checked = () =>
    screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked).length;

  await user.click(header);
  expect(checked()).toBeGreaterThan(0);

  await user.click(header);
  expect(checked()).toBe(0);
});
