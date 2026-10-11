// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { InlineEdit } from "../src/components/inputs/InlineEdit.js";

afterEach(cleanup);

function Title({ onChange = () => {} }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("Daily collection");
  return (
    <InlineEdit
      value={value}
      label="Name"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const button = () => screen.getByRole("button");
const field = () => screen.getByRole("textbox", { name: "Name" });

test("the value is in the button name, not only in its text", () => {
  render(<Title />);

  // `aria-label` вытеснил бы значение, и скринридер объявлял бы «изменить
  // название», не читая того, что там написано.
  expect(screen.getByRole("button", { name: /^Daily collection\s*,\s*edit$/ })).toBeTruthy();
});

test("an empty value shows the empty label", () => {
  render(<InlineEdit value="" label="Name" onChange={() => {}} />);

  expect(screen.getByRole("button", { name: /Not set/ })).toBeTruthy();
});

test("opening puts the caret in the field instead of leaving it on the button", async () => {
  const user = userEvent.setup();
  render(<Title />);

  await user.click(button());

  // Иначе пользователь клавиатуры открыл поле и печатает в никуда.
  expect(document.activeElement).toBe(field());
});

test("Enter confirms and returns focus to the button", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Night city{Enter}");

  expect(onChange).toHaveBeenCalledWith("Night city");
  // Поле исчезает, и без возврата фокус уехал бы на `<body>`.
  expect(document.activeElement).toBe(button());
});

test("Escape restores the previous value AND focus", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Other{Escape}");

  // Без отмены пользователь, начавший править по ошибке, не может выйти, не
  // сохранив: щелчок мимо подтверждает, Enter подтверждает.
  expect(onChange).not.toHaveBeenCalled();
  expect(button().textContent).toContain("Daily collection");
  expect(document.activeElement).toBe(button());
});

test("losing focus confirms but does not steal focus", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <>
      <Title onChange={onChange} />
      <button type="button">Neighbour</button>
    </>
  );

  await user.click(screen.getByRole("button", { name: /Daily collection/ }));
  await user.clear(field());
  await user.type(field(), "Night city");
  await user.click(screen.getByRole("button", { name: "Neighbour" }));

  expect(onChange).toHaveBeenCalledWith("Night city");
  // Пользователь ушёл туда, куда хотел, — забирать фокус обратно нельзя.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Neighbour" }));
});

test("confirming without changes does not reach the outside", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.keyboard("{Enter}");

  expect(onChange).not.toHaveBeenCalled();
});

test("the component does not store the confirmed value", async () => {
  const user = userEvent.setup();
  // Значение приходит пропом и наружу не меняется: так ведёт себя вызывающий,
  // у которого сервер отказался сохранить.
  render(<InlineEdit value="Previous" label="Name" onChange={() => {}} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "New{Enter}");

  expect(button().textContent).toContain("Previous");
});

test("the mode can be driven from outside", async () => {
  const user = userEvent.setup();
  const onEditingChange = vi.fn();
  render(
    <InlineEdit
      value="Previous"
      label="Name"
      onChange={() => {}}
      editing={false}
      onEditingChange={onEditingChange}
    />
  );

  await user.click(button());

  // Режим контролируемый: компонент сообщает о намерении, но сам не открывает.
  expect(onEditingChange).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("the draft starts from the current value, not from the previous edit", async () => {
  const user = userEvent.setup();
  render(<Title />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Draft{Escape}");
  await user.click(button());

  // Между открытиями значение могло измениться снаружи.
  expect((field() as HTMLInputElement).value).toBe("Daily collection");
});

/**
 * Регрессия, и дефект был с потерей данных. Escape размонтирует поле, `blur`
 * при этом не приходит вовсе, и флаг «идёт отмена» оставался поднятым до
 * следующей правки — та молча не подтверждалась по щелчку мимо. Пользователь
 * дописывал значение, уходил и терял его без единого признака.
 */
test("after a cancel the next edit is confirmed by clicking away", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <>
      <Title onChange={onChange} />
      <button type="button">Neighbour</button>
    </>
  );

  const value = () => screen.getByRole("button", { name: /collection|city/i });
  await user.click(value());
  await user.keyboard("{Escape}");

  await user.click(value());
  await user.clear(field());
  await user.type(field(), "Night city");
  await user.click(screen.getByRole("button", { name: "Neighbour" }));

  expect(onChange).toHaveBeenCalledWith("Night city");
});

/**
 * Черновик синхронизируется при ЛЮБОМ открытии, а не только через `start()`.
 *
 * `start()` — обработчик кнопки. Когда режим ведут снаружи (документированный
 * сценарий: правка открывается из меню строки), открытие через проп `editing`
 * до него не доходило, и в поле оставался черновик с монтирования. Дальше blur
 * подтверждал его поверх значения, пришедшего с сервера, — тихий откат.
 */
test("a controlled open picks up the value that arrived meanwhile", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setValue("B")}>
          Receive B
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  // Значение пришло с сервера, пока правка была закрыта.
  await user.click(screen.getByRole("button", { name: "Receive B" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(
    screen.getByRole("textbox").getAttribute("value") ??
      (screen.getByRole("textbox") as HTMLInputElement).value
  ).toBe("B");
});

test("Escape does not leave the cancelled text for the next opening", async () => {
  const user = userEvent.setup();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={setValue}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.type(screen.getByRole("textbox"), "ZZZ");
  await user.keyboard("{Escape}");

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("A");
});

/**
 * Открытая правка выделяет текст целиком — и при открытии СНАРУЖИ тоже.
 *
 * `setDraft` — это запрос на рендер, а не запись: к моменту `select()` в поле
 * ещё старый текст, React дофлашивает новый сразу после эффекта и схлопывает
 * выделение в конец. Видно это ровно в том сценарии, ради которого
 * синхронизация и заводилась (T21): открытие пропом, когда значение успело
 * смениться. В обычном пути (щелчок по кнопке) `setDraft` — no-op, рендера нет,
 * и выделение случайно уцелевало — то есть обещание «открыл и печатаешь
 * поверх» держалось там, где правка не нужна, и отваливалось там, где нужна.
 */
test("opening from outside selects the freshly arrived value", async () => {
  const user = userEvent.setup();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setValue("new from server")}>
          Receive
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={setValue}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  await user.click(screen.getByRole("button", { name: "Receive" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));

  const field = screen.getByRole("textbox") as HTMLInputElement;
  expect(field.value).toBe("new from server");
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
});
