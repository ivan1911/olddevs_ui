// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SavedViews, type SavedView } from "../src/components/table/SavedViews.js";

afterEach(cleanup);

interface Filters {
  status: string;
  page: number;
}

const views: SavedView<Filters>[] = [
  { id: "all", name: "All", state: { status: "", page: 1 } },
  { id: "drafts", name: "Drafts", state: { status: "draft", page: 1 } },
  { id: "failed", name: "Failed", state: { status: "failed", page: 3 } },
];

test("the active view is announced, not only highlighted", () => {
  render(<SavedViews views={views} activeId="drafts" onSelect={() => {}} />);

  // Подсветка цветом — не сообщение для скринридера: тот же дефект чинили у
  // `Segmented` и у переключателя тем.
  const pressed = screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true");
  expect(pressed).toHaveLength(1);
  expect(pressed[0]?.textContent).toBe("Drafts");
});

test("without an active view none is announced as pressed", () => {
  // `activeId` не задан — у заказчика это «вид по умолчанию», сброшенный адрес.
  render(<SavedViews views={views} onSelect={() => {}} />);
  const pressed = screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true");
  expect(pressed).toHaveLength(0);
});

test("picking yields the whole snapshot in ONE call", async () => {
  // Ради этого компонент и устроен так. У заказчика состояние переносится в
  // адрес, и последовательные записи по ключу строят адрес из одного снимка
  // текущего рендера: побеждает последняя, правки предыдущих пропадают. Именно
  // так во фронте терялась нижняя граница периода, и ради этого там появился
  // `setMany`.
  const onSelect = vi.fn();
  render(<SavedViews views={views} activeId="all" onSelect={onSelect} />);

  const user = userEvent.setup();
  await user.click(screen.getByText("Failed"));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(views[2]);
  // Снимок приходит целиком, а не по ключу: обе части состояния на месте.
  expect(onSelect.mock.calls[0]?.[0].state).toEqual({ status: "failed", page: 3 });
});

test("the kit stores nothing and subscribes to nothing", async () => {
  // Хранилища ПОДМЕНЯЮТСЯ ЦЕЛИКОМ, а не шпионятся через `Storage.prototype`.
  // Причина та же, что записана у `themeInitScript` в `themes.test.ts`:
  // `localStorage` в jsdom этой версии есть по имени, но без методов
  // `Storage`. Шпион на прототипе там не сработает никогда — и проверка
  // «ничего не записано» пройдёт при любом поведении компонента.
  //
  // Здесь это не рассуждение, а пойманный дефект: первая версия гейта
  // шпионила прототип и осталась зелёной, когда в компонент нарочно добавили
  // запись в `localStorage`.
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  const pushState = vi.spyOn(window.history, "pushState");
  const replaceState = vi.spyOn(window.history, "replaceState");

  const { rerender } = render(<SavedViews views={views} activeId="all" onSelect={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Drafts"));
  rerender(<SavedViews views={views} activeId="drafts" onSelect={() => {}} />);

  // Модель `useTableState` (ADR-0023): форма у кита, владение у потребителя.
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(pushState).not.toHaveBeenCalled();
  expect(replaceState).not.toHaveBeenCalled();

  vi.unstubAllGlobals();
  pushState.mockRestore();
  replaceState.mockRestore();
});

test("an empty list is not drawn at all", () => {
  // Пустая группа объявила бы себя скринридеру, не имея внутри ничего.
  const { container } = render(<SavedViews views={[]} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});

test("the group accessible name comes from the catalog and is overridden by a prop", () => {
  const { rerender } = render(<SavedViews views={views} onSelect={() => {}} />);
  expect(screen.getByRole("group", { name: "Saved views" })).toBeTruthy();

  rerender(<SavedViews views={views} onSelect={() => {}} aria-label="Library views" />);
  expect(screen.getByRole("group", { name: "Library views" })).toBeTruthy();
});

test("a snapshot with a range filter is handed back untouched", async () => {
  // Вид хранит снимок как непрозрачное значение (ADR-0033): диапазон с `to`,
  // в том числе с пустой границей, обязан вернуться тем же объектом, без
  // нормализации «пустая граница — нет границы».
  const range = { id: "r", field: "amount", value: "50", to: "" };
  const withRange: SavedView<{ filters: (typeof range)[] }>[] = [
    { id: "big", name: "Big orders", state: { filters: [range] } },
  ];
  const onSelect = vi.fn();
  render(<SavedViews views={withRange} onSelect={onSelect} />);

  await userEvent.setup().click(screen.getByRole("button", { name: "Big orders" }));

  expect(onSelect.mock.calls[0]![0].state.filters[0]).toBe(range);
});
