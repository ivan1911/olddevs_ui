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

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/*
  `surface="paper"` (OLDSUI-52): the Document area is a light Paper in any app theme.
  The Paper is the Document container itself (`RichTextView` and the editable area of the
  Editor): it carries a nested `data-theme="light"` for the markers and the code highlight,
  and the `--rte-*` tokens with the light theme values. The Toolbar, popovers and menus
  stay in the app theme: they are outside the Paper.
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
    // The Toolbar, popovers and menus are in the app theme: the light wrapper does not cover them.
    const toolbar = root.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.closest("[data-theme]")).toBeNull();
    expect(root.querySelectorAll("[data-theme]")).toHaveLength(1);
  });
});

/** The container's classes as a set: order and `cn` joining do not matter. */
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

    // Every role declared by the theme is also declared by the Paper, and the reverse.
    expect(tokens("paper")).toEqual(tokens("theme"));
    // The rules are the same; the Paper adds only its own edge.
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
  The Paper values are the same primitives that the light theme assigns to the kit tokens.
  The check parses `styles.css` rather than a second table: a change to the light theme
  without a change to the Paper turns red here.
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
  /** A kit token in the light theme: up to the first `--od-*` primitive. */
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
    Deliberate deviations (`tokens.ts`): the Paper background is the white panel of the
    light theme, not the field backdrop; the accent is the fill of the app theme (the light
    brand `accent-strong` does not exist in a dark app), and the roles that the theme
    does not change at all.
  */
  const DEVIATIONS: Record<string, string> = {
    "rte-background": "var(--od-cloud-12)",
    "rte-ring": "var(--accent)",
    "rte-link": "var(--accent)",
    "rte-text-accent": "var(--accent)",
    "rte-primary": "var(--accent)",
    // Selection (OLDSUI-116): the light variant in any app theme; the dark `--selection`
    // is meant for a dark backdrop and is invisible on the Paper.
    "rte-selection": "var(--selection-light)",
    // Selection over a marker: the marker is one in every theme, and so is the role.
    "rte-selection-marker": "color-mix(in_srgb,var(--accent)_38%,transparent)",
    "rte-radius": "var(--r-xs)",
    // The "Note" Wrapper tone (OLDSUI-78): the backdrop is the same as the selection, the bar
    // is the same as a link: the accent of the app theme.
    "rte-tone-accent-background": "var(--accent-soft)",
    "rte-tone-accent-border": "var(--accent)",
    // Secondary text on the tone backdrop: in the theme only `fg-0` holds 4.5, while on the
    // Paper its own steps `cloud-2` and `cloud-3` pass and stay (`tokens.ts`, ⁴).
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
