// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { useTableState } from "../src/hooks/useTableState.js";
import { tableStateFromParams, tableStateToParams } from "../src/lib/table-state.js";

afterEach(cleanup);

describe("useTableState: the shape of the state", () => {
  test("the defaults are set in full and not half-empty", () => {
    const { result } = renderHook(() => useTableState());
    const s = result.current.state;

    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(25);
    expect(s.filters).toEqual([]);
    expect(s.selectedKeys.size).toBe(0);
    expect(s.expandedKeys.size).toBe(0);
    expect(s.columnOrder).toEqual([]);
    expect(s.hiddenColumns.size).toBe(0);
    expect(s.sort).toBeUndefined();
  });

  test("the initial state is set by the caller and overrides the defaults", () => {
    const { result } = renderHook(() =>
      useTableState({ pageSize: 50, sort: { column: "name", direction: "ascending" } })
    );

    expect(result.current.state.pageSize).toBe(50);
    expect(result.current.state.sort?.column).toBe("name");
    // Незаданное осталось умолчанием, а не пропало.
    expect(result.current.state.page).toBe(1);
  });

  test("instances are independent", () => {
    const { result: a } = renderHook(() => useTableState());
    const { result: b } = renderHook(() => useTableState());

    act(() => a.current.set({ page: 3 }));
    expect(a.current.state.page).toBe(3);
    expect(b.current.state.page).toBe(1);
  });
});

/**
 * Инварианты — то, ради чего хук существует. Без них тулбар и фильтры завели бы
 * каждый своё состояние, и связи между частями разъехались бы.
 */
describe("useTableState: invariants", () => {
  test("changing the filters resets to the first page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 4 }));
    act(() =>
      result.current.set({ filters: [{ id: "f1", field: "section", value: "Contracts" }] })
    );

    // Иначе пользователь смотрит на четвёртую страницу выборки из десяти строк
    // и читает пустоту как «ничего не найдено».
    expect(result.current.state.page).toBe(1);
  });

  test("changing the sort resets the page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 4 }));
    act(() => result.current.set({ sort: { column: "name", direction: "descending" } }));

    expect(result.current.state.page).toBe(1);
  });

  /** Главный инвариант: обратное поведение срывает массовое действие. */
  test("selection survives both a filter change and a page change", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ selectedKeys: new Set(["1", "2"]) }));
    act(() => result.current.set({ filters: [{ id: "f1", field: "s", value: "v" }] }));
    act(() => result.current.set({ page: 2 }));

    expect([...result.current.state.selectedKeys]).toEqual(["1", "2"]);
  });

  test("density and column visibility do not touch the page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 3 }));
    act(() => result.current.set({ density: "compact" }));
    act(() => result.current.set({ hiddenColumns: new Set(["section"]) }));

    // Сужает выборку фильтр и сортировка, а не оформление.
    expect(result.current.state.page).toBe(3);
  });

  test("an explicit page together with a filter beats the reset", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ filters: [{ id: "f", field: "s", value: "v" }], page: 7 }));
    // Вызывающий сказал прямо — значит он знает, что делает: восстановление
    // состояния из адреса приходит именно так, целиком.
    expect(result.current.state.page).toBe(7);
  });

  test("reset restores the initial state, not an empty one", () => {
    const { result } = renderHook(() => useTableState({ pageSize: 50 }));

    act(() => result.current.set({ page: 3, pageSize: 10 }));
    act(() => result.current.reset());

    expect(result.current.state.page).toBe(1);
    expect(result.current.state.pageSize).toBe(50);
  });
});

describe("useTableState: density", () => {
  const wrapper = (density: "comfortable" | "compact") =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <UiProvider density={density}>{children}</UiProvider>;
    };

  test("without a provider — comfortable", () => {
    const { result } = renderHook(() => useTableState());
    expect(result.current.state.density).toBe("comfortable");
  });

  test("the default comes from the provider", () => {
    const { result } = renderHook(() => useTableState(), { wrapper: wrapper("compact") });
    expect(result.current.state.density).toBe("compact");
  });

  test("an explicit initial value outranks the provider", () => {
    const { result } = renderHook(() => useTableState({ density: "comfortable" }), {
      wrapper: wrapper("compact"),
    });
    expect(result.current.state.density).toBe("comfortable");
  });
});

/**
 * Перенос в адрес — пара ЧИСТЫХ функций: применять их к адресу дело
 * приложения (ADR-0023). У каждого маршрутизатора свои правила записи
 * параметров, и кит, взявшийся их угадывать, ошибётся молча.
 */
describe("carrying state into the address", () => {
  test("wrapping around returns the original", () => {
    const initial = {
      sort: { column: "name", direction: "descending" as const },
      page: 3,
      pageSize: 50,
      filters: [
        { id: "f1", field: "section", value: "Contracts" },
        { id: "f2", field: "section", value: "Reports" },
      ],
      hiddenColumns: new Set(["updated"]),
      columnOrder: ["name", "section"],
      density: "compact" as const,
    };

    expect(tableStateFromParams(tableStateToParams(initial))).toEqual(initial);
  });

  test("defaults are not written into the address", () => {
    const params = tableStateToParams({
      page: 1,
      pageSize: 25,
      filters: [],
      hiddenColumns: new Set(),
      columnOrder: [],
      density: "comfortable",
    });
    // Иначе ссылка на первую страницу без фильтров обрастает шестью
    // параметрами, и скопировать её человеку неудобно.
    expect(params.toString()).toBe("");
  });

  test("selection and expansion do not go into the address", () => {
    const params = tableStateToParams({
      selectedKeys: new Set(["1", "2"]),
      expandedKeys: new Set(["1"]),
    });
    // Список ключей ничем не ограничен по длине, а ссылка, открытая назавтра,
    // отметила бы записи, которых уже нет.
    expect(params.toString()).toBe("");
  });

  test("a colon and a comma inside a value are carried whole", () => {
    const initial = {
      filters: [{ id: "a:b", field: "note", value: "10:30, urgent" }],
    };
    expect(tableStateFromParams(tableStateToParams(initial))).toEqual(initial);
  });

  test.each([
    ["junk in the page", "page=none"],
    ["negative page", "page=-3"],
    ["fractional page", "page=1.5"],
    ["empty sort", "sort="],
    ["filter without parts", "f=broken"],
    ["foreign density", "density=huge"],
  ])("%s does not break parsing and yields no broken state", (_name, query) => {
    const state = tableStateFromParams(new URLSearchParams(query));

    expect(state.page).toBeUndefined();
    expect(state.sort).toBeUndefined();
    expect(state.filters).toBeUndefined();
    expect(state.density).toBeUndefined();
  });

  test("sorting by a column with a colon in its name parses correctly", () => {
    const params = new URLSearchParams("sort=meta:created:desc");
    // Направление отделяется по ПОСЛЕДНЕМУ двоеточию: имя колонки задаёт
    // потребитель, и запрещать ему двоеточие кит не вправе.
    expect(tableStateFromParams(params).sort).toEqual({
      column: "meta:created",
      direction: "descending",
    });
  });

  test("restoring from the address lands in the hook whole, without resetting the page", () => {
    const params = tableStateToParams({
      page: 4,
      filters: [{ id: "f", field: "s", value: "v" }],
    });
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set(tableStateFromParams(params)));

    // Инвариант «фильтр сбрасывает страницу» отменяется явной страницей в том
    // же вызове — иначе восстановление ссылки всегда открывало бы первую.
    expect(result.current.state.page).toBe(4);
    expect(result.current.state.filters).toHaveLength(1);
  });
});

/**
 * Адрес правят руками, и это записано в докстроке `tableStateFromParams`:
 * «мусор не роняет разбор и не даёт сломанного состояния». До волны 26 обещание
 * держалось наполовину — `decodeFilter` звал `decodeURIComponent` без защиты и
 * бросал `URIError` на одном символе `%`.
 *
 * Цена ошибки здесь выше, чем кажется: модуль намеренно без `"use client"` и
 * зовётся на сервере из `searchParams`, то есть это 500 на маршруте, а не
 * кривая таблица. Соседний `hide=%25zz` всё это время разбирался тихо.
 */
describe("a hand-edited address does not bring down the parse", () => {
  test("a filter with a malformed escape is dropped, not thrown on", () => {
    // `URLSearchParams` превращает `%25` в `%`, после чего `decodeURIComponent`
    // видит `%zz` — незавершённую escape-последовательность.
    const params = new URLSearchParams("f=%25zz%3Aa%3Ab");

    expect(() => tableStateFromParams(params)).not.toThrow();
    // Ключ не пишется вовсе, когда фильтров не осталось, — умолчания в
    // результат не попадают, как и при разборе адреса без `f`.
    expect(tableStateFromParams(params).filters).toBeUndefined();
  });

  test("a good filter survives a broken neighbour in the same parameter", () => {
    const params = new URLSearchParams("f=%25zz%3Aa%3Ab&f=f1%3Asection%3AContracts");

    expect(tableStateFromParams(params).filters).toEqual([
      { id: "f1", field: "section", value: "Contracts" },
    ]);
  });

  test("a malformed escape in the remaining parameters is already tolerated", () => {
    // Сторож против регресса в обратную сторону: `hide` и `cols` не кодируются
    // и потому не бросали никогда — правка фильтра не должна это изменить.
    const state = tableStateFromParams(new URLSearchParams("hide=%25zz&cols=%25zz"));

    expect(state.hiddenColumns).toEqual(new Set(["%zz"]));
    expect(state.columnOrder).toEqual(["%zz"]);
  });
});

/**
 * Смена размера страницы сбрасывает страницу.
 *
 * `pageSize` — единственное поле хука, которое меняет число страниц напрямую, и
 * в условие сброса оно не входило. 200 строк, `pageSize` 25 → 100 со страницы 8:
 * `slice(700, 800)` пуст, и таблица рисует «ничего не найдено». Это дословно тот
 * отказ, ради предотвращения которого инвариант и заведён («видит пустоту,
 * приняв её за „ничего не найдено“»). Само не чинится: `Pagination` зажимает
 * страницу только у себя и подсвечивает «2», пока таблица пуста.
 */
describe("changing the page size", () => {
  test("resets the page", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    act(() => result.current.set({ pageSize: 100 }));

    expect(result.current.state.page).toBe(1);
  });

  test("density still leaves the user where they were", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    act(() => result.current.set({ density: "compact" }));

    expect(result.current.state.page).toBe(8);
  });

  test("an explicit page in the same patch wins", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    // Тот же приём, что у фильтров: вызывающий, назвавший страницу явно,
    // знает, чего хочет.
    act(() => result.current.set({ pageSize: 100, page: 3 }));

    expect(result.current.state.page).toBe(3);
  });
});

/**
 * Подпись фильтра переживает адрес.
 *
 * Кодировались только `id`, `field` и `value`. `FilterBarAdd` всегда
 * проставляет `label` («Section: Contracts»), и пользователь, скопировавший
 * ссылку и открывший её заново, получал «section: contracts» — сырые
 * идентификаторы бэкенда. Round-trip-тест выше этого не ловил, потому что
 * брал фильтры без подписи.
 */
test("a filter label survives the round trip", () => {
  const filters = [{ id: "f1", field: "section", value: "contracts", label: "Section: Contracts" }];

  expect(tableStateFromParams(tableStateToParams({ filters })).filters).toEqual(filters);
});

test("a link saved before the label existed still parses", () => {
  // Три части — ссылка из прошлой версии. Отбрасывать её нельзя.
  const params = new URLSearchParams("f=f1%3Asection%3Acontracts");

  expect(tableStateFromParams(params).filters).toEqual([
    { id: "f1", field: "section", value: "contracts" },
  ]);
});

/**
 * Диапазон — необязательное `to` у токена (ADR-0063). В адресе это ПЯТАЯ часть:
 * ссылки из трёх и четырёх частей читаются как раньше, а `to` присутствует
 * тогда и только тогда, когда пятая часть есть — даже пустая.
 */
describe("a range filter in the address", () => {
  test.each([
    ["both bounds", { id: "r", field: "amount", value: "50", to: "100", label: "Amount: 50–100" }],
    [
      "lower bound only",
      { id: "r", field: "amount", value: "50", to: "", label: "Amount: from 50" },
    ],
    [
      "upper bound only",
      { id: "r", field: "amount", value: "", to: "100", label: "Amount: to 100" },
    ],
    ["no label", { id: "r", field: "date", value: "2026-03-01", to: "2026-03-12" }],
    ["colons inside bounds", { id: "r", field: "t", value: "10:30", to: "12:45" }],
  ])("%s survives the round trip", (_name, filter) => {
    expect(tableStateFromParams(tableStateToParams({ filters: [filter] })).filters).toEqual([
      filter,
    ]);
  });

  test("an empty upper bound stays a range and does not turn into equality", () => {
    const filter = { id: "r", field: "amount", value: "50", to: "" };
    const [back] = tableStateFromParams(tableStateToParams({ filters: [filter] })).filters ?? [];

    // `to: ""` — «от 50» без верха; потерять ключ значило бы превратить
    // диапазон в равенство «сумма = 50».
    expect(back).toHaveProperty("to", "");
  });

  test("an equality filter gets no fifth part", () => {
    const params = tableStateToParams({
      filters: [{ id: "f", field: "s", value: "v", label: "S: v" }],
    });

    expect(params.get("f")!.split(":")).toHaveLength(4);
  });

  test("a link of three or four parts still reads as equality, without `to`", () => {
    const state = tableStateFromParams(
      new URLSearchParams("f=a%3Asection%3Ax&f=b%3Asection%3Ay%3AY")
    );

    expect(state.filters).toEqual([
      { id: "a", field: "section", value: "x" },
      { id: "b", field: "section", value: "y", label: "Y" },
    ]);
    expect(state.filters![0]).not.toHaveProperty("to");
  });

  test("a sixth part drops the filter, a broken escape in `to` drops it too", () => {
    const params = new URLSearchParams();
    params.append("f", "a:b:c:d:e:f");
    params.append("f", "a:b:c:d:%zz");
    params.append("f", "ok:amount:1::2");

    expect(() => tableStateFromParams(params)).not.toThrow();
    expect(tableStateFromParams(params).filters).toEqual([
      { id: "ok", field: "amount", value: "1", to: "2" },
    ]);
  });
});

describe("a range filter in the hook", () => {
  test("adding a range resets the page, and the selection survives", () => {
    const { result } = renderHook(() => useTableState({ page: 4 }));

    act(() => result.current.set({ selectedKeys: new Set(["1"]) }));
    act(() =>
      result.current.set({
        filters: [{ id: "r", field: "amount", value: "50", to: "100", label: "Amount: 50–100" }],
      })
    );

    // Диапазон — такая же смена выборки, как и равенство (ADR-0023, ADR-0063).
    expect(result.current.state.page).toBe(1);
    expect(result.current.state.filters[0]).toMatchObject({ to: "100" });
    expect([...result.current.state.selectedKeys]).toEqual(["1"]);
  });

  test("a range restored from the address lands whole, with its page", () => {
    const params = tableStateToParams({
      page: 3,
      filters: [{ id: "r", field: "date", value: "2026-03-01", to: "" }],
    });
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set(tableStateFromParams(params)));

    expect(result.current.state.page).toBe(3);
    expect(result.current.state.filters).toEqual([
      { id: "r", field: "date", value: "2026-03-01", to: "" },
    ]);
  });
});
