// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { memo, useState } from "react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "react-aria-components";
import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_MESSAGES,
  UiProvider,
  useMessages,
  useUiConfig,
  useUiLocale,
} from "../src/index.js";
import { Alert } from "../src/components/actions/Alert.js";
import { Spinner } from "../src/components/actions/Spinner.js";
import { ConfirmDialog } from "../src/components/overlays/ConfirmDialog.js";
import { messages as en } from "../src/locales/en.js";
import type { PartialUiMessages } from "../src/i18n/messages.js";

afterEach(cleanup);

/**
 * Порядок разрешения строки и стыковка с react-aria.
 *
 * Проверяется не «строка совпала», а три вещи, которые ломаются молча:
 * фолбэк без провайдера, слияние частичного каталога и то, что кит не перебивает
 * локаль потребителя своей.
 *
 * Сами русские СЛОВА проверяются не здесь, а в `tests/locale-ru.test.tsx`:
 * волна 23 свела их в один файл, чтобы правка формулировки в `locales/ru.ts`
 * не роняла двадцать шесть чужих файлов (ADR-0034).
 */

/**
 * Каталог-двойник вместо `locales/ru`.
 *
 * Здесь проверяется ПОРЯДОК разрешения строки, а не язык: провайдер обязан
 * перебить фолбэк, проп — провайдера, вложенный провайдер — внешний. Для этого
 * годится любой каталог, отличный от фолбэка, и русский достался этим проверкам
 * исторически — до 2.0.0 он и был дефолтом. Сами русские слова проверяются в
 * `tests/locale-ru.test.tsx`, и правка формулировки в `locales/ru.ts` этот файл
 * больше не роняет.
 */
const custom = {
  common: { close: "Shut", notFound: "No matches" },
  alert: { close: "Close the notice" },
  spinner: { label: "Working" },
  confirmDialog: { confirm: "Yes", cancel: "No" },
} satisfies PartialUiMessages;

function ShowMessages() {
  const m = useMessages();
  return (
    <>
      <span data-testid="close">{m.common.close}</span>
      <span data-testid="notFound">{m.common.notFound}</span>
    </>
  );
}

function ShowLocale() {
  return <span data-testid="locale">{useUiLocale()}</span>;
}

function ShowConfig() {
  const { dir } = useUiConfig();
  return <span data-testid="dir">{dir}</span>;
}

describe("fallback", () => {
  test("without a provider the strings are English", () => {
    render(<ShowMessages />);
    expect(screen.getByTestId("close").textContent).toBe("Close");
    expect(screen.getByTestId("notFound").textContent).toBe("Nothing found");
  });

  test("`locales/en` — the same object, not a copy", () => {
    expect(en).toBe(DEFAULT_MESSAGES);
  });
});

describe("provider catalog", () => {
  test("a partial catalog does not wipe the branches it omits", () => {
    render(
      <UiProvider messages={{ common: { close: "Folded" } }}>
        <ShowMessages />
      </UiProvider>
    );
    expect(screen.getByTestId("close").textContent).toBe("Folded");
    // Соседний ключ того же пространства имён обязан остаться английским.
    expect(screen.getByTestId("notFound").textContent).toBe("Nothing found");
  });

  test("a nested provider overrides the outer one and inherits the rest", () => {
    render(
      <UiProvider messages={custom}>
        <UiProvider messages={{ common: { close: "×" } }}>
          <ShowMessages />
        </UiProvider>
      </UiProvider>
    );
    expect(screen.getByTestId("close").textContent).toBe("×");
    expect(screen.getByTestId("notFound").textContent).toBe("No matches");
  });
});

describe("docking with react-aria", () => {
  test("an explicit provider locale wins", () => {
    render(
      <UiProvider locale="ru-RU">
        <ShowLocale />
      </UiProvider>
    );
    expect(screen.getByTestId("locale").textContent).toBe("ru-RU");
  });

  test("without an explicit locale the kit does NOT override the consumer provider", () => {
    // Главный случай: приложение уже держит свой I18nProvider. Кит, навязавший
    // здесь `en-US`, заставил бы датапикеры говорить не на языке приложения.
    render(
      <I18nProvider locale="de-DE">
        <UiProvider messages={{ common: { close: "Schließen" } }}>
          <ShowLocale />
        </UiProvider>
      </I18nProvider>
    );
    expect(screen.getByTestId("locale").textContent).toBe("de-DE");
  });

  test("dir defaults to ltr and is overridden by the provider", () => {
    const { rerender } = render(<ShowConfig />);
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
    rerender(
      <UiProvider dir="rtl">
        <ShowConfig />
      </UiProvider>
    );
    expect(screen.getByTestId("dir").textContent).toBe("rtl");
  });
});

describe("resolution order: prop → provider → fallback", () => {
  test("the prop beats both the provider and the fallback", () => {
    render(
      <UiProvider messages={custom}>
        <Alert onDismiss={() => {}} closeLabel="Hide the banner">
          Message
        </Alert>
      </UiProvider>
    );
    expect(screen.getByRole("button", { name: "Hide the banner" })).toBeTruthy();
  });

  test("without a prop the provider message is used", () => {
    render(
      <UiProvider messages={custom}>
        <Alert onDismiss={() => {}}>Message</Alert>
      </UiProvider>
    );
    expect(screen.getByRole("button", { name: "Close the notice" })).toBeTruthy();
  });

  test("without a prop and without a provider the English fallback is used", () => {
    render(<Alert onDismiss={() => {}}>Message</Alert>);
    expect(screen.getByRole("button", { name: "Dismiss message" })).toBeTruthy();
  });

  test("Spinner: the loading label climbs the same ladder", () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByText("Loading")).toBeTruthy();
    rerender(
      <UiProvider messages={custom}>
        <Spinner />
      </UiProvider>
    );
    expect(screen.getByText("Working")).toBeTruthy();
    rerender(<Spinner label="Counting" />);
    expect(screen.getByText("Counting")).toBeTruthy();
  });

  test("ConfirmDialog: both buttons come from the catalog", () => {
    render(
      <UiProvider messages={custom}>
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete?"
          message="This cannot be undone."
        />
      </UiProvider>
    );
    expect(screen.getByRole("button", { name: "Yes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No" })).toBeTruthy();
  });
});

/**
 * Цена провайдера на каждый рендер.
 *
 * Докстрока пропа `messages` прямо благословляет литерал на месте
 * (`messages={{ common: { close: "Закрыть" } }}`) — а `useMemo` держал каталог
 * в зависимостях ПО ССЫЛКЕ. Литерал даёт новый объект на каждый рендер, значит
 * новое значение контекста, значит перерисовку каждого компонента кита,
 * читающего `useMessages`. Под провайдером стоит всё дерево приложения, поэтому
 * любой тик состояния в корне обходился в перерисовку всего кита разом.
 */
describe("the provider does not churn its consumers", () => {
  let renders = 0;

  const Consumer = memo(function Consumer() {
    useMessages();
    renders += 1;
    return null;
  });

  // Литерал строится ВНУТРИ компонента, который перерисовывается: именно так
  // его и пишет потребитель, и именно поэтому объект каждый раз новый. Тот же
  // каталог, переданный пропом снаружи, ссылку сохраняет и дефекта не
  // воспроизводит — на этом первая версия теста и прошла впустую.
  function App({ close = "Close" }: { close?: string }) {
    const [tick, setTick] = useState(0);
    return (
      <UiProvider messages={{ common: { close } }}>
        <button onClick={() => setTick(tick + 1)}>tick</button>
        <Consumer />
      </UiProvider>
    );
  }

  test("an unrelated state change in the parent does not re-render a memoised consumer", async () => {
    const user = userEvent.setup();
    renders = 0;
    // Литерал на месте — ровно тот вызов, который разрешает докстрока.
    render(<App />);
    const afterMount = renders;

    await user.click(screen.getByRole("button", { name: "tick" }));
    await user.click(screen.getByRole("button", { name: "tick" }));

    expect(renders).toBe(afterMount);
  });

  test("a catalogue that actually changed still reaches the consumer", async () => {
    renders = 0;
    const { rerender } = render(<App />);
    const afterMount = renders;

    rerender(<App close="Dismiss" />);

    // Сравнение по содержимому, а не «не обновлять никогда»: смена значения
    // обязана дойти, иначе экономия куплена сломанным контрактом.
    expect(renders).toBeGreaterThan(afterMount);
  });
});

/**
 * Явный `undefined` в частичном каталоге.
 *
 * `{ ...base[ns], ...values }` копирует и ключи со значением `undefined`, а
 * `exactOptionalPropertyTypes` в `tsconfig.json` выключен — компилятор такой
 * вызов пропускает. Реальная форма — `messages={{ common: { close: dict[key] }}}`,
 * где ключа в словаре потребителя нет: крестик закрытия молча терял доступное
 * имя.
 */
test("an explicit undefined does not wipe the fallback", () => {
  function Probe() {
    return <span>{useMessages().common.close}</span>;
  }

  render(
    <UiProvider messages={{ common: { close: undefined } }}>
      <Probe />
    </UiProvider>
  );

  expect(screen.getByText(DEFAULT_MESSAGES.common.close)).toBeDefined();
});
