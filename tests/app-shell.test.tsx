// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { AppShell, useAppShell } from "../src/components/app-shell/AppShell.js";
import { NavItem } from "../src/components/app-shell/NavItem.js";
import { NavGroup, SideNav } from "../src/components/app-shell/SideNav.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";
import { TopBar } from "../src/components/app-shell/TopBar.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("AppShell: layout and landmarks", () => {
  test("content sits inside <main>", () => {
    render(<AppShell>Page</AppShell>);
    expect(screen.getByRole("main").textContent).toBe("Page");
  });

  test("the skip link is the first focusable element and leads to <main>", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <button>First button on the page</button>
      </AppShell>
    );

    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(document.activeElement).toBe(skip);
    // Цель ссылки — именно `<main>`, а не соседний узел.
    expect(skip.getAttribute("href")).toBe(`#${screen.getByRole("main").id}`);
  });

  /**
   * `focus:absolute` у skip-ссылки отсчитывается от ближайшего
   * позиционированного предка: без `relative` на корне вложенный каркас
   * всплывал бы ссылкой не над собой, а где-то на странице.
   */
  test("the root is positioned — the link floats above its own frame", () => {
    const { container } = render(<AppShell>Page</AppShell>);
    expect(container.firstElementChild?.className).toContain("relative");
  });

  test("absent slots do not reach the markup", () => {
    render(<AppShell>Page</AppShell>);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  test("the aside appears only with content", () => {
    render(<AppShell aside={<div>Details</div>}>Page</AppShell>);
    expect(screen.getByRole("complementary").textContent).toBe("Details");
  });
});

/**
 * Слот нижней панели заведён без компонента (ADR-0018): каркас обязан знать,
 * что внизу может стоять полоса, съедающая высоту и safe-area. Проверяется,
 * что отсутствующая полоса ничего не занимает, а заданная получает отступ.
 */
describe("AppShell: bottom bar slot", () => {
  const SAFE_AREA = ".pb-\\[env\\(safe-area-inset-bottom\\,0px\\)\\]";

  test("without the bar no height is eaten", () => {
    const { container } = render(<AppShell>Page</AppShell>);
    expect(container.querySelector(SAFE_AREA)).toBeNull();
  });

  test("with the bar a safe-area inset appears", () => {
    const { container } = render(<AppShell bottomBar={<nav>Sections</nav>}>Page</AppShell>);
    const bar = container.querySelector(SAFE_AREA);
    expect(bar).toBeTruthy();
    expect(bar?.textContent).toBe("Sections");
  });
});

describe("AppShell: focus returns on route change", () => {
  function Routed() {
    const [route, setRoute] = useState("a");
    return (
      <AppShell routeKey={route}>
        <button onClick={() => setRoute("b")}>Go</button>
      </AppShell>
    );
  }

  test("focus is not taken on the first render", () => {
    render(<Routed />);
    // Иначе каркас крал бы фокус у пользователя, который уже начал работать.
    expect(document.activeElement).toBe(document.body);
  });

  test("changing the key moves focus into <main>", async () => {
    const user = userEvent.setup();
    render(<Routed />);

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  /*
    StrictMode в dev монтирует компонент, снимает и монтирует снова, и эффекты
    отрабатывают дважды. Пропуск первого прохода по флагу в рефе это не
    переживал: ко второму запуску флаг уже был сброшен, и фокус уходил в
    `<main>` на первой загрузке, а браузер прокручивал страницу к нему под
    шапку (OLDSUI-201).
  */
  test("under StrictMode focus is not taken on the first render either", () => {
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );
    expect(document.activeElement).toBe(document.body);
  });

  test("under StrictMode changing the key still moves focus into <main>", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  test("focus moves into <main> without scrolling to it", async () => {
    // Прокрутку при переходе задаёт роутер; фокусу своя не нужна, иначе
    // `<main>` уезжает под липкую шапку. Под StrictMode — там дефект и жил.
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    const main = screen.getByRole("main");
    expect(focus.mock.contexts).toContain(main);
    expect(focus.mock.calls[focus.mock.contexts.indexOf(main)]).toEqual([{ preventScroll: true }]);
  });

  test("without a route key focus is not touched at all", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <button>Button</button>
      </AppShell>
    );

    const button = screen.getByRole("button", { name: "Button" });
    await user.click(button);
    expect(document.activeElement).toBe(button);
  });
});

describe("AppShell and TopBar: the navigation button", () => {
  test("no navigation, no button", () => {
    render(
      <AppShell header={<TopBar />}>
        <div>Page</div>
      </AppShell>
    );
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
  });

  test("with navigation the header gets the button itself, without a slot", async () => {
    const user = userEvent.setup();
    render(
      <AppShell header={<TopBar />} sidebar={<nav aria-label="Sections">Items</nav>}>
        <div>Page</div>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    // Ящик с навигацией внутри — именно он, а не колонка: у неё своё имя.
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeTruthy();
  });

  test("a header outside the frame draws no button", () => {
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
  });
});

/**
 * Навигация в ящике: иконочный режим там бессмыслен — он существует ради того,
 * чтобы отдать ширину содержимому страницы, а рядом с оверлеем содержимого нет.
 */
describe("SideNav inside the drawer", () => {
  const nav = (props: { collapsed?: boolean; defaultCollapsed?: boolean } = {}) => (
    <SideNav {...props}>
      <NavGroup label="Work">
        <NavItem label="Dashboard" href="/dashboard" active />
      </NavGroup>
    </SideNav>
  );

  const openDrawer = async (ui: React.ReactNode) => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <AppShell header={<TopBar />} sidebar={ui}>
          <div>Page</div>
        </AppShell>
      </TooltipProvider>
    );
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
  };

  test("there is no collapse button inside the drawer", async () => {
    await openDrawer(nav());
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).queryByRole("button", { name: "Collapse navigation" })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: "Expand navigation" })).toBeNull();
  });

  /**
   * Главная половина правки. Убрать кнопку и оставить `collapsed` в силе было
   * бы ХУЖЕ исходного дефекта: потребитель, держащий схлопнутость снаружи,
   * получил бы в ящике иконки без единого способа их развернуть.
   */
  test("outer collapsing has no effect inside the drawer — labels stay visible", async () => {
    await openDrawer(nav({ collapsed: true }));
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).getByText("Dashboard").className).not.toContain("sr-only");
    // Заголовок раздела тоже возвращается: в схлопнутом виде он был чертой.
    expect(within(drawer).getByText("Work")).toBeTruthy();
  });

  test("defaultCollapsed has no effect inside the drawer either", async () => {
    await openDrawer(nav({ defaultCollapsed: true }));
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).getByText("Dashboard").className).not.toContain("sr-only");
  });

  test("the column outside the drawer still collapses", () => {
    render(
      <TooltipProvider>
        <AppShell sidebar={nav({ defaultCollapsed: true })}>
          <div>Page</div>
        </AppShell>
      </TooltipProvider>
    );
    // Ящик закрыт, в разметке только колонка — и она схлопнута, как просили.
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
  });
});

/**
 * Регрессия: `openNavigation` умел читать только китовый `TopBar`, и своя
 * шапка получала навигацию, которую ниже `md` нечем открыть — колонка скрыта,
 * ящик открывать некому, предупреждения нет. Дефект молчаливый: на широком
 * экране всё работает, а раздел интерфейса недостижим только на узком.
 */
describe("useAppShell: a custom header instead of the kit one", () => {
  function OwnHeader() {
    const { openNavigation } = useAppShell();
    return (
      <header>{openNavigation ? <button onClick={openNavigation}>Menu</button> : null}</header>
    );
  }

  test("a custom header gets a way to open the navigation", async () => {
    const user = userEvent.setup();
    render(
      <AppShell header={<OwnHeader />} sidebar={<nav aria-label="Sections">Items</nav>}>
        <div>Page</div>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeTruthy();
  });

  test("without a sidebar there is no way — and nothing to draw a button for", () => {
    render(
      <AppShell header={<OwnHeader />}>
        <div>Page</div>
      </AppShell>
    );
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  test("outside the frame the hook returns an empty object instead of throwing", () => {
    render(<OwnHeader />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });
});

test("without the banners slot the markup does not change by a single node", () => {
  // Слот добавлен к СТАБИЛЬНОМУ каркасу волны 17, и цена такого изменения —
  // обещание, что без слота он остаётся прежним. Сравнивается разметка целиком:
  // иначе обещание держится на том, что мы догадались проверить нужный узел.
  const shell = (props: { banners?: React.ReactNode }) => (
    <AppShell header={<div>Header</div>} {...props}>
      Content
    </AppShell>
  );

  const { container, rerender } = render(shell({}));
  const without = container.innerHTML;

  rerender(shell({ banners: undefined }));
  expect(container.innerHTML).toBe(without);
  // Пустого `div` под баннеры в разметке нет — узла нет вовсе.
  expect(without).not.toContain("banner");
});

test("banners sit above the header, not below it", () => {
  render(
    <AppShell
      banners={<div data-testid="bn">Maintenance in progress</div>}
      header={<div>Header</div>}
    >
      Content
    </AppShell>
  );

  // Порядок в разметке — это порядок на экране: баннер под шапкой означал бы
  // сообщение о состоянии приложения ниже навигации по нему.
  const column = screen.getByTestId("bn").parentElement!;
  const nodes = Array.from(column.children).map((n) => n.textContent);
  expect(nodes[0]).toBe("Maintenance in progress");
  expect(nodes[1]).toBe("Header");
});

test("the header under banners stays sticky at zero", () => {
  render(
    <AppShell banners={<div>Maintenance in progress</div>} header={<TopBar label="Header" />}>
      Content
    </AppShell>
  );

  // Контракт `--topbar-h` не трогается: липкая стопка баннеров потребовала бы
  // второй переменной смещения, и всё, что считает от `--topbar-h`, обязано
  // было бы прибавлять её высоту (ADR-0027).
  expect(screen.getByRole("banner").className).toContain("sticky");
  expect(screen.getByRole("banner").className).toContain("top-0");
});
