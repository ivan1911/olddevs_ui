// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ConfirmDialog } from "../src/components/overlays/ConfirmDialog.js";
import { Dialog } from "../src/components/overlays/Dialog.js";

/**
 * Модальность: имя, возврат фокуса и запрет закрытия во время отправки.
 *
 * Ловушку фокуса здесь не проверяем — jsdom не двигает фокус по Tab так, как
 * это делает браузер, и «проверка», которая проходит в любом случае, хуже её
 * отсутствия. Ловушка проверена в браузере и держится Radix.
 */

afterEach(cleanup);

test("the window is announced as a dialog and takes its name from the title", () => {
  render(
    <Dialog open onClose={vi.fn()} title="New album">
      body
    </Dialog>
  );

  const dialog = screen.getByRole("dialog");
  const titleId = dialog.getAttribute("aria-labelledby");
  expect(titleId).toBeTruthy();
  // Ссылка обязана вести в существующий заголовок: в первой версии сюда
  // уезжал `id={undefined}`, ссылка указывала в пустоту, и окно оставалось
  // безымянным — ровно тот дефект, ради которого примитив и заводился.
  expect(document.getElementById(titleId!)?.textContent).toBe("New album");
});

test("the alertdialog role is for a window that demands an answer", () => {
  render(
    <Dialog open onClose={vi.fn()} role="alertdialog" title="Delete?">
      body
    </Dialog>
  );
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

test("a window without the standard header keeps its accessible name", () => {
  render(
    <Dialog open onClose={vi.fn()} title="Select photos" header={false}>
      picker content
    </Dialog>
  );

  expect(screen.getByRole("dialog", { name: "Select photos" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("the delete confirmation sits above the preview card", () => {
  render(
    <ConfirmDialog
      open
      onClose={vi.fn()}
      onConfirm={vi.fn()}
      title="Delete photos"
      message="This action cannot be undone."
    />
  );

  expect(screen.getByRole("alertdialog").parentElement?.className).toContain("z-100");
});

test("Escape closes the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} title="Window">
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});

test("the Escape handler may keep the window open", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog
      open
      onClose={onClose}
      title="Photo preview"
      onEscapeKeyDown={(event) => event.preventDefault()}
    >
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");

  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Photo preview" })).toBeTruthy();
});

test("while submitting it closes neither by the cross nor by Escape", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} loading title="Window">
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  // Крестик не просто заблокирован — его нет: закрывать нечем, и показывать
  // выключенную кнопку значило бы обещать действие, которого не будет.
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("focus goes where told and returns to whoever opened it", async () => {
  const user = userEvent.setup();

  function Example() {
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Window"
          initialFocusRef={inputRef}
        >
          <input ref={inputRef} aria-label="Name" />
        </Dialog>
      </>
    );
  }

  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Open" });
  await user.click(trigger);

  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));

  await user.keyboard("{Escape}");

  // Radix возвращает фокус на свой `Dialog.Trigger`, которого здесь нет:
  // окна открываются из состояния приложения. Без собственного возврата
  // фокус уезжал на `<body>`, и пользователь клавиатуры начинал обход заново.
  expect(document.activeElement).toBe(trigger);
});

/**
 * У окна с ролью `alertdialog` обязано быть доступное ОПИСАНИЕ.
 *
 * `aria-describedby` был зашит в `undefined` ради подавления предупреждения
 * Radix, и следствие вышло шире задуманного: ни одно окно кита не могло иметь
 * описания вовсе. У `ConfirmDialog` это значило, что сам вопрос скринридеру не
 * читался — объявлялись имя окна и кнопка, на которую уехал фокус.
 */
test("a confirmation announces the question, not just its title", () => {
  render(
    <ConfirmDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      title="Delete"
      message="Delete 12 items permanently?"
    />
  );

  const dialog = screen.getByRole("alertdialog");
  const ids = dialog.getAttribute("aria-describedby")?.split(" ").filter(Boolean) ?? [];

  // Проверяется ВЫЧИСЛЕННАЯ связь: ссылка должна вести в узел с текстом
  // вопроса, а не просто существовать.
  const described = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  expect(described).toContain("Delete 12 items permanently?");
});

test("the description points at the visible paragraph, not at a copy", () => {
  render(
    <ConfirmDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      title="Delete"
      message={
        <>
          Delete 12 items? <a href="/docs">More</a>
        </>
      }
    />
  );

  /*
    Первая починка передавала `message` в `description` и рисовала его скрытой
    копией: текст оказывался в документе ДВАЖДЫ, ссылка внутри него давала
    невидимый лишний табстоп в `alertdialog`, а компонент с собственным `id` —
    дубль идентификатора.
  */
  expect(screen.getAllByRole("link", { hidden: true })).toHaveLength(1);
  expect(screen.getAllByText(/Delete 12 items/)).toHaveLength(1);
});

test("a dialog without a description does not point at nothing", () => {
  render(
    <Dialog open onClose={() => {}} title="Window">
      <span>body</span>
    </Dialog>
  );

  expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBeNull();
});

/**
 * Вложенное окно возвращает фокус кнопке ВНУТРИ родительского.
 *
 * Первая версия `useOpenerFocus` отсекала как «открывшего» всё, что лежит
 * внутри `[role="dialog"]`, — а кнопка, открывшая подтверждение, по определению
 * лежит внутри родительского окна. Она отвергалась, хук падал на историю
 * «последний фокус вне модальных слоёв», и фокус после закрытия уезжал на
 * `<body>`. До волны 26 `Dialog` такого условия не имел и работал верно, то
 * есть это была регрессия, внесённая починкой. Ни один из 1075 тестов её не
 * ловил.
 */
test("a nested confirmation returns focus to the button that opened it", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });

  function Host() {
    const [inner, setInner] = useState(false);
    return (
      <Dialog open onClose={() => {}} title="Outer">
        <button type="button" onClick={() => setInner(true)}>
          Delete item
        </button>
        <ConfirmDialog
          open={inner}
          onClose={() => setInner(false)}
          onConfirm={() => {}}
          title="Delete"
          message="Delete it?"
        />
      </Dialog>
    );
  }

  render(<Host />);
  const opener = screen.getByRole("button", { name: "Delete item" });
  await user.click(opener);
  await user.keyboard("{Escape}");

  expect(document.activeElement).toBe(opener);
});
