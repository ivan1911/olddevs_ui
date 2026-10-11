// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MenuItem } from "../src/components/overlays/Menu.js";
import { SplitButton } from "../src/components/actions/SplitButton.js";

/*
  Шим `CSS.escape` — тот же, что в `menu.test.tsx` и по той же причине: в jsdom
  объекта `CSS` нет, а попоувер react-aria зовёт `CSS.escape` при открытии, и
  без шима меню не открывается ни в одном тесте.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Export({
  onClick = () => {},
  onExport = () => {},
  disabled = false,
  loading = false,
}: {
  onClick?: () => void;
  onExport?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <SplitButton label="Export" onClick={onClick} disabled={disabled} loading={loading}>
      <MenuItem onAction={onExport}>Export to XLSX</MenuItem>
      <MenuItem>Export to JSON</MenuItem>
    </SplitButton>
  );
}

test("the toggle opens the menu and the main action does not", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<Export onClick={onClick} />);

  await user.click(screen.getByRole("button", { name: "Export" }));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("menu")).toBeNull();

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();
  // Открытие меню не должно звать главное действие: это разные исходы.
  expect(onClick).toHaveBeenCalledTimes(1);
});

/*
  Единственное собственное решение компонента, и потому отдельный тест: без
  подписи действия в речи идут «Export» и следом безымянная кнопка со стрелкой.
*/
test("the toggle name is built from the main action label", () => {
  render(<Export />);
  expect(screen.getByRole("button", { name: "More actions: Export" })).toBeTruthy();
});

test("a menu item calls its own action, not the main one", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  const onExport = vi.fn();
  render(<Export onClick={onClick} onExport={onExport} />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Export to XLSX" }));

  expect(onExport).toHaveBeenCalledTimes(1);
  expect(onClick).not.toHaveBeenCalled();
});

/*
  Утверждение компонента — «меню открыть нельзя», а не «на кнопке висит
  атрибут». Проверяем первое: чем именно react-aria выражает выключенность, его
  дело, и тест не должен разъезжаться при смене этой детали.
*/
test("disabled turns off both buttons", async () => {
  const user = userEvent.setup();
  render(<Export disabled />);

  expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  Отправка гасит раскрыватель по той же причине, что и `disabled`: открытое меню
  посреди отправки предлагает второй способ сделать то, что уже делается.
*/
/*
  Проверяется и выключенность самого раскрывателя, а не только то, что меню не
  открылось: заслон `isOpen` удовлетворял тест в одиночку, и регрессия
  «раскрыватель выглядит живым, но ничего не делает» прошла бы зелёной — а это
  хуже честно выключенной кнопки.
*/
test("loading turns off the toggle, not just the main action", async () => {
  const user = userEvent.setup();
  render(<Export loading />);

  const more = screen.getByRole("button", { name: /More actions/ });
  expect(more.hasAttribute("disabled") || more.getAttribute("aria-disabled") === "true").toBe(true);

  await user.click(more);
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  Дыра, найденная ревью и воспроизведённая до починки: неуправляемый
  `MenuTrigger` держал раскрытую панель после выключения, и пункт продолжал
  срабатывать — компонент выглядел выключенным, а второй способ работал.
*/
test("turning the component off closes a menu that is already open", async () => {
  const user = userEvent.setup();
  const onExport = vi.fn();

  // Переключатель снаружи не годится: открытая панель делает остальную страницу
  // инертной, и до кнопки не добраться ни кликом, ни запросом. Состояние
  // меняется напрямую — проверяется реакция компонента, а не путь до тумблера.
  let turnOff = () => {};
  function Switchable() {
    const [off, setOff] = useState(false);
    turnOff = () => setOff(true);
    return <Export onExport={onExport} disabled={off} />;
  }
  render(<Switchable />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();

  act(() => turnOff());

  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Export to XLSX" })).toBeNull();
  expect(onExport).not.toHaveBeenCalled();
});

/*
  Вторая половина того же дефекта, и она пряталась за первой: `isOpen` гасит
  показ, но управляемая смена не зовёт `onOpenChange`, поэтому `open` оставался
  `true`. Меню возвращалось само, когда выключенность снимали.
*/
test("re-enabling does not bring the menu back on its own", async () => {
  const user = userEvent.setup();

  let setOff = (_: boolean) => {};
  function Switchable() {
    const [off, set] = useState(false);
    setOff = set;
    return <Export disabled={off} />;
  }
  render(<Switchable />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();

  act(() => setOff(true));
  expect(screen.queryByRole("menu")).toBeNull();

  act(() => setOff(false));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  Всё обоснование компонента держится на том, что раскрыватель — отдельная точка
  табуляции и открывается с клавиатуры. Без этого теста «с клавиатуры до второго
  исхода не добраться» остаётся утверждением докстроки.
*/
test("the toggle is its own tab stop and opens from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Export />);

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Export" }));

  await user.tab();
  const more = screen.getByRole("button", { name: /More actions/ });
  expect(document.activeElement).toBe(more);

  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeTruthy();
  expect(more.getAttribute("aria-expanded")).toBe("true");
});

/*
  Имя панели приходит от триггера, своего `aria-label` компонент ей не даёт.
  Тест сторожит, что имя вообще есть: молча безымянное меню — то, что ловится
  только аудитом или ухом.
*/
test("the menu takes its accessible name from the toggle", async () => {
  const user = userEvent.setup();
  render(<Export />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(screen.getByRole("menu", { name: "More actions: Export" })).toBeTruthy();
});
