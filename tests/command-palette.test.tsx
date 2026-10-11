// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { CommandPalette } from "../src/components/overlays/CommandPalette.js";

afterEach(cleanup);

const SECTIONS = [
  {
    id: "library",
    label: "Library",
    items: [
      { id: "upload", label: "Upload photos" },
      { id: "find", label: "Find similar", keywords: "similar" },
    ],
  },
];

test("hint mode hides the list only on an EMPTY query", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      emptyBehaviour="hint"
      sections={SECTIONS}
    />
  );

  // Пустой запрос — подсказка вместо списка. Сама подсказка тоже приходит
  // пунктом: `renderEmptyState` у react-aria рисуется внутри списка.
  expect(screen.queryByRole("option", { name: /Upload photos/ })).toBeNull();
  expect(screen.getByText("Start typing an action name")).toBeTruthy();

  await user.type(screen.getByRole("searchbox"), "Uploa");

  // А набранный — обычный поиск. Раньше условие было константой, и палитра
  // в этом режиме не могла найти ничего никогда.
  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
});

test("list mode shows everything on an empty query", () => {
  render(<CommandPalette open onClose={() => {}} onSelect={() => {}} sections={SECTIONS} />);

  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Find similar/ })).toBeTruthy();
});

test("search goes through synonyms too", async () => {
  const user = userEvent.setup();

  render(<CommandPalette open onClose={() => {}} onSelect={() => {}} sections={SECTIONS} />);
  await user.type(screen.getByRole("searchbox"), "similar");

  // Слова по-английски в подписи нет — оно лежит в `keywords`.
  expect(screen.getByRole("option", { name: /Find similar/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /Upload photos/ })).toBeNull();
});

/**
 * Палитра существует только ради клавиатуры, поэтому потеря фокуса здесь —
 * отказ основной функции.
 *
 * Компонент собран на голом `DialogPrimitive.Content` без `Trigger`: Radix
 * безусловно зовёт `preventDefault()` и фокусирует `triggerRef`, которого нет,
 * и фокус уезжает на `<body>`. `Dialog` и `Drawer` эту связку имеют, до палитры
 * она не доехала.
 */
test("closing returns focus to whoever opened the palette", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          sections={[{ id: "s", label: "Section", items: [{ id: "one", label: "First action" }] }]}
          onSelect={() => setOpen(false)}
        />
      </>
    );
  }

  render(<Host />);
  const opener = screen.getByRole("button", { name: "Open" });
  await user.click(opener);

  await user.keyboard("{Escape}");

  expect(document.activeElement).toBe(opener);
});

/**
 * Запрос не переживает закрытие.
 *
 * `query` живёт состоянием компонента, а не содержимого диалога, и при
 * `open=false` сохранялся. Выбрав пункт, пользователь при следующем открытии
 * видел прошлый запрос и отфильтрованный по нему список.
 */
test("the palette opens with an empty query after a pick", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          sections={[
            {
              id: "s",
              label: "Section",
              items: [
                { id: "one", label: "First action" },
                { id: "two", label: "Second action" },
              ],
            },
          ]}
          onSelect={() => setOpen(false)}
        />
      </>
    );
  }

  render(<Host />);
  await user.type(screen.getByRole("searchbox"), "Second");
  await user.click(screen.getByText("Second action"));

  await user.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.getByRole("searchbox")).toHaveProperty("value", "");
});

/*
 * Дальше — заявка Nextable: поиск, который живёт на сервере. Три пункта её
 * контракта, каждый отдельным тестом.
 */

const SERVER_SECTION = {
  id: "tasks",
  label: "Tasks",
  prefiltered: true,
  items: [
    // Подстроки «meetings» здесь нет ни в одной подписи — в этом весь смысл.
    { id: "t1", label: "Schedule a meeting" },
    { id: "t2", label: "Review the notes" },
  ],
};

/**
 * Раздел, отфильтрованный снаружи, не просеивается второй раз.
 *
 * Морфологический поиск находит «Schedule a meeting» по запросу «meetings», а
 * локальный `contains` такую пару не сматчит никогда: подстроки в подписи нет.
 * До флага сервер находил, а палитра показывала «ничего не найдено».
 */
test("a prefiltered section survives a query its labels do not contain", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      sections={[...SECTIONS, SERVER_SECTION]}
    />
  );

  await user.type(screen.getByRole("searchbox"), "meetings");

  expect(screen.getByRole("option", { name: /Schedule a meeting/ })).toBeTruthy();
  // И порядок сервера сохранён: ранжировал тот, кто искал.
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Schedule a meeting",
    "Review the notes",
  ]);
});

/** Разделы обоих видов уживаются в одном списке: команды всё ещё фильтруются. */
test("a local section keeps filtering next to a prefiltered one", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      sections={[...SECTIONS, SERVER_SECTION]}
    />
  );

  await user.type(screen.getByRole("searchbox"), "Uploa");

  expect(screen.getByRole("option", { name: /Upload photos/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /Find similar/ })).toBeNull();
  // Раздел сервера на этот запрос ничего не прислал бы, но пока прислал —
  // показывается как передан. Решение о содержимом принято снаружи.
  expect(screen.getByRole("option", { name: /Schedule a meeting/ })).toBeTruthy();
});

/** Запрос уходит наружу — иначе серверный поиск нечем запустить. */
test("the typed query is reported to the consumer", async () => {
  const user = userEvent.setup();
  const seen: string[] = [];

  render(
    <CommandPalette
      open
      onClose={() => {}}
      onSelect={() => {}}
      onQueryChange={(q) => seen.push(q)}
      sections={SECTIONS}
    />
  );

  await user.type(screen.getByRole("searchbox"), "up");

  expect(seen).toEqual(["u", "up"]);
});

/**
 * Сброс при закрытии тоже уходит наружу.
 *
 * Без этого потребитель остаётся с запросом, которого в поле уже нет, и
 * продолжает по нему ходить в сеть.
 */
test("closing reports the reset query", async () => {
  const user = userEvent.setup();
  const seen: string[] = [];

  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSelect={() => {}}
        onQueryChange={(q) => seen.push(q)}
        sections={SECTIONS}
      />
    );
  }

  render(<Host />);
  await user.type(screen.getByRole("searchbox"), "up");
  await user.keyboard("{Escape}");

  expect(seen.at(-1)).toBe("");
});

/**
 * Пока идёт поиск, пустое состояние не утверждает, что ничего не нашлось.
 *
 * Именно это и происходило на каждый набранный символ: ответ сервера ещё в
 * пути, а палитра уже сообщила результат.
 */
test("loading replaces the not-found line", async () => {
  const user = userEvent.setup();

  render(
    <CommandPalette
      open
      loading
      loadingText="Searching…"
      onClose={() => {}}
      onSelect={() => {}}
      sections={SECTIONS}
    />
  );

  await user.type(screen.getByRole("searchbox"), "zzz");

  expect(screen.getByText("Searching…")).toBeTruthy();
  expect(screen.queryByText("Nothing found")).toBeNull();
});
