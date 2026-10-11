// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDate } from "@internationalized/date";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  Carousel,
  ConfirmDialog,
  ContextualSaveBar,
  FilterBarAdd,
  MaskedInput,
  MobileTabBar,
  MobileTabBarItem,
  NotificationCenter,
  NotificationItem,
  NotificationList,
  NavGroup,
  NavItem,
  SideNav,
  SplitButton,
  SplitPanel,
  Tag,
  TagGroup,
  TableToolbar,
  TopBar,
  UiProvider,
  UploadQueue,
  useMessages,
} from "../src/index.js";
import { formatPeriodLength } from "../src/lib/period.js";
import { messages as en } from "../src/locales/en.js";
import ru from "../src/locales/ru.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
});

// `TopBar` измеряет себя и публикует высоту: без заглушек jsdom его рендер
// падает. Условия те же, что в `tests/top-bar.test.tsx`, откуда переехала
// проверка подписи.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 56,
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/**
 * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ПРОВЕРЯЮТСЯ САМИ РУССКИЕ СЛОВА.
 *
 * Волна 23 перевела витрину, тесты и скрипты на английский, и кириллица в
 * `src/**`, `tests/**`, `scripts/**` стала дефектом — её ловит
 * `tests/i18n-gate.test.ts`. Но часть кириллицы в тестах это ПРЕДМЕТ проверки,
 * а не язык изложения: `[11, "11 дней"]` проверяет `Intl.PluralRules`, и
 * «11 days» на этом месте — не перевод, а удалённая проверка.
 *
 * Такие ожидания сведены сюда, и этот файл — третья и последняя запись белого
 * списка гейта. Разбор — ADR-0034 в `olddevs_ui_docs/adr/`.
 *
 * ЧТО СЮДА ЕДЕТ, А ЧТО НЕТ. Сюда — проверки, чей ПРЕДМЕТ есть русское слово:
 * что каталог говорит именно «Закрыть», что формы склонения выбираются
 * правилом. Не сюда — проверки поведения компонента, которым русская локаль
 * досталась исторически: они переходят на английский фолбэк, потому что
 * проверяли поведение, а не язык.
 *
 * Полноту самого каталога здесь не проверяют: по ключам, по форме значения и
 * по непустоте её сверяет `tests/i18n-gate.test.ts` — и делает это для всех
 * ключей сразу, а не для тех, что кто-то вспомнил.
 */

function ShowMessages() {
  const m = useMessages();
  return (
    <>
      <span data-testid="close">{m.common.close}</span>
      <span data-testid="notFound">{m.common.notFound}</span>
    </>
  );
}

describe("русский каталог говорит по-русски", () => {
  test("подключённая локаль меняет встроенные строки на русские слова", () => {
    render(
      <UiProvider locale="ru-RU" messages={ru}>
        <ShowMessages />
      </UiProvider>
    );
    expect(screen.getByTestId("close").textContent).toBe("Закрыть");
    expect(screen.getByTestId("notFound").textContent).toBe("Ничего не найдено");
  });
});

describe("склонение", () => {
  test("русский выбирает форму правилом, а не цепочкой остатков", () => {
    expect(ru.selectionBar.count({ count: 1 })).toBe("Выбран 1");
    expect(ru.selectionBar.count({ count: 2 })).toBe("Выбрано 2");
    expect(ru.selectionBar.count({ count: 5 })).toBe("Выбрано 5");
    expect(ru.period.length({ days: 1 })).toBe("1 день");
    expect(ru.period.length({ days: 3 })).toBe("3 дня");
    expect(ru.period.length({ days: 11 })).toBe("11 дней");
    expect(ru.period.length({ days: 21 })).toBe("21 день");
  });

  test("английский обходится двумя формами", () => {
    expect(en.period.length({ days: 1 })).toBe("1 day");
    expect(en.period.length({ days: 2 })).toBe("2 days");
  });
});

describe("formatPeriodLength", () => {
  // Русские формы проверяются с русским каталогом: с 2.0.0 склонение выбирает
  // локаль через `Intl.PluralRules`, а фолбэк кита английский. Ожидания при
  // этом те же, что были до переезда, — это здесь и доказывается.
  //
  // Одиннадцать и сто одиннадцать в таблице стоят не для полноты: это
  // классическая ловушка правила, где «один» ведёт себя как «много».
  test.each([
    [1, "1 день"],
    [2, "2 дня"],
    [5, "5 дней"],
    [11, "11 дней"],
    [12, "12 дней"],
    [14, "14 дней"],
    [21, "21 день"],
    [22, "22 дня"],
    [25, "25 дней"],
    [101, "101 день"],
    [111, "111 дней"],
  ])("%i → «%s»", (days, expected) => {
    const start = parseDate("2026-01-01");
    const end = start.add({ days: days - 1 });
    expect(formatPeriodLength({ start: start.toString(), end: end.toString() }, ru)).toBe(expected);
  });
});

/*
 * ─── компоненты под русской локалью ───────────────────────────────────────────
 *
 * Семь проверок, переехавших сюда из файлов своих компонентов волной 23. Их
 * предмет — не поведение компонента, а то, что подпись и форма склонения
 * приходят ИЗ КАТАЛОГА: компонент, считающий окончания сам, умеет ровно один
 * язык. Проверять это в файле компонента значило бы держать русское слово в
 * двадцати шести местах и ронять их все при правке формулировки.
 *
 * Фикстуры здесь свои и намеренно минимальные: тест доказывает подпись, а не
 * раскладку, и общая с файлом компонента фикстура связала бы их без нужды.
 */

describe("подпись и склонение приходят из каталога", () => {
  const withRu = (ui: ReactNode) => (
    <UiProvider locale="ru-RU" messages={ru}>
      {ui}
    </UiProvider>
  );

  test("SideNav: имя навигации переводится вместе с локалью, а не зашито", () => {
    render(
      <TooltipProvider>
        {withRu(
          <SideNav>
            <NavGroup label="Работа">
              <NavItem label="Дашборд" href="/dashboard" active />
            </NavGroup>
          </SideNav>
        )}
      </TooltipProvider>
    );
    expect(screen.getByRole("navigation", { name: "Основная навигация" })).toBeTruthy();
  });

  test("MobileTabBar: имя полосы и текст значка берутся из каталога", () => {
    render(
      withRu(
        <MobileTabBar>
          <MobileTabBarItem label="Входящие" href="/inbox" badge={3} />
        </MobileTabBar>
      )
    );
    expect(screen.getByRole("navigation", { name: "Разделы" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Входящие Новых: 3" })).toBeTruthy();
  });

  test("TopBar: имя шапки переводится вместе с локалью", () => {
    render(withRu(<TopBar />));
    expect(screen.getByRole("banner", { name: "Шапка приложения" })).toBeTruthy();
  });

  test("TableToolbar: счётчик склоняется по локали, а не считается вызывающим", () => {
    render(
      withRu(
        <>
          <TableToolbar count={1} />
          <TableToolbar count={2} />
          <TableToolbar count={5} />
        </>
      )
    );
    expect(screen.getByText("1 запись")).toBeTruthy();
    expect(screen.getByText("2 записи")).toBeTruthy();
    expect(screen.getByText("5 записей")).toBeTruthy();
  });

  test("ContextualSaveBar: склонение делает локаль, а не компонент", () => {
    render(withRu(<ContextualSaveBar visible count={1} onSave={() => {}} />));
    expect(within(screen.getByRole("group")).getByText("1 несохранённое изменение")).toBeTruthy();
  });

  test("ConfirmDialog: подпись поля и подсказка подтверждения вводом", () => {
    render(
      withRu(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Удалить пространство"
          message="Проекты и файлы будут удалены."
          typeToConfirm="Акме"
        />
      )
    );
    expect(screen.getByRole("textbox", { name: "Введите «Акме», чтобы подтвердить" })).toBeTruthy();
    expect(screen.getByText("Регистр важен.")).toBeTruthy();
  });

  test("NotificationCenter: имя счётчика склоняется локалью", () => {
    render(
      withRu(
        <NotificationCenter unreadCount={2}>
          <NotificationList>
            <NotificationItem title="Событие" unread />
          </NotificationList>
        </NotificationCenter>
      )
    );
    // По тексту, а не по `aria-label`: имя счётчика даётся `sr-only`-строкой,
    // потому что у `Badge` — `<span>` без роли — имя от автора не
    // поддерживается и браузером отбрасывается.
    expect(screen.getByText("2 непрочитанных")).toBeTruthy();
  });

  test("UploadQueue: итог склоняется локалью, а не компонентом", () => {
    render(
      withRu(
        <UploadQueue
          items={[
            { id: "1", name: "a", state: "failed" },
            { id: "2", name: "b", state: "failed" },
            { id: "3", name: "c", state: "success" },
          ]}
        />
      )
    );
    expect(screen.getByRole("status").textContent).toBe("Загружено 1 из 3, 2 ошибки");
  });

  /*
    Имя раскрывателя `SplitButton` — единственное собственное решение
    компонента, и без этой проверки подмена `messages.splitButton.more(...)`
    литералом не уронила бы ничего: английские тесты сверяют строку,
    совпадающую с фолбэком.
  */
  test("SplitButton: имя раскрывателя берётся из каталога вместе с подписью действия", () => {
    render(withRu(<SplitButton label="Экспорт">{null}</SplitButton>));
    expect(screen.getByRole("button", { name: "Другие действия: Экспорт" })).toBeTruthy();
  });

  /*
    Размер ручки объявляется со склонением, и склоняет его локаль, а не
    компонент: «280 пикселей», но «282 пикселя» и «281 пиксель». Английские
    тесты этого не сторожат — там строка совпадает с фолбэком.
  */
  test("SplitPanel: размер ручки объявляется со склонением из локали", () => {
    const { rerender } = render(
      withRu(<SplitPanel aria-label="Детали" defaultSize={280} panel="Детали" />)
    );
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("280 пикселей");

    rerender(withRu(<SplitPanel aria-label="Детали" size={281} panel="Детали" />));
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("281 пиксель");

    rerender(withRu(<SplitPanel aria-label="Детали" size={282} panel="Детали" />));
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("282 пикселя");
  });

  test("MaskedInput: объявление о неподходящей клавише берётся из каталога", async () => {
    const user = userEvent.setup();
    render(
      withRu(
        <MaskedInput mask="+7 (999) 999-99-99" value="" onChange={() => {}} aria-label="Phone" />
      )
    );
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "а");
    expect(screen.getByRole("status").textContent).toBe("Здесь нужна цифра");
  });

  test("TagGroup: имя кнопки удаления — из каталога, с подписью метки внутри", () => {
    render(
      withRu(
        <TagGroup label="Categories" onRemove={() => {}}>
          <Tag id="design">Дизайн</Tag>
        </TagGroup>
      )
    );
    expect(screen.getByRole("button", { name: "Удалить: Дизайн" })).toBeTruthy();
  });
});

/**
 * Склонение в новом ключе `maskedInput.truncated`.
 *
 * `i18n-gate` ловит ОТСУТСТВИЕ ключа в локали, но не неверную форму: каталог с
 * «1 символов» прошёл бы его насквозь.
 */
test("the truncation message declines the count", () => {
  expect(ru.maskedInput.truncated({ count: 1 })).toContain("1 символ ");
  expect(ru.maskedInput.truncated({ count: 3 })).toContain("3 символа");
  expect(ru.maskedInput.truncated({ count: 11 })).toContain("11 символов");
  expect(ru.maskedInput.truncated({ count: 21 })).toContain("21 символ ");
});

test("the English truncation message agrees in number", () => {
  expect(en.maskedInput.truncated({ count: 1 })).toContain("1 character ");
  expect(en.maskedInput.truncated({ count: 2 })).toContain("2 characters ");
});

/**
 * Конструктор `Intl.PluralRules` разбирает локаль — это самая дорогая часть
 * операции, и платиться она должна один раз за жизнь модуля. Сообщения зовутся
 * из рендера: `uploadQueue.summary` — на каждом тике прогресса загрузки.
 */
test("the locale builds its plural rules once, at module level", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../src/locales/ru.ts"), "utf8");
  // Комментарии выбрасываются: они про этот же конструктор и говорят, но кода
  // не исполняют — тот же приём, что в `tests/i18n-gate.test.ts`.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const constructions = code.match(/new Intl\.PluralRules/g) ?? [];

  expect(constructions).toHaveLength(1);
});

/**
 * `aria-roledescription` — текст для слуха, а не токен ARIA: на русском
 * интерфейсе английское «carousel» прозвучало бы чужим словом посреди речи.
 */
test("the carousel names itself, its slides and its buttons in Russian", () => {
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <Carousel aria-label="Подборка">
        <div>Первый</div>
        <div>Второй</div>
      </Carousel>
    </UiProvider>
  );

  const region = screen.getByRole("region", { name: "Подборка" });
  expect(region.getAttribute("aria-roledescription")).toBe("карусель");
  const second = screen.getAllByRole("group")[1]!;
  expect(second.getAttribute("aria-label")).toBe("2 из 2");
  expect(second.getAttribute("aria-roledescription")).toBe("слайд");
  expect(screen.getByRole("button", { name: "Предыдущий слайд" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Следующий слайд" })).toBeTruthy();
});

/**
 * Диапазон в фильтре (ADR-0063): названия полей и формы подписи токена — из
 * каталога, числа и даты в подписи — по локали провайдера.
 */
describe("a filter range in Russian", () => {
  const RANGE_FIELDS = [
    { id: "amount", label: "Сумма", kind: "number-range" as const, values: [] },
    { id: "created", label: "Создан", kind: "date-range" as const, values: [] },
  ];

  async function openField(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(screen.getByRole("button", { name: "Добавить фильтр" }));
    await user.click(screen.getByRole("button", { name: /Поле/ }));
    await user.click(screen.getByRole("option", { name }));
  }

  const renderAdd = (onAdd: (f: unknown) => void) =>
    render(
      <UiProvider locale="ru-RU" messages={ru}>
        <FilterBarAdd fields={RANGE_FIELDS} filters={[]} onAdd={onAdd} />
      </UiProvider>
    );

  test("the field names and the token label come from the catalog", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderAdd(onAdd);

    await openField(user, "Сумма");
    await user.type(screen.getByRole("textbox", { name: "От" }), "50");
    await user.click(screen.getByRole("button", { name: "Применить" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ value: "50", to: "", label: "Сумма: от 50" })
    );
  });

  test("a number bound in the label follows the provider locale, the filter stays machine-readable", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderAdd(onAdd);

    await openField(user, "Сумма");
    await user.type(screen.getByRole("textbox", { name: "До" }), "1500");
    await user.click(screen.getByRole("button", { name: "Применить" }));

    const filter = onAdd.mock.calls[0]![0] as { to: string; label: string };
    expect(filter.to).toBe("1500");
    expect(filter.label).toBe(`Сумма: до ${new Intl.NumberFormat("ru-RU").format(1500)}`);
  });

  test("a date bound goes out as ISO and is written in the label with a long month and a year", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderAdd(onAdd);
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const long = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(now.getFullYear(), now.getMonth(), 15));

    await openField(user, "Создан");
    await user.click(within(screen.getByRole("group", { name: "От" })).getByRole("button"));
    const day = within(screen.getByRole("grid"))
      .getAllByRole("button")
      .find((b) => b.textContent === "15" && !b.hasAttribute("aria-disabled"));
    await user.click(day!);
    await user.click(screen.getByRole("button", { name: "Применить" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ value: iso, to: "", label: `Создан: от ${long}` })
    );
  });
});
