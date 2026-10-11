// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { TopBar } from "../src/components/app-shell/TopBar.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
});

/**
 * jsdom не считает раскладку: `offsetHeight` там всегда 0, а `ResizeObserver`
 * отсутствует вовсе. Подменяются оба — иначе проверялась бы заглушка, а не
 * контракт. Настоящую высоту сторожит `tests-visual/interactions.spec.ts`,
 * где полоса встаёт под шапку в живом браузере.
 */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    /*
      Отцепленный узел обязан отдавать НОЛЬ, как в браузере.

      Константа здесь была заглушкой, которая сторожила сама себя: уборщик
      эффекта сверял опубликованное значение с `el.offsetHeight`, а `useEffect`
      — пассивный эффект, его уборщик запускается ПОСЛЕ фазы мутаций, когда узел
      уже вынут из документа. В браузере там ноль, сравнение `"56px" === "0px"`
      ложно всегда, и переменная не снималась ни разу. Заглушка отвечала 56 и
      для отцепленного узла — поэтому тест «переменная снимается вместе с
      шапкой» был зелёным при неработающем коде.
    */
    get(this: HTMLElement) {
      return this.isConnected ? 56 : 0;
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const heightOf = (name: string) => document.documentElement.style.getPropertyValue(name);

describe("TopBar", () => {
  test("it is a landmark named from the message catalog", () => {
    render(<TopBar />);
    expect(screen.getByRole("banner", { name: "Application header" })).toBeTruthy();
  });

  /**
   * Регрессия: `style` потребителя перезаписывал атрибут ЦЕЛИКОМ, и шапка
   * теряла подложку — а с липким блюром это значит просвечивающий контент.
   * Ловится только так: разметка валидна, типы сходятся, тесты слотов зелёные.
   */
  test("a consumer style adds to the underlay instead of wiping it", () => {
    const { container } = render(<TopBar style={{ zIndex: 99 }} />);
    const header = container.querySelector("header");
    expect(header?.style.background).toContain("--topbar-bg");
    expect(header?.style.zIndex).toBe("99");
  });

  test("a consumer underlay still wins — the prop outranks the default", () => {
    const { container } = render(<TopBar style={{ background: "red" }} />);
    expect(container.querySelector("header")?.style.background).toBe("red");
  });

  test("slots render, absent ones do not reach the markup", () => {
    render(<TopBar brand={<span>Olddevs</span>} actions={<button>Settings</button>} />);
    expect(screen.getByText("Olddevs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });
});

/**
 * Ради этого блока ADR-0019 и писался: до 2.1.0 высоту публиковало приложение,
 * теперь — сама шапка кита.
 */
describe("TopBar: publishing the height", () => {
  test("the height goes into --topbar-h on mount", () => {
    render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");
  });

  test("the variable name is a prop: a second header has its own", () => {
    render(<TopBar heightVar="--widget-topbar-h" />);
    expect(heightOf("--widget-topbar-h")).toBe("56px");
    expect(heightOf("--topbar-h")).toBe("");
  });

  test("heightVar=null switches publishing off", () => {
    render(<TopBar heightVar={null} />);
    expect(heightOf("--topbar-h")).toBe("");
  });

  /**
   * Переменную публикует не только кит: имя её — проп именно потому, что шапка
   * может быть чужой (ADR-0016). Значение, переписанное мимо кита, уходящая
   * шапка не снимает.
   */
  test("a departing header does not clear a value written by someone else", () => {
    const { unmount } = render(<TopBar />);
    // Вторая шапка успела опубликовать своё значение до размонтирования первой.
    document.documentElement.style.setProperty("--topbar-h", "72px");
    unmount();
    expect(heightOf("--topbar-h")).toBe("72px");
  });

  test("the variable is removed together with the header", () => {
    const { unmount } = render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");
    unmount();
    // Оставленная переменная заставила бы липкие полосы отступать от
    // несуществующего элемента.
    expect(heightOf("--topbar-h")).toBe("");
  });
});

/**
 * Две настоящие шапки, а не имитация записью в стиль.
 *
 * При переходе между экранами новая монтируется РАНЬШЕ, чем размонтируется
 * старая; то же даёт шапка приложения плюс шапка встроенного виджета с тем же
 * именем переменной. Владение определялось СРАВНЕНИЕМ ЗНАЧЕНИЙ — а две шапки
 * одного компонента дают одинаковую высоту и по значению неразличимы: уходящая
 * снимала переменную, которую только что опубликовала оставшаяся.
 *
 * До волны 26 дефект не проявлялся по другой причине: уборщик перезамерял уже
 * отцепленный узел, получал ноль, и ветка снятия не срабатывала никогда.
 * Починка уборщика эту ветку включила — и тем самым открыла дефект.
 */
describe("TopBar: two headers at once", () => {
  test("a departing header leaves the variable to the one still mounted", () => {
    const first = render(<TopBar />);
    render(<TopBar />);
    expect(heightOf("--topbar-h")).toBe("56px");

    first.unmount();

    // Высота у обеих одна и та же — различить их можно только по владельцу.
    expect(heightOf("--topbar-h")).toBe("56px");
  });

  test("the last header to leave removes the variable", () => {
    const first = render(<TopBar />);
    const second = render(<TopBar />);

    first.unmount();
    second.unmount();

    expect(heightOf("--topbar-h")).toBe("");
  });
});

test("a value written by the application survives a departing middle header", () => {
  const first = render(<TopBar />);
  render(<TopBar />);

  // Приложение публикует своё значение — по докстроке модуля это законно.
  document.documentElement.style.setProperty("--topbar-h", "100px");
  first.unmount();

  // Проверка «в корне лежит не наше» стояла под условием «я последний», и при
  // трёх участниках уходящая не последняя шапка перезаписывала чужое значение.
  expect(heightOf("--topbar-h")).toBe("100px");
});
