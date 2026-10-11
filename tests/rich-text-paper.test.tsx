// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  type RichTextEditorHandle,
  type RichTextSurface,
} from "../src/editor/index.js";
import { EDITOR_TEXT_COLORS } from "../src/editor/styles/palette.js";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "../src/editor/styles/tokens.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/*
  `surface="paper"` (OLDSUI-52): область документа — светлый лист в любой теме
  приложения. Лист — это сам контейнер Документа (`RichTextView` и
  редактируемая область Редактора): на нём вложенная тема `data-theme="light"`
  для маркеров и подсветки и токены `--rte-*` со значениями светлой темы.
  Панель, поповеры и меню остаются в теме приложения — они вне листа.
*/

const DOCUMENT =
  '<p>Text with <a href="https://example.com">a link</a>, ' +
  '<span data-color="danger">red</span> and <mark data-color="yellow">marked</mark>.</p>' +
  "<blockquote><p>Quote</p></blockquote>";

function renderEditor(surface?: RichTextSurface) {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue={DOCUMENT} surface={surface} />
  );
  const content = ref.current!.editor!.view.dom as HTMLElement;
  return { content, root: container.firstElementChild as HTMLElement };
}

describe("surface attributes", () => {
  test("the view follows the app theme by default", () => {
    render(<RichTextView html={DOCUMENT} data-testid="view" />);
    const view = screen.getByTestId("view");

    expect(view.hasAttribute("data-theme")).toBe(false);
    expect(view.hasAttribute("data-surface")).toBe(false);
  });

  test("a paper view is a light sheet: nested light theme on the document container", () => {
    render(<RichTextView html={DOCUMENT} surface="paper" data-testid="view" />);
    const view = screen.getByTestId("view");

    expect(view.getAttribute("data-theme")).toBe("light");
    expect(view.getAttribute("data-surface")).toBe("paper");
  });

  test("the editor follows the app theme by default", () => {
    const { content } = renderEditor();

    expect(content.hasAttribute("data-theme")).toBe(false);
    expect(content.hasAttribute("data-surface")).toBe(false);
  });

  test("a paper editor puts the light theme on the editable document only", () => {
    const { content, root } = renderEditor("paper");

    expect(content.getAttribute("data-theme")).toBe("light");
    expect(content.getAttribute("data-surface")).toBe("paper");
    // Панель, поповеры и меню — в теме приложения: светлая обёртка их не накрывает.
    const toolbar = root.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.closest("[data-theme]")).toBeNull();
    expect(root.querySelectorAll("[data-theme]")).toHaveLength(1);
  });
});

/** Классы контейнера как множество: порядок и склейка `cn` не важны. */
const classesOf = (element: Element) => new Set(element.className.split(/\s+/).filter(Boolean));

describe("editor and view wear the same paper", () => {
  test("the view's paper classes and attributes are all on the editor's document", () => {
    const { content } = renderEditor("paper");
    render(<RichTextView html={DOCUMENT} surface="paper" data-testid="view" />);
    const view = screen.getByTestId("view");

    const inEditor = classesOf(content);
    expect([...classesOf(view)].filter((token) => !inEditor.has(token))).toEqual([]);
    for (const name of ["data-theme", "data-surface"]) {
      expect(content.getAttribute(name), name).toBe(view.getAttribute(name));
    }
  });

  test("paper changes the token values, not the prose rules", () => {
    render(<RichTextView html={DOCUMENT} data-testid="theme" />);
    render(<RichTextView html={DOCUMENT} surface="paper" data-testid="paper" />);
    const isToken = (token: string) => /^(\[:root[^\]]*\]_&\]:)?\[--rte-/.test(token);
    const rules = (id: string) =>
      [...classesOf(screen.getByTestId(id))].filter((token) => !isToken(token));
    const tokens = (id: string) =>
      [...classesOf(screen.getByTestId(id))]
        .filter((token) => token.startsWith("[--rte-"))
        .map((token) => token.slice(1, token.indexOf(":")))
        .sort();

    // Каждая роль, объявленная темой, объявлена и листом — и наоборот.
    expect(tokens("paper")).toEqual(tokens("theme"));
    // Правила те же; лист добавляет только свой край.
    const theme = new Set(rules("theme"));
    expect(
      rules("paper")
        .filter((token) => !theme.has(token))
        .sort()
    ).toEqual(
      [
        "rounded-(--r-sm)",
        "border",
        "border-(--line)",
        "bg-(--rte-background)",
        "px-4",
        "py-3",
        "shadow-[var(--shadow-1)]",
        "scheme-light",
      ].sort()
    );
    expect(rules("theme").filter((token) => !rules("paper").includes(token))).toEqual([]);
  });
});

/*
  Значения листа — те же примитивы, что светлая тема назначает токенам кита.
  Сверка разбором `styles.css`, а не второй таблицей: правка светлой темы без
  правки листа здесь краснеет.
*/
describe("paper tokens are the light theme's values", () => {
  const styles = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
  const declarations = (selector: string) => {
    const at = styles.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    const body = styles.slice(at, styles.indexOf("\n}", at));
    return Object.fromEntries(
      [...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map((m) => [m[1]!, m[2]!.trim()])
    );
  };
  const light = { ...declarations(":root"), ...declarations(':root[data-theme="light"]') };
  /** Токен кита в светлой теме — до первого примитива `--od-*`. */
  const inLight = (token: string): string => {
    const value = light[token];
    expect(value, `--${token} in the light theme`).toBeDefined();
    const reference = value!.match(/^var\(--([\w-]+)\)$/);
    return reference && !reference[1]!.startsWith("od-") ? inLight(reference[1]!) : value!;
  };
  const roles = (classes: string) =>
    Object.fromEntries(
      [...classes.matchAll(/(?:^|\s)\[--(rte-[\w-]+):([^\]]+)\]/g)].map((m) => [m[1]!, m[2]!])
    );
  const theme = roles(EDITOR_TOKENS_CLASS);
  const paper = roles(EDITOR_PAPER_TOKENS_CLASS);

  /*
    Осознанные отступления (`tokens.ts`): фон листа — белая панель светлой
    темы, а не подложка поля; акцент — заливка темы приложения (светлый
    `accent-strong` бренда в тёмном приложении не существует) и роли, которые
    тема не меняет вовсе.
  */
  const DEVIATIONS: Record<string, string> = {
    "rte-background": "var(--od-cloud-12)",
    "rte-ring": "var(--accent)",
    "rte-link": "var(--accent)",
    "rte-text-accent": "var(--accent)",
    "rte-primary": "var(--accent)",
    // Выделение (OLDSUI-116): светлый вариант при любой теме приложения —
    // тёмный `--selection` рассчитан на тёмную подложку и на листе не виден.
    "rte-selection": "var(--selection-light)",
    // Выделение поверх маркера: маркер один во всех темах, и роль одна.
    "rte-selection-marker": "color-mix(in_srgb,var(--accent)_38%,transparent)",
    "rte-radius": "var(--r-xs)",
    // Тон Обёртки «Заметка» (OLDSUI-78): подложка — как выделение, полоса — как
    // ссылка: акцент темы приложения.
    "rte-tone-accent-background": "var(--accent-soft)",
    "rte-tone-accent-border": "var(--accent)",
    // Вторичный текст на подложке тона: в теме держит 4.5 только `fg-0`, а на листе
    // свои ступени `cloud-2` и `cloud-3` проходят и остаются (`tokens.ts`, ⁴).
    "rte-tone-secondary": "var(--od-cloud-2)",
    "rte-tone-muted": "var(--od-cloud-3)",
    "rte-tone-muted-foreground": "var(--od-cloud-3)",
  };

  test.each(Object.keys(theme))("%s", (role) => {
    const expected = DEVIATIONS[role] ?? inLight(theme[role]!.match(/^var\(--([\w-]+)\)$/)![1]!);
    expect(paper[role]).toBe(expected);
  });

  test("the white sheet is the light theme's panel", () => {
    expect(inLight("surface-panel")).toBe(paper["rte-background"]);
  });

  test("in a light app the accent roles take the light theme's own accent-strong", () => {
    for (const role of ["rte-ring", "rte-link", "rte-text-accent", "rte-tone-accent-border"]) {
      expect(EDITOR_PAPER_TOKENS_CLASS).toContain(
        `[:root[data-theme=light]_&]:[--${role}:var(--accent-strong)]`
      );
    }
  });

  test("every text colour of the palette has its role, with the palette's token in the theme", () => {
    for (const { name, text } of EDITOR_TEXT_COLORS) {
      expect(theme[`rte-text-${name}`], name).toBe(`var(--${text})`);
      expect(paper[`rte-text-${name}`], name).toBeDefined();
    }
  });
});
