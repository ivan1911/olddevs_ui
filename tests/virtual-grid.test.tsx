// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Selection } from "react-aria-components";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VirtualGrid, type VirtualGridItem } from "../src/components/content/VirtualGrid.js";
import { ContextMenuItem } from "../src/components/overlays/ContextMenu.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/*
  ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. В jsdom нет раскладки: ширина и высота контейнера
  равны нулю, и виртуализатор честно решает, что видимых ячеек нет — в разметке
  их ноль при любом числе элементов. Проверять здесь виртуализацию, число
  колонок или прокрутку бессмысленно: тест либо проходил бы всегда, либо падал
  на исправном компоненте.

  Настоящие проверки — в браузере, `tests-visual/interactions.spec.ts`:
  сколько узлов в DOM при шестистах ячейках, что прокрутка своя и что при
  прокрутке отрисовываются другие ячейки. Разделение — ADR-0012 и ADR-0028.
*/

const cells: VirtualGridItem[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  textValue: `Cell ${i}`,
  content: <div>Cell {i}</div>,
}));

test("the grid is named; the role comes from the behaviour layer", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // `grid` с `data-layout="grid"` — решение react-aria (`GridList`): своими
  // руками роли мы не проставляем, иначе клавиатура перестала бы соответствовать
  // разметке. До OLDSUI-199 здесь был `listbox` (ADR-0028, дополнение).
  const grid = screen.getByRole("grid", { name: "Frames" });
  expect(grid.getAttribute("data-layout")).toBe("grid");
});

test("the container itself owns the scrolling, not the window", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // Фронтовая сетка крутит страницу (`useWindowVirtualizer`); здесь прокрутка
  // своя, и высоту контейнеру обязан задать потребитель — без неё
  // виртуализация не включится вовсе.
  const grid = screen.getByRole("grid");
  expect(grid.className).toContain("overflow-auto");
  expect(grid.className).toContain("h-[300px]");
});

test("an empty grid shows its own state", () => {
  render(
    <VirtualGrid items={[]} aria-label="Frames" emptyText="Nothing here" className="h-[300px]" />
  );
  expect(screen.getByText("Nothing here")).toBeTruthy();
});

test("without the prop there is no selection axis at all", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  // Ось включается ЯВНО: сетка без пропа не обещает выбора и не объявляет его.
  expect(screen.getByRole("grid").hasAttribute("aria-multiselectable")).toBe(false);
});

test("selectionMode puts the axis on the grid, not inside the cell", () => {
  render(
    <VirtualGrid items={cells} aria-label="Frames" selectionMode="multiple" className="h-[300px]" />
  );

  // Выбирается сама ячейка — ролью. Флажок выбора внутри ячейки законен с
  // OLDSUI-199 (`gridcell`), но ось по-прежнему у сетки.
  expect(screen.getByRole("grid").getAttribute("aria-multiselectable")).toBe("true");
});

/*
  ПОВЕДЕНИЕ ЯЧЕЕК. Раскладки в jsdom нет, поэтому размеры контейнера задаются
  заплаткой: виртуализатор получает ненулевое окно и отрисовывает ячейки.
  Число колонок и прокрутка по-прежнему проверяются только в браузере.
*/
function withLayout() {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 600,
    height: 400,
    top: 0,
    left: 0,
    right: 600,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

beforeEach(withLayout);

test("onAction opens a cell on click and on Enter without selecting it", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  const options = screen.getAllByRole("row");
  await user.click(options[1]!);
  expect(onAction).toHaveBeenLastCalledWith(
    "1",
    expect.objectContaining({ rect: expect.anything() })
  );

  options[2]!.focus();
  await user.keyboard("{Enter}");
  expect(onAction).toHaveBeenLastCalledWith(
    "2",
    expect.objectContaining({ rect: expect.anything() })
  );

  expect(onAction).toHaveBeenCalledTimes(2);
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(screen.getByRole("grid").hasAttribute("aria-multiselectable")).toBe(false);
  expect(options.some((option) => option.getAttribute("aria-selected") === "true")).toBe(false);
});

test("with selectionMode, Enter acts and Space selects", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  screen.getAllByRole("row")[1]!.focus();
  await user.keyboard("{Enter}");
  expect(onAction).toHaveBeenCalledWith("1", expect.objectContaining({ rect: expect.anything() }));
  expect(onSelectionChange).not.toHaveBeenCalled();

  await user.keyboard(" ");
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
});

const withMenu = (onSelect = vi.fn()): VirtualGridItem[] =>
  cells.map((cell) => ({
    ...cell,
    contextMenu: <ContextMenuItem onSelect={() => onSelect(cell.id)}>Rename</ContextMenuItem>,
  }));

test("a cell with contextMenu opens it on the right click", () => {
  render(<VirtualGrid items={withMenu()} aria-label="Frames" className="h-[300px]" />);

  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.contextMenu(screen.getByText("Cell 1"));
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
});

test("Shift+F10 and the context-menu key open the menu with focus on the cell itself", async () => {
  const user = userEvent.setup();
  render(<VirtualGrid items={withMenu()} aria-label="Frames" className="h-[300px]" />);

  const option = screen.getAllByRole("row")[1]!;
  option.focus();
  await user.keyboard("{Shift>}{F10}{/Shift}");
  expect(screen.getByRole("menu")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  // Закрытое с клавиатуры меню возвращает фокус на ячейку, а не теряет его.
  expect(document.activeElement).toBe(option);

  await user.keyboard("{ContextMenu}");
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("picking a menu item neither selects the cell nor fires its action", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={withMenu(onSelect)}
      aria-label="Frames"
      selectionMode="single"
      onSelectionChange={onSelectionChange}
      onAction={onAction}
      className="h-[300px]"
    />
  );

  fireEvent.contextMenu(screen.getByText("Cell 1"));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(onSelect).toHaveBeenCalledWith("1");
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onAction).not.toHaveBeenCalled();
});

test("cells without contextMenu keep their markup and open nothing", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" className="h-[300px]" />);

  fireEvent.contextMenu(screen.getByText("Cell 1"));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  OLDSUI-199: сетка для библиотеки фото. Прокрутка окна,
  подгрузка у края и протяжка пальцем живут в браузере
  (`tests-visual/interactions.spec.ts`); здесь — то, что видно в разметке и
  в вызовах.
*/

test("a button inside a cell is legal and neither selects nor opens the cell", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  const favourite = vi.fn();
  render(
    <VirtualGrid
      items={cells.map((cell) => ({
        ...cell,
        content: (
          <div>
            {cell.textValue}
            <button type="button" onClick={() => favourite(cell.id)}>
              Favourite {cell.id}
            </button>
          </div>
        ),
      }))}
      aria-label="Frames"
      selectionMode="multiple"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  // Кнопка лежит в `gridcell`, а не в `option`: так axe не видит вложенного
  // интерактива (в `option` это было nested-interactive уровня serious).
  const button = screen.getByRole("button", { name: "Favourite 1" });
  expect(button.closest('[role="gridcell"]')).not.toBeNull();
  expect(button.closest('[role="option"]')).toBeNull();

  await user.click(button);
  expect(favourite).toHaveBeenCalledWith("1");
  expect(onAction).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
});

test("onAction hands over the cell's rectangle for an opening animation", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <VirtualGrid items={cells} aria-label="Frames" onAction={onAction} className="h-[300px]" />
  );

  await user.click(screen.getAllByRole("row")[1]!);
  expect(onAction).toHaveBeenCalledTimes(1);
  const [id, details] = onAction.mock.calls[0]!;
  expect(id).toBe("1");
  // В jsdom прямоугольник подменён заплаткой раскладки (600×400) — важно, что
  // он пришёл и что это прямоугольник ячейки, а не сетки.
  expect(details.rect).toMatchObject({ width: 600, height: 400 });
});

test("selectionBehavior is passed to the behaviour layer", async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  const onAction = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      selectionBehavior="replace"
      onAction={onAction}
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  // В `replace` клик выделяет, а не открывает: действие — двойной клик и Enter.
  await user.click(screen.getAllByRole("row")[2]!);
  expect(onAction).not.toHaveBeenCalled();
  expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["2"]);
});

test('rangeSelection="add": Shift extends the selection without dropping what was there', async () => {
  const user = userEvent.setup();
  const onSelectionChange = vi.fn();
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      selectionMode="multiple"
      selectedKeys={new Set(["0", "4"])}
      rangeSelection="add"
      onSelectionChange={onSelectionChange}
      className="h-[300px]"
    />
  );

  const rows = screen.getAllByRole("row");
  rows[1]!.focus();
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  // react-aria заменил бы набор диапазоном от якоря; режим `add` докладывает
  // диапазон к прежнему выбору — «0» и «4» остаются.
  const keys = [...onSelectionChange.mock.lastCall![0]].sort();
  expect(keys).toEqual(expect.arrayContaining(["0", "4"]));
  expect(keys.length).toBeGreaterThan(2);
});

test('rangeSelection="add": a second Shift range in a row still starts at the anchor', async () => {
  // Потребитель хранит выбор как пришёл — так велит страница компонента.
  function Harness() {
    const [keys, setKeys] = useState<Selection>(new Set());
    return (
      <VirtualGrid
        items={cells}
        aria-label="Frames"
        selectionMode="multiple"
        selectedKeys={keys}
        rangeSelection="add"
        onSelectionChange={setKeys}
        className="h-[2000px]"
      />
    );
  }
  const user = userEvent.setup();
  render(<Harness />);

  const row = (i: number) => screen.getAllByRole("row")[i]!;
  await user.click(row(0));
  await user.keyboard("{Shift>}");
  await user.click(row(2));
  await user.click(row(4));
  await user.keyboard("{/Shift}");
  // Якорь — ячейка «0»: второй диапазон тянется от неё и захватывает «3».
  // Объединение в обычном `Set` теряло якорь, и второй Shift+клик выделял
  // одну ячейку «4» (OLDSUI-203).
  const selected = screen
    .getAllByRole("row")
    .filter((r) => r.getAttribute("aria-selected") === "true")
    .map((r) => r.getAttribute("data-key"));
  expect(selected).toEqual(["0", "1", "2", "3", "4"]);
});

test('scroll="window": no own scrolling, cells keep clear of the sticky bar', () => {
  render(<VirtualGrid items={cells} aria-label="Frames" scroll="window" />);

  const grid = screen.getByRole("grid");
  expect(grid.className).not.toContain("overflow-auto");
  // Фокус, уведённый стрелкой за край окна, не прячется под липкую шапку:
  // отступ — та же переменная, что публикует `TopBar` (ADR-0016/0019).
  const row = screen.getAllByRole("row")[0]!;
  expect(row.style.scrollMarginTop).toBe("var(--topbar-h, 0px)");
});

test("offsetVar renames the variable of the sticky bar, like SelectionBar", () => {
  render(<VirtualGrid items={cells} aria-label="Frames" scroll="window" offsetVar="--app-bar" />);
  expect(screen.getAllByRole("row")[0]!.style.scrollMarginTop).toBe("var(--app-bar, 0px)");
});

test("isLoadingMore shows the loading row with an accessible status", () => {
  // Датчик подгрузки react-aria стоит на `IntersectionObserver`, которого в
  // jsdom нет. Потребителю с `onLoadMore` в jsdom нужна та же заглушка —
  // это сказано на странице компонента.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      onLoadMore={() => {}}
      isLoadingMore
      className="h-[300px]"
    />
  );
  expect(screen.getByRole("status")).toBeTruthy();
});

test("minItemHeight is a real minimum: the cell is never lower", () => {
  render(
    <VirtualGrid items={cells} aria-label="Frames" minItemHeight={140} className="h-[300px]" />
  );
  // `gridcell` у react-aria — `display: contents`, высоту держит обёртка внутри.
  const cell = screen.getAllByRole("gridcell")[0]!.firstElementChild as HTMLElement;
  expect(cell.style.minHeight).toBe("140px");
});

test("edgeGap={false} puts the outer cells flush with the edges", () => {
  render(
    <VirtualGrid
      items={cells}
      aria-label="Frames"
      minItemWidth={180}
      gap={12}
      edgeGap={false}
      className="h-[300px]"
    />
  );
  // Раскладка ставит ячейки абсолютно; первая ячейка без внешнего отступа
  // начинается в нуле по обеим осям.
  const first = screen.getAllByRole("row")[0]!.parentElement!;
  expect(first.style.left).toBe("0px");
  expect(first.style.top).toBe("0px");
});

test('dragToSelect without selectionMode="multiple" warns in development', () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<VirtualGrid items={cells} aria-label="Frames" dragToSelect className="h-[300px]" />);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("dragToSelect"));
});
