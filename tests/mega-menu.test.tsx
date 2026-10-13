// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { forwardRef, useState, type AnchorHTMLAttributes } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  MegaMenu,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
} from "../src/components/navigation/MegaMenu.js";

/*
  Мегаменю — навигация по шаблону WAI-ARIA Disclosure Navigation: Категория
  с Полкой — кнопка, раскрывающая регион ссылок, а не пункт меню команд.
  Тесты смотрят только на то, что видно снаружи: роли, атрибуты, фокус,
  смонтированное содержимое.
*/

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Catalog(props: Partial<Parameters<typeof MegaMenu>[0]> = {}) {
  return (
    <>
      <button type="button">before</button>
      <MegaMenu aria-label="Catalog" {...props}>
        <MegaMenuCategory id="electronics" label="Electronics" href="/electronics">
          <MegaMenuGroup title="Phones">
            <MegaMenuLink href="/phones/a">Phone A</MegaMenuLink>
            <MegaMenuLink href="/phones/b" current>
              Phone B
            </MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
        <MegaMenuCategory id="books" label="Books">
          <MegaMenuGroup title="Fiction">
            <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
        <MegaMenuCategory id="garden" label="Garden" disabled>
          <MegaMenuGroup title="Tools">
            <MegaMenuLink href="/garden/tools">Shovels</MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
        <MegaMenuCategory id="sale" label="Sale" href="/sale" />
      </MegaMenu>
      <button type="button">after</button>
    </>
  );
}

const category = (name: string) => screen.getByRole("button", { name });

test("the catalog is a navigation landmark of disclosure buttons, each controlling a hidden region", () => {
  render(<Catalog />);

  expect(screen.getByRole("navigation", { name: "Catalog" })).toBeTruthy();
  const electronics = category("Electronics");
  expect(electronics.getAttribute("aria-expanded")).toBe("false");
  const panel = document.getElementById(electronics.getAttribute("aria-controls") ?? "");
  // Регион существует и закрытым: `aria-controls` не должен указывать в пустоту.
  expect(panel).not.toBeNull();
  expect(panel?.hidden).toBe(true);
  // Содержимое закрытой Полки не смонтировано: каталог из сотни ссылок не
  // грузит всё сразу.
  expect(screen.queryByRole("link", { name: "Phone A" })).toBeNull();
});

test("hovering a category opens its showcase right away and only its content is mounted", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));

  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  const region = screen.getByRole("region", { name: "Books" });
  expect(region.hidden).toBe(false);
  expect(screen.getByRole("link", { name: "Novels" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Phone A" })).toBeNull();

  await user.hover(category("Electronics"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();
});

/*
  Без user-event: его `asyncWrapper` ждёт настоящий `setTimeout`, а под
  поддельными таймерами тот не наступает (тот же обход — в `hover-card`).
  `fireEvent.pointerEnter` у Testing Library шлёт и `pointerover`, из которого
  React собирает свой `onPointerEnter`.
*/
test("leaving both the column and the showcase closes it after a short grace, coming back cancels", () => {
  vi.useFakeTimers();
  render(<Catalog />);
  const nav = screen.getByRole("navigation", { name: "Catalog" });
  const pointer = (event: "pointerEnter" | "pointerLeave", element: Element) =>
    act(() => {
      fireEvent[event](element, { pointerType: "mouse" });
    });

  pointer("pointerEnter", nav);
  pointer("pointerEnter", category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  pointer("pointerLeave", nav);
  act(() => vi.advanceTimersByTime(100));
  // Курсор вернулся в зазор — закрытие отменено.
  pointer("pointerEnter", nav);
  act(() => vi.advanceTimersByTime(200));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  pointer("pointerLeave", nav);
  act(() => vi.advanceTimersByTime(200));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("the column is a single tab stop; arrows, Home and End move between categories and skip disabled ones", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.click(screen.getByRole("button", { name: "before" }));
  await user.tab();
  expect(document.activeElement).toBe(category("Electronics"));

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(category("Books"));
  // «Garden» выключена — стрелка её пропускает.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Sale" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(category("Electronics"));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Sale" }));
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(category("Books"));

  // Одна остановка Tab: следующий Tab уходит со Столбца, а не на соседнюю Категорию.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  // Вернувшись, пользователь попадает туда, где был.
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(category("Books"));
});

test("Enter opens the showcase and moves focus to its first link; Escape brings focus back and closes it", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Books").focus();
  await user.keyboard("{Enter}");

  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));

  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("Enter on a category already opened by hover moves focus into its showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));
  category("Books").focus();
  await user.keyboard("{Enter}");

  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));
});

test("the arrow towards the showcase opens it, the arrow back returns to the category and keeps it open", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Electronics").focus();
  await user.keyboard("{ArrowRight}");
  // Первой в Полке стоит ссылка самой Категории — у неё есть `href`.
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Electronics" }));

  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(category("Electronics"));
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");
});

test("Tab past the last link of the showcase leaves the catalog and closes the showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Books").focus();
  await user.keyboard("{Enter}");
  await user.tab();

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("arrowing to another category while a showcase is open switches the showcase with it", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Electronics").focus();
  await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowDown}");

  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("false");
});

test("a category without a showcase is a plain link, and hovering it closes the open showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));
  const sale = screen.getByRole("link", { name: "Sale" });
  expect(sale.getAttribute("href")).toBe("/sale");

  await user.hover(sale);
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("a disabled category is announced as unavailable and does not open", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  const garden = category("Garden");
  expect(garden.getAttribute("aria-disabled")).toBe("true");
  await user.hover(garden);
  await user.click(garden);
  expect(garden.getAttribute("aria-expanded")).toBe("false");
});

test("the current link is marked for assistive tech, the category link heads its showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Electronics"));

  expect(screen.getByRole("link", { name: "Phone B" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Phone A" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Electronics" }).getAttribute("href")).toBe(
    "/electronics"
  );
  // Колонка — список ссылок, подписанный своим заголовком.
  expect(screen.getByRole("list", { name: "Phones" })).toBeTruthy();
});

const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function RouterLink(props, ref) {
    return <a ref={ref} data-router="" {...props} />;
  }
);

test("links render as the router's element through asChild and the category's link prop", async () => {
  const user = userEvent.setup();
  render(
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="books" label="Books" link={<RouterLink href="/books" />}>
        <MegaMenuGroup title="Fiction">
          <MegaMenuLink asChild>
            <RouterLink href="/books/novels">Novels</RouterLink>
          </MegaMenuLink>
        </MegaMenuGroup>
      </MegaMenuCategory>
      <MegaMenuCategory id="sale" label="Sale" link={<RouterLink href="/sale" />} />
    </MegaMenu>
  );

  expect(screen.getByRole("link", { name: "Sale" }).hasAttribute("data-router")).toBe(true);
  await user.hover(category("Books"));
  const novels = screen.getByRole("link", { name: "Novels" });
  expect(novels.hasAttribute("data-router")).toBe(true);
  expect(novels.getAttribute("href")).toBe("/books/novels");
  expect(screen.getByRole("link", { name: "Books" }).hasAttribute("data-router")).toBe(true);
});

test("the open category can be controlled from outside", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();

  function Controlled() {
    const [value, setValue] = useState<string | null>("books");
    return (
      <>
        <button type="button" onClick={() => setValue(null)}>
          reset
        </button>
        <Catalog
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
        />
      </>
    );
  }

  render(<Controlled />);
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  await user.hover(category("Electronics"));
  expect(onValueChange).toHaveBeenLastCalledWith("electronics");
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");

  await user.click(screen.getByRole("button", { name: "reset" }));
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("false");
});

test("defaultValue opens a category initially without controlling it", () => {
  render(<Catalog defaultValue="electronics" />);
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");
});

test("a pointer press outside the catalog closes the showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog defaultValue="books" />);

  await user.click(screen.getByRole("button", { name: "after" }));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("the catalog renders on the server", () => {
  const html = renderToString(<Catalog defaultValue="books" />);
  expect(html).toContain("Electronics");
  expect(html).toContain("Novels");
  expect(html).toContain('aria-label="Catalog"');
});

/*
  Находки ревью ветки эпика (OLDSUI-259): фокус при закрытии указателем,
  выключенная ссылка-Категория, остановка Tab при чужом `value` и при обёрнутых
  Категориях.
*/

test("when the pointer leaves while keyboard focus is in the showcase, focus returns to its category", () => {
  vi.useFakeTimers();
  render(<Catalog />);
  const nav = screen.getByRole("navigation", { name: "Catalog" });

  act(() => {
    fireEvent.pointerEnter(nav, { pointerType: "mouse" });
    category("Books").focus();
    fireEvent.keyDown(category("Books"), { key: "Enter" });
  });
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));

  act(() => {
    fireEvent.pointerLeave(nav, { pointerType: "mouse" });
  });
  act(() => vi.advanceTimersByTime(200));

  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(category("Books"));
});

test("a disabled link category does not navigate", () => {
  const onRouterClick = vi.fn();
  render(
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="sale" label="Sale" href="/sale" disabled />
      <MegaMenuCategory
        id="deals"
        label="Deals"
        disabled
        link={<RouterLink href="/deals" onClick={onRouterClick} />}
      />
    </MegaMenu>
  );

  // Без адреса у `a` нет роли ссылки — ищем по тексту.
  expect(screen.getByText("Sale").closest("a")?.hasAttribute("href")).toBe(false);
  // Ссылку роутера выключенная Категория не рисует: её обработчик перешёл бы
  // раньше любой отмены.
  const deals = screen.getByText("Deals").closest("a");
  expect(deals?.hasAttribute("data-router")).toBe(false);
  expect(deals?.hasAttribute("href")).toBe(false);
  fireEvent.click(screen.getByText("Deals"));
  expect(onRouterClick).not.toHaveBeenCalled();
});

test("an unknown controlled value still leaves the column a tab stop", async () => {
  const user = userEvent.setup();
  render(<Catalog value="no-such-category" onValueChange={() => {}} />);

  await user.click(screen.getByRole("button", { name: "before" }));
  await user.tab();
  expect(document.activeElement).toBe(category("Electronics"));
});

function WrappedCategory({ id, label }: { id: string; label: string }) {
  return (
    <MegaMenuCategory id={id} label={label}>
      <MegaMenuGroup title={`${label} group`}>
        <MegaMenuLink href={`/${id}`}>{`${label} link`}</MegaMenuLink>
      </MegaMenuGroup>
    </MegaMenuCategory>
  );
}

test("categories wrapped in the consumer's own component still get a tab stop", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button type="button">before</button>
      <MegaMenu aria-label="Catalog">
        <WrappedCategory id="a" label="Alpha" />
        <WrappedCategory id="b" label="Beta" />
      </MegaMenu>
    </>
  );

  await user.click(screen.getByRole("button", { name: "before" }));
  await user.tab();
  expect(document.activeElement).toBe(category("Alpha"));
});

/*
  Доработки 4.3.0 (OLDSUI-262): ссылка роутера у заголовка колонки, фрагменты
  в колонке, текущий раздел (`active`), поиск по первой букве и Категории,
  которые Столбец не видит среди прямых детей (обёрнутые или пришедшие из
  серверного компонента).
*/

test("a group title renders as the router's element through its link prop", () => {
  render(
    <MegaMenu aria-label="Catalog" defaultValue="books">
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuGroup title="Fiction" link={<RouterLink href="/books/fiction" />}>
          <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
        </MegaMenuGroup>
      </MegaMenuCategory>
    </MegaMenu>
  );

  const title = screen.getByRole("link", { name: "Fiction" });
  expect(title.hasAttribute("data-router")).toBe(true);
  expect(title.getAttribute("href")).toBe("/books/fiction");
  // Заголовок-ссылка по-прежнему подписывает список колонки.
  expect(screen.getByRole("list", { name: "Fiction" })).toBeTruthy();
});

test("links passed in a fragment each get their own list item", () => {
  render(
    <MegaMenu aria-label="Catalog" defaultValue="books">
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuGroup title="Fiction">
          <>
            <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
            <MegaMenuLink href="/books/poetry">Poetry</MegaMenuLink>
          </>
        </MegaMenuGroup>
      </MegaMenuCategory>
    </MegaMenu>
  );

  const list = screen.getByRole("list", { name: "Fiction" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
});

test("an active link is the current page; current stays as a deprecated alias", async () => {
  const user = userEvent.setup();
  render(
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuGroup title="Fiction">
          <MegaMenuLink href="/books/novels" active>
            Novels
          </MegaMenuLink>
          <MegaMenuLink href="/books/poetry">Poetry</MegaMenuLink>
        </MegaMenuGroup>
      </MegaMenuCategory>
    </MegaMenu>
  );

  await user.hover(category("Books"));
  expect(screen.getByRole("link", { name: "Novels" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Poetry" }).getAttribute("aria-current")).toBeNull();
});

test("an active category is marked as the current section, whether or not it is open", async () => {
  const user = userEvent.setup();
  render(
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="electronics" label="Electronics">
        <MegaMenuLink href="/phones">Phones</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="books" label="Books" active>
        <MegaMenuLink href="/novels">Novels</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="sale" label="Sale" href="/sale" active />
    </MegaMenu>
  );

  expect(category("Books").getAttribute("aria-current")).toBe("true");
  expect(category("Electronics").getAttribute("aria-current")).toBeNull();
  // Категория-ссылка — тоже.
  expect(screen.getByRole("link", { name: "Sale" }).getAttribute("aria-current")).toBe("true");

  // Открытие другой Категории отметку не снимает: текущий раздел задаёт маршрут.
  await user.hover(category("Electronics"));
  expect(category("Books").getAttribute("aria-current")).toBe("true");
});

test("with nothing open, the column's tab stop is the active category", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button type="button">before</button>
      <MegaMenu aria-label="Catalog">
        <MegaMenuCategory id="electronics" label="Electronics">
          <MegaMenuLink href="/phones">Phones</MegaMenuLink>
        </MegaMenuCategory>
        <MegaMenuCategory id="books" label="Books" active>
          <MegaMenuLink href="/novels">Novels</MegaMenuLink>
        </MegaMenuCategory>
      </MegaMenu>
    </>
  );

  await user.click(screen.getByRole("button", { name: "before" }));
  await user.tab();
  expect(document.activeElement).toBe(category("Books"));
});

function LetterCatalog() {
  return (
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="apparel" label="Apparel">
        <MegaMenuLink href="/apparel">Shirts</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuLink href="/books">Novels</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="baby" label="Baby" disabled>
        <MegaMenuLink href="/baby">Toys</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="beauty" label="Beauty">
        <MegaMenuLink href="/beauty">Perfume</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="garden" label="Garden" href="/garden" />
    </MegaMenu>
  );
}

test("typing a letter moves focus to the next category starting with it, skipping disabled ones", async () => {
  const user = userEvent.setup();
  render(<LetterCatalog />);
  category("Apparel").focus();

  await user.keyboard("b");
  expect(document.activeElement).toBe(category("Books"));
  // Та же буква ещё раз — следующая на неё, выключенная пропускается.
  await user.keyboard("b");
  expect(document.activeElement).toBe(category("Beauty"));
  // По кругу — снова первая.
  await user.keyboard("b");
  expect(document.activeElement).toBe(category("Books"));
  // Категория-ссылка находится так же.
  await user.keyboard("g");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Garden" }));
});

test("several letters typed quickly match the start of a label", () => {
  vi.useFakeTimers();
  render(<LetterCatalog />);
  category("Apparel").focus();

  act(() => {
    fireEvent.keyDown(document.activeElement as Element, { key: "b" });
    fireEvent.keyDown(document.activeElement as Element, { key: "e" });
  });
  expect(document.activeElement).toBe(category("Beauty"));

  // Пауза сбрасывает набранное: «b» снова ищет с начала слова.
  act(() => vi.advanceTimersByTime(1000));
  act(() => {
    fireEvent.keyDown(document.activeElement as Element, { key: "b" });
  });
  expect(document.activeElement).toBe(category("Books"));
});

test("with a showcase open, the showcase follows the letter like it follows the arrows", async () => {
  const user = userEvent.setup();
  render(<LetterCatalog />);

  await user.hover(category("Apparel"));
  category("Apparel").focus();
  await user.keyboard("b");

  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  expect(category("Apparel").getAttribute("aria-expanded")).toBe("false");
});

test("a letter with a modifier is left to the browser", async () => {
  const user = userEvent.setup();
  render(<LetterCatalog />);
  category("Apparel").focus();

  await user.keyboard("{Control>}b{/Control}");
  expect(document.activeElement).toBe(category("Apparel"));
});

test("wrapped categories render a tab stop on the server, before hydration", () => {
  const html = renderToString(
    <MegaMenu aria-label="Catalog">
      <WrappedCategory id="a" label="Alpha" />
      <WrappedCategory id="b" label="Beta" />
    </MegaMenu>
  );
  // До гидратации Столбцу не на что опереться, кроме самих строк: без остановки
  // Tab клавиатура проскочила бы каталог, пока не загрузится клиент.
  expect(html).toMatch(
    /data-mega-category="a"[^>]*tabindex="0"|tabindex="0"[^>]*data-mega-category="a"/
  );
});
