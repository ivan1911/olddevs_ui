// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table`: `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("lang");
});

/**
 * The "Language ›" submenu of the "…" menu (OLDSUI-308, ADR-0078): radio items for the languages of
 * the option, the primary one marked, and "Remove language mark". Through the public
 * `RichTextEditor`: the items are found by roles and names, as a screen reader hears them, and the
 * result is the output HTML.
 */

type User = ReturnType<typeof userEvent.setup>;

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>one two three</p>" {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

function select(editor: Editor, text: string) {
  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text);
  });
  if (from < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection({ from, to: from + text.length }));
}

/** Names of the language items in the open submenu, with the checked flag. */
function radios(menu: HTMLElement) {
  return within(menu)
    .getAllByRole("menuitemradio")
    .map((item) => ({
      name: item.textContent,
      checked: item.getAttribute("aria-checked") === "true",
    }));
}

async function openLanguage(user: User, name = "Language") {
  await user.click(screen.getByRole("button", { name: "More formatting" }));
  const more = screen.getByRole("menu", { name: "More formatting" });
  await user.click(within(more).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

const html = (ref: { current: RichTextEditorHandle | null }) => ref.current!.getHTML();

test("the submenu lists the option's languages by name, the page's own marked and checked", async () => {
  document.documentElement.setAttribute("lang", "en");
  const user = userEvent.setup();
  renderEditor();

  const menu = await openLanguage(user);
  expect(radios(menu)).toEqual([
    { name: "English (primary)", checked: true },
    { name: "Russian", checked: false },
  ]);
  // Remove has nothing to remove here.
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Remove language mark" })
      .getAttribute("aria-disabled")
  ).toBe("true");
});

test("choosing a language marks the selection; the mark is checked afterwards", async () => {
  document.documentElement.setAttribute("lang", "en");
  const user = userEvent.setup();
  const { ref, editor } = renderEditor();
  select(editor, "two");

  await user.click(
    within(await openLanguage(user)).getByRole("menuitemradio", { name: "Russian" })
  );
  await waitFor(() => expect(html(ref)).toBe('<p>one <span lang="ru">two</span> three</p>'));

  const menu = await openLanguage(user);
  expect(radios(menu)).toEqual([
    { name: "English (primary)", checked: false },
    { name: "Russian", checked: true },
  ]);
});

test("the primary language is the same as removing the mark", async () => {
  document.documentElement.setAttribute("lang", "en-US");
  const user = userEvent.setup();
  const { ref, editor } = renderEditor({
    defaultValue: '<p>one <span lang="ru">two</span> three</p>',
  });
  select(editor, "two");

  await user.click(
    within(await openLanguage(user)).getByRole("menuitemradio", { name: "English (primary)" })
  );
  await waitFor(() => expect(html(ref)).toBe("<p>one two three</p>"));
});

test("Remove language mark removes it and is available only over a mark", async () => {
  const user = userEvent.setup();
  const { ref, editor } = renderEditor({
    defaultValue: '<p>one <span lang="ru">two</span> three</p>',
  });
  select(editor, "two");

  const menu = await openLanguage(user);
  const remove = within(menu).getByRole("menuitem", { name: "Remove language mark" });
  expect(remove.getAttribute("aria-disabled")).not.toBe("true");
  await user.click(remove);
  await waitFor(() => expect(html(ref)).toBe("<p>one two three</p>"));
});

test("a language from the Document that the option lacks is shown, checked", async () => {
  document.documentElement.setAttribute("lang", "en");
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>one <span lang="de">two</span> three</p>',
  });
  select(editor, "two");

  expect(radios(await openLanguage(user))).toEqual([
    { name: "English (primary)", checked: false },
    { name: "Russian", checked: false },
    { name: "German", checked: true },
  ]);
});

test("a selection that mixes two languages has none checked, and Remove is available", async () => {
  document.documentElement.setAttribute("lang", "en");
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p><span lang="ru">one</span> two three</p>',
  });
  // "one" is Russian, " two" is plain text: positions, because the text is two nodes.
  act(() => void editor.commands.setTextSelection({ from: 1, to: 8 }));

  const menu = await openLanguage(user);
  expect(radios(menu).filter((item) => item.checked)).toEqual([]);
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Remove language mark" })
      .getAttribute("aria-disabled")
  ).not.toBe("true");
});

test("the languages option sets the list and its order; names follow the interface language", async () => {
  document.documentElement.setAttribute("lang", "fr");
  const user = userEvent.setup();
  renderEditor({ tools: ["bold", tool("language", { languages: ["de", "fr", "pt-BR"] })] });

  expect(radios(await openLanguage(user)).map((item) => item.name)).toEqual([
    "German",
    "French (primary)",
    "Brazilian Portuguese",
  ]);
});

test("in Russian the names are drawn by Intl.DisplayNames in Russian, the words by the catalog", async () => {
  document.documentElement.setAttribute("lang", "ru");
  const user = userEvent.setup();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<p>one</p>" />
    </UiProvider>
  );
  const t = ru.editor;
  const names = new Intl.DisplayNames(["ru-RU"], { type: "language" });
  const cap = (value: string | undefined) =>
    value!.charAt(0).toLocaleUpperCase("ru-RU") + value!.slice(1);

  await user.click(screen.getByRole("button", { name: t.moreFormatting }));
  await user.click(
    within(screen.getByRole("menu", { name: t.moreFormatting })).getByRole("menuitem", {
      name: t.language,
    })
  );
  const menu = await screen.findByRole("menu", { name: t.language });
  expect(radios(menu)).toEqual([
    { name: cap(names.of("en")), checked: false },
    { name: t.languagePrimary({ language: cap(names.of("ru")) }), checked: true },
  ]);
  expect(within(menu).getByRole("menuitem", { name: t.languageRemove })).toBeDefined();
});

test("the menu is absent without the tool, and is the whole «…» on its own with it", async () => {
  const user = userEvent.setup();
  const { unmount } = renderEditor({ tools: ["bold", "history"] });
  expect(screen.queryByRole("button", { name: "More formatting" })).toBeNull();
  unmount();

  renderEditor({ tools: ["bold", "language"] });
  await user.click(screen.getByRole("button", { name: "More formatting" }));
  const more = screen.getByRole("menu", { name: "More formatting" });
  expect(
    within(more)
      .getAllByRole("menuitem")
      .map((item) => item.textContent)
  ).toEqual(["Language"]);
});

test("the selection menu has the same submenu", async () => {
  document.documentElement.setAttribute("lang", "en");
  const user = userEvent.setup();
  const { ref, editor } = renderEditor({ toolbar: "bubble" });
  act(() => editor.view.focus());
  select(editor, "two");

  const bubble = await screen.findByRole("toolbar", { name: "Selection formatting" });
  await user.click(within(bubble).getByRole("button", { name: "More formatting" }));
  await user.click(
    within(screen.getByRole("menu", { name: "More formatting" })).getByRole("menuitem", {
      name: "Language",
    })
  );
  await user.click(
    within(await screen.findByRole("menu", { name: "Language" })).getByRole("menuitemradio", {
      name: "Russian",
    })
  );
  await waitFor(() => expect(html(ref)).toBe('<p>one <span lang="ru">two</span> three</p>'));
});

test("Clear formatting in the menu leaves the language", async () => {
  const user = userEvent.setup();
  const { ref, editor } = renderEditor({
    defaultValue: '<p><span lang="ru"><strong>one</strong> two</span> three</p>',
  });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 8 }));

  await user.click(screen.getByRole("button", { name: "More formatting" }));
  await user.click(
    within(screen.getByRole("menu", { name: "More formatting" })).getByRole("menuitem", {
      name: /Clear formatting/,
    })
  );
  await waitFor(() => expect(html(ref)).toBe('<p><span lang="ru">one two</span> three</p>'));
});
