// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AvatarGroup } from "../src/components/content/AvatarGroup.js";
import { Badge } from "../src/components/content/Badge.js";
import { Stat } from "../src/components/content/Stat.js";
import { Table } from "../src/components/content/Table.js";

afterEach(cleanup);

const PHOTOS = [
  { id: "1", name: "Night city" },
  { id: "2", name: "Sunset" },
];

test("table axes do not appear without their props", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name }]}
    />
  );

  // Ни флажков выделения, ни кнопок сортировки в разметке нет вовсе — таблица
  // из трёх строк не тащит то, чего у неё не просили.
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBeNull();
});

test("sorting appears with the prop and is announced to a screen reader", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      sort={{ column: "name", direction: "descending" }}
      onSortChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, sortable: true }]}
    />
  );

  expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe(
    "descending"
  );
});

test("selection appears with the prop", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      selectedKeys={new Set(["1"])}
      onSelectionChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name }]}
    />
  );

  // Флажок в шапке плюс по одному на строку.
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
});

test("a count above the limit is collapsed", () => {
  render(<Badge max={99}>{140}</Badge>);

  expect(screen.getByText("99+")).toBeTruthy();
});

test("a dot shows no number", () => {
  const { container } = render(<Badge dot>{5}</Badge>);

  // «Есть новое» без указания сколько: 237 непрочитанных читается хуже отметки.
  expect(container.textContent).toBe("");
});

test("the delta tone is not derived from the sign", () => {
  const { container } = render(
    <Stat label="Unsubscribes" value="184" delta="+12" deltaTone="danger" />
  );

  // Рост отписок — плохая новость, и красить плюс в зелёный автоматически
  // значит врать ровно там, где ошибиться дороже всего.
  expect(container.querySelector(".text-danger-strong")?.textContent).toBe("+12");
});

test("an avatar group is announced as a list of names, not a set of initials", () => {
  render(
    <AvatarGroup
      names={["Ada Lovelace", "Grace Hopper", "Alan Turing", "Barbara Liskov"]}
      max={2}
    />
  );

  const group = screen.getByRole("img");
  expect(group.getAttribute("aria-label")).toBe(
    "Ada Lovelace, Grace Hopper, Alan Turing, Barbara Liskov"
  );
  // Показаны двое и остаток. Инициалы кругов в текст попадают, но от
  // скринридера они скрыты — имя группе даёт `aria-label` выше.
  expect(group.textContent).toContain("+2");
  expect(group.querySelectorAll("[aria-hidden]").length).toBe(3);
});

test("a column id may coincide with a row id", () => {
  render(
    <Table
      aria-label="Photos"
      items={[
        { id: "name", name: "Row with a column-like id" },
        { id: "2", name: "Plain" },
      ]}
      columns={[
        { id: "name", header: "Name", cell: (w) => w.name },
        { id: "second", header: "Second", cell: () => "—" },
      ]}
    />
  );

  // Ключи колонок и строк у react-aria лежат в одном пространстве имён, и
  // совпадение схлопывало одну из них: таблица падала с «Cell count must match
  // column count». Ключи колонок разведены префиксом внутри компонента.
  expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("the internal column key does not leak into aria-sort", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      sort={{ column: "name", direction: "ascending" }}
      onSortChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, sortable: true }]}
    />
  );

  // Снаружи компонент говорит на исходных идентификаторах; префикс — его
  // внутреннее дело. Возврат ключа наружу проверяется в браузере: клик по
  // заголовку в jsdom требует `CSS.escape`, которого там нет.
  expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe(
    "ascending"
  );
});

test("width without resizable reaches the style instead of vanishing", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, width: 200 }]}
    />
  );

  // У react-aria проп `width` действует только внутри `ResizableTableContainer`;
  // в обычной таблице он молча не делал ничего.
  expect((screen.getByRole("columnheader") as HTMLElement).style.width).toBe("200px");
});

/**
 * Ось раскрытия строки (ADR-0022) — единственная, ради которой пришлось трогать
 * `Table`: детальная строка живёт внутри `<tbody>`, между строками коллекции
 * react-aria, и вставить её снаружи невозможно.
 */
describe("Table: row expansion", () => {
  const COLUMNS = [{ id: "name", header: "Name", cell: (w: { name: string }) => w.name }];

  /**
   * Главная проверка правки. Ось включается наличием пропа, и «без пропа
   * ничего не изменилось» — не пожелание, а условие, на котором правку
   * стабильного компонента вообще приняли.
   */
  test("without renderDetail the markup does not change by a single node", () => {
    // react-aria раздаёт узлам автоидентификаторы, и они различны у любых двух
    // рендеров — сравнивать их значило бы сравнивать счётчик, а не разметку.
    const withoutId = (html: string) => html.replace(/react-aria-[\w]+/g, "RA");

    const { container: withoutDetail } = render(
      <Table aria-label="Photos" items={PHOTOS} columns={COLUMNS} />
    );
    const snapshot = withoutId(withoutDetail.innerHTML);
    cleanup();

    const { container: withDetail } = render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    // `expandedKeys` без `renderDetail` не включает ось: показывать нечего.
    expect(withoutId(withDetail.innerHTML)).toBe(snapshot);
  });

  test("the expander column appears with the prop and is named", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Row details" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Show details" })).toHaveLength(2);
  });

  test("a collapsed row keeps no details in the markup", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.queryByText(/Details/)).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3); // шапка + две строки
  });

  test("an expanded row shows the detail and announces the state", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByText("Details Night city")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(4); // прибавилась детальная
    expect(screen.getByRole("button", { name: "Hide details" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
  });

  test("the detail spans the whole row, not a single cell", () => {
    const { container } = render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={[...COLUMNS, { id: "x", header: "X", cell: () => "—" }]}
        selectedKeys={new Set()}
        onSelectionChange={() => {}}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    // Выделение + раскрыватель + две колонки = четыре ячейки.
    expect(container.querySelector("[colspan='4']")).toBeTruthy();
  });

  /** Состояние таблица не хранит — по тому же правилу, что сортировку. */
  test("a click reports outwards and expands nothing itself", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set()}
        onExpandedChange={onExpandedChange}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Show details" })[0]!);
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(["1"]));
    expect(screen.queryByText(/Details/)).toBeNull();
  });

  test("the caller applied it — the detail appeared", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [expanded, setExpanded] = useState<Set<string>>(new Set());
      return (
        <Table
          aria-label="Photos"
          items={PHOTOS}
          columns={COLUMNS}
          renderDetail={(w) => <p>Details {w.name}</p>}
          expandedKeys={expanded}
          onExpandedChange={(keys) => setExpanded(keys as Set<string>)}
        />
      );
    }
    render(<Controlled />);

    await user.click(screen.getAllByRole("button", { name: "Show details" })[0]!);
    expect(screen.getByText("Details Night city")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText(/Details/)).toBeNull();
  });

  /**
   * Без `rowLabel` у двадцати строк двадцать одинаковых «Show details», и в
   * режиме перечисления кнопок скринридер не различит их вовсе. Находка
   * внешней разведки по аудитам доступности.
   */
  test("rowLabel names the row in the expander label", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        rowLabel={(w) => w.name}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Hide details for Night city" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show details for Sunset" })).toBeTruthy();
  });

  test("without rowLabel the label stays generic, not empty", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.getAllByRole("button", { name: "Show details" })).toHaveLength(2);
  });

  test("several rows expand at once — there is no toggle and none is needed", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1", "2"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByText("Details Night city")).toBeTruthy();
    expect(screen.getByText("Details Sunset")).toBeTruthy();
  });
});
