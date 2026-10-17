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
 * String resolution order and the join with react-aria.
 *
 * The check is not "the string matched" but three things that break silently:
 * the fallback without a provider, the merge of a partial catalog, and the kit not
 * overriding the consumer's locale with its own.
 *
 * The Russian WORDS themselves are checked not here but in `tests/locale-ru.test.tsx`:
 * wave 23 gathered them into one file, so that a rewording in `locales/ru.ts` does not
 * break twenty-six unrelated files (ADR-0034).
 */

/**
 * A twin catalog instead of `locales/ru`.
 *
 * What is checked here is the ORDER of string resolution, not the language: a provider
 * must override the fallback, a prop must override the provider, and a nested provider
 * must override the outer one. Any catalog other than the fallback will do for this.
 * The Russian catalog got these checks by history: before 2.0.0 it was the default.
 * The Russian words themselves are checked in `tests/locale-ru.test.tsx`, and a rewording
 * in `locales/ru.ts` no longer breaks this file.
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
    // The neighboring key in the same namespace must stay English.
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
    // The main case: the application already holds its own I18nProvider. A kit that
    // forced `en-US` here would make the date pickers speak a language other than the
    // application's.
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
 * The provider's cost on every render.
 *
 * The `messages` prop's docstring explicitly endorses an inline literal
 * (`messages={{ common: { close: "Close" } }}`), while `useMemo` kept the catalog in
 * its dependencies BY REFERENCE. A literal gives a new object on every render, so a new
 * context value, so a re-render of every kit component that reads `useMessages`. The
 * whole application tree sits under the provider, so any state tick at the root cost a
 * re-render of the entire kit at once.
 */
describe("the provider does not churn its consumers", () => {
  let renders = 0;

  const Consumer = memo(function Consumer() {
    useMessages();
    renders += 1;
    return null;
  });

  // The literal is built INSIDE the component that re-renders: that is how a consumer
  // writes it, and that is why the object is new every time. The same catalog passed
  // in as a prop from outside keeps its reference and does not reproduce the defect;
  // the first version of this test passed for that very reason and proved nothing.
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
    // The inline literal is exactly the call that the docstring permits.
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

    // The comparison is by content, not "never update": a changed value must get
    // through, or the saving is bought with a broken contract.
    expect(renders).toBeGreaterThan(afterMount);
  });
});

/**
 * An explicit `undefined` in a partial catalog.
 *
 * `{ ...base[ns], ...values }` also copies keys whose value is `undefined`, and
 * `exactOptionalPropertyTypes` is off in `tsconfig.json`, so the compiler lets such a
 * call through. The real shape is `messages={{ common: { close: dict[key] }}}`, where
 * the consumer's dictionary has no such key: the close button's cross silently lost its
 * accessible name.
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
