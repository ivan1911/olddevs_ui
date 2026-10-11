// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { NotificationCenter } from "../src/components/content/NotificationCenter.js";
import { NotificationItem, NotificationList } from "../src/components/content/NotificationList.js";

afterEach(cleanup);

const feed = (
  <NotificationList>
    <NotificationItem title="Event" unread />
  </NotificationList>
);

test("the count arrives as a prop instead of being counted from rows", () => {
  render(
    <NotificationCenter unreadCount={300}>
      <NotificationList>
        <NotificationItem title="One" unread />
        <NotificationItem title="Two" unread />
      </NotificationList>
    </NotificationCenter>
  );

  // Список бывает страницей коллекции: «2» вместо «300» — не округление,
  // а неправда.
  //
  // Глазами `Badge` обрезает большое число до «99+», но ИМЯ остаётся точным:
  // усечение — это экономия места, а не потеря данных, и скринридер слышит
  // настоящий счёт.
  /*
    Проверяется ТЕКСТ, который действительно озвучивается, а не атрибут.

    Было `getByLabelText("300 unread")` — а имя стояло `aria-label`-ом на
    `Badge`, то есть на `<span>` без роли: у роли `generic` имя от автора не
    поддерживается, браузер его отбрасывает, и скринридер объявлял голое «3».
    Запрос по labelText читает DOM-атрибут напрямую и проходил независимо от
    того, признаёт ли его дерево доступности, — ложная уверенность ровно того
    же рода, что у заглушек `offsetHeight` и `IntersectionObserver`.
  */
  expect(screen.getByText("300 unread")).toBeTruthy();
  // Глазами число обрезано, и от озвучки оно скрыто, чтобы не читаться дважды.
  expect(screen.getByText("99+").getAttribute("aria-hidden")).toBe("true");
});

test("a zero count is not drawn at all", () => {
  render(<NotificationCenter unreadCount={0}>{feed}</NotificationCenter>);
  expect(screen.queryByText("0")).toBeNull();
});

test("without selection there is no bulk-actions bar", () => {
  render(<NotificationCenter>{feed}</NotificationCenter>);
  expect(screen.queryByRole("group", { name: /Selected|Selected/ })).toBeNull();
});

test("bulk actions go through SelectionBar, not through a bar of its own", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  render(
    <NotificationCenter
      selectedCount={3}
      onClearSelection={onClear}
      selectionActions={<button type="button">Mark as read</button>}
    >
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByText("3 selected")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test("the selection bar does not stick: there is nothing to stick to in a popover", () => {
  const { container } = render(<NotificationCenter selectedCount={1}>{feed}</NotificationCenter>);
  // Зашитое `--topbar-h` увело бы полосу под чужую шапку приложения.
  const bar = container.querySelector('[role="group"][class*="border"]') as HTMLElement;
  expect(bar.className).not.toContain("sticky");
});

test("the centre neither opens nor closes itself", () => {
  const { container } = render(<NotificationCenter>{feed}</NotificationCenter>);

  // Поверхности у центра нет: он содержимое `Popover`, `Drawer` или страницы.
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(screen.queryByRole("button", { name: /close|close/i })).toBeNull();
});

test("filters, actions and the footer are slots", () => {
  render(
    <NotificationCenter
      title="Events"
      filters={<button type="button">Unread only</button>}
      actions={<button type="button">Mark all read</button>}
      footer={<a href="#all">Show all</a>}
    >
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByText("Events")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Unread only" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark all read" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Show all" })).toBeTruthy();
});

test("without the new props the title stays a plain text node, not a heading", () => {
  const { container } = render(<NotificationCenter title="Events">{feed}</NotificationCenter>);

  // Без `level` и `titleId` разметка не меняется: ни заголовка, ни id.
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByText("Events").tagName).toBe("SPAN");
  expect(container.querySelector("[id]")).toBeNull();
});

test.each([2, 3, 4] as const)("level=%i makes the title a real heading", (level) => {
  render(
    <NotificationCenter title="Events" level={level}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByRole("heading", { name: "Events", level })).toBeTruthy();
});

test("the default title is a heading too when a level is given", () => {
  render(<NotificationCenter level={3}>{feed}</NotificationCenter>);
  expect(screen.getByRole("heading", { name: "Notifications", level: 3 })).toBeTruthy();
});

test("titleId lands on the heading so a popover can be named by it", () => {
  render(
    <div role="dialog" aria-labelledby="bell-title">
      <NotificationCenter titleId="bell-title" level={2}>
        {feed}
      </NotificationCenter>
    </div>
  );

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.id).toBe("bell-title");
  // Имя поповера приходит от заголовка, а не от `aria-label` рядом.
  expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
});

test("titleId without level goes on the plain title element", () => {
  render(
    <div role="dialog" aria-labelledby="bell-title">
      <NotificationCenter titleId="bell-title" title="Events">
        {feed}
      </NotificationCenter>
    </div>
  );

  // Уровень не задан — структуру заголовков центр не трогает, но имя даёт.
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Events" })).toBeTruthy();
});

test("an empty title is not a title: the catalog default names the centre", () => {
  render(
    <NotificationCenter title="" level={2}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByRole("heading", { name: "Notifications", level: 2 })).toBeTruthy();
});

test("a level outside 2-4 falls back to plain text instead of a bogus element", () => {
  render(
    // Типы такое запрещают — так передаст потребитель на JS.
    <NotificationCenter title="Events" level={7 as never}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByText("Events").tagName).toBe("SPAN");
});
