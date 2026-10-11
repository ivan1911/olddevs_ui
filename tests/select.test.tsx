// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Select, type SelectItem } from "../src/components/inputs/Select.js";

/**
 * Поведение `Select` — то, что не видно ни на снимке, ни в аудите axe.
 *
 * Снимок показывает, как выглядит закрытый триггер; axe — что роли на месте.
 * Ни один из них не скажет, что очистка отдала `""` вместо `null`, что клик
 * по второму пункту закрыл панель мультивыбора или что стрелка вниз никуда
 * не ведёт. Это и проверяется здесь.
 */

afterEach(cleanup);

const ITEMS: SelectItem[] = [
  { id: 1, label: "Nature", keywords: "nature forest" },
  { id: 2, label: "Space", keywords: "space" },
  { id: 3, label: "Cities" },
];

/**
 * Открывает панель и отдаёт её пункты.
 *
 * Триггер ищется по `aria-haspopup`, а не по подписи: подпись у него разная —
 * плейсхолдер, когда ничего не выбрано, название пункта при одном выбранном
 * и счётчик при нескольких.
 */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.querySelector("[aria-haspopup='listbox']") as HTMLElement);
  return within(screen.getByRole("listbox")).getAllByRole("option");
}

describe("single value selection", () => {
  test("clicking an item yields its id and closes the panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={onChange} />);

    const options = await open(user);
    await user.click(options[1]!);

    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("clearing yields null, not an empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select items={ITEMS} placeholder="Category" value={2} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    // Договорённость держится типом, а не комментарием: `""` в типе
    // неотличима от любого другого `string`, а `null` виден компилятору.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("an empty string from the URL means “nothing selected”, not a value", () => {
    render(<Select items={ITEMS} placeholder="Category" value="" onChange={vi.fn()} />);

    // Потребители держат фильтры в URL, где пусто выражается именно `""`.
    // Счёл бы компонент это выбором — показал бы крестик очистки на пустом фильтре.
    expect(screen.getByRole("button", { name: /Category/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("multiple selection", () => {
  test("a click adds to the set and does NOT close the panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1]} onChange={onChange} />
    );

    const options = await open(user);
    await user.click(options[1]!);

    expect(onChange).toHaveBeenCalledWith([1, 2]);
    // Мультивыбор из одного элемента бессмыслен: закрытие после каждого клика
    // заставляло бы открывать панель заново.
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  test("clicking again clears the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1, 2]} onChange={onChange} />
    );

    const options = await open(user);
    await user.click(options[0]!);

    expect(onChange).toHaveBeenCalledWith([2]);
  });

  test("clearing yields an empty array, not null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1, 2]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("search", () => {
  test("filters by label and by keywords alike", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    await open(user);

    // «лес» есть только в keywords «Природы» — по подписи это не найти.
    await user.type(screen.getByRole("textbox"), "forest");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain("Nature");
  });

  test("an empty result explains itself with its own text", async () => {
    const user = userEvent.setup();
    render(
      <Select
        searchable
        items={ITEMS}
        placeholder="Category"
        value={null}
        onChange={vi.fn()}
        notFoundText="Nothing found"
      />
    );
    await open(user);
    await user.type(screen.getByRole("textbox"), "xxx");

    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});

describe("keyboard", () => {
  test("arrows walk the items and do not wrap at the edges", async () => {
    const user = userEvent.setup();
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);
    const options = await open(user);

    options[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);

    // Вверх с первого без поиска — фокус остаётся на месте, а не прыгает вниз.
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(options[2]);

    // Вниз с последнего — тоже на месте: список не карусель.
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[2]);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(options[0]);
  });

  test("arrow down from the search field leads into the list, up leads back", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    const options = await open(user);
    const search = screen.getByRole("textbox");

    search.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(search);
  });

  test("typing on an item returns focus to the search and appends the character", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    const options = await open(user);

    options[0]!.focus();
    await user.keyboard("f");

    const search = screen.getByRole("textbox") as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(search.value).toBe("f");
  });

  test("space on an item selects it instead of going to the search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={onChange} />
    );
    const options = await open(user);

    options[1]!.focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(2);
  });
});

/**
 * Счётчик — строго за множественным выбором.
 *
 * Ветка счётчика ловила и одиночный `Select`, у которого значение есть, а
 * элемента для него в `items` не нашлось: значение пришло из адреса, пока
 * список грузится, или указывает на удалённую запись. Триггер показывал
 * «Категория: 1» — счётчик там, где считать нечего.
 */
test("a single select with a value outside items shows the key, not a count", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[{ id: "nature", label: "Nature" }]}
      value="deleted-42"
      onChange={() => {}}
    />
  );

  const trigger = screen.getAllByRole("button")[0]!;
  expect(trigger.textContent).toContain("deleted-42");
  expect(trigger.textContent).not.toContain("Category: 1");
});

test("a multiple select still counts", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      multiple
      items={[
        { id: "nature", label: "Nature" },
        { id: "city", label: "City" },
      ]}
      value={["nature", "city"]}
      onChange={() => {}}
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Category: 2");
});

/**
 * Выбранная строка красится тем же, чем во всех списках кита.
 *
 * Свой набор классов расходился с общим и отступом (`py-[9px]` против
 * `py-1.5`), и цветом выбора (`bg-bg-3` против `selected:bg-accent-soft`):
 * списки кита, поставленные рядом, различались высотой строки и тем, как
 * выглядит выбранное. Решение владельца — свести к общему.
 *
 * Вариант `selected:` разворачивается в `[data-selected]` и не требует
 * `data-rac`, поэтому общая строка работает и на обычной кнопке.
 */
test("the selected row uses the shared listbox row, not its own colours", async () => {
  const user = userEvent.setup();
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[
        { id: "nature", label: "Nature" },
        { id: "city", label: "City" },
      ]}
      value="nature"
      onChange={() => {}}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  const option = screen.getByRole("option", { name: /Nature/ });

  expect(option.getAttribute("data-selected")).toBe("true");
  expect(option.className).toContain("selected:bg-accent-soft");
  expect(option.className).not.toContain("bg-bg-3");
});

/**
 * Подпись отсутствующего значения задаёт потребитель.
 *
 * Ключ честнее плейсхолдера, когда он человекочитаем, и хуже него, когда это
 * UUID: пользователь видит `9f2c1b04-…` там, где ждал подпись. Кит не знает,
 * как выглядят идентификаторы приложения, — поэтому решает приложение.
 */
test("missingLabel names a value that is not in items", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[]}
      value="9f2c1b04-7c2e-4c1a-9a1b-2f3d4e5a6b7c"
      onChange={() => {}}
      missingLabel={() => "Deleted category"}
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Deleted category");
});

describe("field name", () => {
  test("aria-label is ADDED to the trigger content, not put in place of it", () => {
    render(
      <Select
        items={ITEMS}
        placeholder="Category"
        value={2}
        onChange={vi.fn()}
        aria-label="Section"
      />
    );

    // Обычный `aria-label` на кнопке победил бы содержимое, и поле объявлялось
    // бы «Section, кнопка» — без единого слова о том, что в нём выбрано.
    expect(screen.getByRole("button", { name: "Section Space" })).toBeTruthy();
  });

  test("aria-labelledby points at the visible label and beats aria-label", () => {
    render(
      <>
        <span id="pick-label">Section</span>
        <Select
          items={ITEMS}
          placeholder="Category"
          value={2}
          onChange={vi.fn()}
          aria-label="Ignored"
          aria-labelledby="pick-label"
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Section Space" })).toBeTruthy();
    // Скрытая подпись не рисуется вовсе: второй источник того же имени разошёлся
    // бы с видимым молча.
    expect(screen.queryByText("Ignored")).toBeNull();
  });

  test("without a label the name stays what it was — the trigger content", () => {
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Category" });
    expect(trigger.getAttribute("aria-labelledby")).toBeNull();
  });
});

describe("disabled", () => {
  test("the trigger takes no focus and opens nothing", async () => {
    const user = userEvent.setup();
    render(
      <Select disabled items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );

    const trigger = screen.getByRole("button", { name: "Category" });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);

    await user.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("the clear button is gone: a disabled field is not cleared either", () => {
    render(<Select disabled items={ITEMS} placeholder="Category" value={2} onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  test("switching to disabled CLOSES the open panel instead of hiding it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    await open(user);

    rerender(
      <Select disabled items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    expect(screen.queryByRole("listbox")).toBeNull();

    // Панель не возвращается сама: внутреннее состояние закрыто, а не перекрыто
    // разметкой. Иначе форма, вышедшая из отправки, показала бы список, которого
    // никто не открывал.
    rerender(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("disabled with a controlled panel", () => {
  test("the consumer is TOLD about the closing, not only the markup", () => {
    const onOpenChange = vi.fn();
    const props = { items: ITEMS, placeholder: "Category", value: null, onChange: vi.fn() };
    const { rerender } = render(<Select {...props} open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("listbox")).toBeTruthy();

    rerender(<Select {...props} open disabled onOpenChange={onOpenChange} />);

    // Иначе панель исчезла бы с экрана, а `open` у потребителя остался бы
    // `true` — и вернулась бы сама, едва поле снова включат.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("disabling a closed field says nothing about panels", () => {
    const onOpenChange = vi.fn();
    const props = { items: ITEMS, placeholder: "Category", value: null, onChange: vi.fn() };
    const { rerender } = render(<Select {...props} onOpenChange={onOpenChange} />);

    rerender(<Select {...props} disabled onOpenChange={onOpenChange} />);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
